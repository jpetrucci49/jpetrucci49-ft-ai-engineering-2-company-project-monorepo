"""Clinic × month KPI aggregation for Dr. Okonkwo's board pack."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

import pandas as pd

from data.process.clinic_dimension import resolve_clinic
from data.process.inbound_cost import inbound_event_cost

KPI_EVENT_TYPES = frozenset(
    {
        "inbound_order_created",
        "outbound_order_created",
        "stock_threshold_triggered",
        "supply_expiry_flagged",
    }
)


def parse_utc(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)
    text = str(value).strip()
    if not text:
        return None
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def compute_clinic_month_kpis(
    events: list[dict[str, Any]],
    month_start: date,
) -> tuple[list[dict[str, Any]], int]:
    """Dedup eventId, map clinic slugs, compute the four CONTEXT KPIs.

    Returns (rows, missing_inbound_cost_count). Never emits a mixed-currency total.
    """
    records: list[dict[str, Any]] = []
    seen_event_ids: set[str] = set()
    missing_cost = 0

    for event in events:
        tags = event.get("tags") if isinstance(event.get("tags"), dict) else {}
        event_id = tags.get("eventId")
        if event_id:
            key = str(event_id)
            if key in seen_event_ids:
                continue
            seen_event_ids.add(key)

        event_type = event.get("event_type")
        if event_type not in KPI_EVENT_TYPES:
            continue

        clinic = resolve_clinic(tags)
        if clinic is None:
            continue

        timestamp = parse_utc(event.get("timestamp"))
        if timestamp is None:
            continue
        if timestamp.date().replace(day=1) != month_start:
            continue

        cost = 0.0
        if event_type == "inbound_order_created":
            amount, missing = inbound_event_cost(tags, event.get("value"))
            cost = float(amount)
            if missing:
                missing_cost += 1

        records.append(
            {
                "clinic_id": clinic.clinic_id,
                "country": clinic.country,
                "currency": clinic.currency,
                "month_start": month_start.isoformat(),
                "event_type": event_type,
                "inbound_cost": cost,
            }
        )

    if not records:
        return [], missing_cost

    frame = pd.DataFrame.from_records(records)
    grouped = (
        frame.groupby(["clinic_id", "country", "currency", "month_start"], sort=True)
        .agg(
            total_supply_cost=("inbound_cost", "sum"),
            supply_consumption_count=(
                "event_type",
                lambda series: int((series == "outbound_order_created").sum()),
            ),
            critical_stockout_count=(
                "event_type",
                lambda series: int((series == "stock_threshold_triggered").sum()),
            ),
            expiry_risk_count=(
                "event_type",
                lambda series: int((series == "supply_expiry_flagged").sum()),
            ),
        )
        .reset_index()
    )

    rows: list[dict[str, Any]] = []
    for raw in grouped.to_dict(orient="records"):
        rows.append(
            {
                "clinic_id": raw["clinic_id"],
                "country": raw["country"],
                "month_start": raw["month_start"],
                "total_supply_cost": round(float(raw["total_supply_cost"]), 2),
                "supply_consumption_count": int(raw["supply_consumption_count"]),
                "critical_stockout_count": int(raw["critical_stockout_count"]),
                "expiry_risk_count": int(raw["expiry_risk_count"]),
                "currency": raw["currency"],
            }
        )
    return rows, missing_cost

"""Read helpers imported by services/api/reporting — no ETL here."""

from __future__ import annotations

from datetime import date
from typing import Any

from sqlalchemy import text

from data.pipelines.monthly_clinic_supply_performance.db import (
    KPI_TABLE,
    PIPELINE_NAME,
    RUNS_TABLE,
    ensure_reporting_schema,
    qualified_table,
)


def _as_date(value: Any) -> date | None:
    if value is None:
        return None
    if isinstance(value, date) and not hasattr(value, "hour"):
        return value
    text_value = str(value)[:10]
    try:
        return date.fromisoformat(text_value)
    except ValueError:
        return None


def _cost(value: Any) -> float:
    if value is None:
        return 0.0
    return round(float(value), 2)


def query_monthly_clinic_supply_performance(
    month_start: date | None = None,
) -> dict[str, Any]:
    """KPI rows for the CONTEXT dashboard contract."""
    engine = ensure_reporting_schema()
    table = qualified_table(engine, KPI_TABLE)
    with engine.connect() as conn:
        resolved = month_start
        if resolved is None:
            latest = conn.execute(text(f"SELECT MAX(month_start) FROM {table}")).scalar()
            resolved = _as_date(latest)
        if resolved is None:
            return {"month_start": None, "clinics": []}

        rows = conn.execute(
            text(
                f"""
                SELECT clinic_id, country, total_supply_cost, supply_consumption_count,
                       critical_stockout_count, expiry_risk_count, currency
                FROM {table}
                WHERE month_start = :month_start
                ORDER BY clinic_id
                """
            ),
            {"month_start": resolved.isoformat()},
        ).mappings()
        clinics = [
            {
                "clinic_id": row["clinic_id"],
                "country": row["country"],
                "total_supply_cost": _cost(row["total_supply_cost"]),
                "supply_consumption_count": int(row["supply_consumption_count"]),
                "critical_stockout_count": int(row["critical_stockout_count"]),
                "expiry_risk_count": int(row["expiry_risk_count"]),
                "currency": row["currency"],
            }
            for row in rows
        ]
    return {"month_start": resolved.isoformat(), "clinics": clinics}


def get_latest_pipeline_run() -> dict[str, Any] | None:
    engine = ensure_reporting_schema()
    table = qualified_table(engine, RUNS_TABLE)
    with engine.connect() as conn:
        row = conn.execute(
            text(
                f"""
                SELECT id, pipeline_name, month_start, started_at, finished_at, status,
                       records_read, records_written, error_message, prefect_flow_run_id
                FROM {table}
                WHERE pipeline_name = :pipeline_name
                ORDER BY started_at DESC
                LIMIT 1
                """
            ),
            {"pipeline_name": PIPELINE_NAME},
        ).mappings().first()
    if row is None:
        return None
    payload = dict(row)
    month = _as_date(payload.get("month_start"))
    payload["month_start"] = month.isoformat() if month else None
    payload["id"] = str(payload["id"])
    for key in ("started_at", "finished_at"):
        value = payload.get(key)
        if value is not None and hasattr(value, "isoformat"):
            payload[key] = value.isoformat()
        elif value is not None:
            payload[key] = str(value)
    return payload

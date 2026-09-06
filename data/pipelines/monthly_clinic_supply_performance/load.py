"""load_clinic_month — idempotent upsert on (clinic_id, month_start)."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any
from uuid import uuid4

from data.pipelines.paths import ensure_import_paths

ensure_import_paths()

from prefect import task
from sqlalchemy import text

from data.pipelines.monthly_clinic_supply_performance.db import (
    KPI_TABLE,
    ensure_reporting_schema,
    qualified_table,
)


def upsert_clinic_month_rows(kpis: list[dict[str, Any]], month_start: date) -> int:
    """Replace KPI columns for the grain. Never increment. One transaction."""
    engine = ensure_reporting_schema()
    table = qualified_table(engine, KPI_TABLE)
    computed_at = datetime.now(timezone.utc).isoformat()
    sql = text(
        f"""
        INSERT INTO {table} (
          id, clinic_id, country, month_start, total_supply_cost,
          supply_consumption_count, critical_stockout_count, expiry_risk_count,
          currency, computed_at
        ) VALUES (
          :id, :clinic_id, :country, :month_start, :total_supply_cost,
          :supply_consumption_count, :critical_stockout_count, :expiry_risk_count,
          :currency, :computed_at
        )
        ON CONFLICT (clinic_id, month_start) DO UPDATE SET
          country = excluded.country,
          total_supply_cost = excluded.total_supply_cost,
          supply_consumption_count = excluded.supply_consumption_count,
          critical_stockout_count = excluded.critical_stockout_count,
          expiry_risk_count = excluded.expiry_risk_count,
          currency = excluded.currency,
          computed_at = excluded.computed_at
        """
    )
    with engine.begin() as conn:
        for row in kpis:
            conn.execute(
                sql,
                {
                    "id": str(uuid4()),
                    "clinic_id": row["clinic_id"],
                    "country": row["country"],
                    "month_start": month_start.isoformat(),
                    "total_supply_cost": row["total_supply_cost"],
                    "supply_consumption_count": row["supply_consumption_count"],
                    "critical_stockout_count": row["critical_stockout_count"],
                    "expiry_risk_count": row["expiry_risk_count"],
                    "currency": row["currency"],
                    "computed_at": computed_at,
                },
            )
    return len(kpis)


# 3 retries, 5s apart: same pooler/network rationale as extract_month.
# A failed attempt rolls back the whole KPI transaction (see PIPELINE_DESIGN.md §6).
@task(name="load_clinic_month", retries=3, retry_delay_seconds=5)
def load_clinic_month(kpis: list[dict[str, Any]], month_start: date) -> int:
    return upsert_clinic_month_rows(kpis, month_start)

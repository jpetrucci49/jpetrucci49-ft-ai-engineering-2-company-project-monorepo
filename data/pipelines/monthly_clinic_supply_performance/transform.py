"""transform_clinic_month — cached clinic × month KPI aggregation."""

from __future__ import annotations

import json
import os
from datetime import date, timedelta
from typing import Any

from data.pipelines.paths import eval_snapshot_path_for, kpis_path_for
from prefect import task

from data.process.clinic_month_kpis import compute_clinic_month_kpis


def transform_cache_key(_context: Any, parameters: dict[str, Any]) -> str:
    """Cache key is month_start + SHA-256 of the extract file contents.

    Valid for 6 hours: the same closed UTC month and unchanged extract is not
    re-aggregated during retries or a same-morning board-pack refresh.
    """
    month = parameters.get("month_start")
    digest = parameters.get("content_hash")
    return f"transform_clinic_month:{month}:{digest}"


def transform_clinic_month_impl(
    extract_path: str,
    month_start: date,
) -> dict[str, Any]:
    payload = json.loads(open(extract_path, encoding="utf-8").read())
    events = payload.get("events", [])
    rows, missing_cost = compute_clinic_month_kpis(events, month_start)
    intermediate = kpis_path_for(month_start.isoformat())
    intermediate.write_text(json.dumps(rows, indent=2), encoding="utf-8")
    return {
        "kpis": rows,
        "missing_inbound_cost_count": missing_cost,
        "kpis_path": str(intermediate),
    }


@task(
    name="transform_clinic_month",
    cache_key_fn=transform_cache_key,
    cache_expiration=timedelta(hours=6),
)
def transform_clinic_month(
    extract_path: str,
    month_start: date,
    content_hash: str,
) -> dict[str, Any]:
    return transform_clinic_month_impl(extract_path, month_start)


@task(name="write_eval_snapshot")
def write_eval_snapshot(kpis: list[dict[str, Any]], month_start: date) -> str:
    """Optional / non-critical: golden snapshot under data/eval/."""
    if os.getenv("HEALTHCORE_EVAL_FAIL", "").strip() in {"1", "true", "yes"}:
        raise RuntimeError("eval snapshot forced failure (HEALTHCORE_EVAL_FAIL)")
    path = eval_snapshot_path_for(month_start.isoformat())
    path.write_text(
        json.dumps({"month_start": month_start.isoformat(), "clinics": kpis}, indent=2),
        encoding="utf-8",
    )
    return str(path)

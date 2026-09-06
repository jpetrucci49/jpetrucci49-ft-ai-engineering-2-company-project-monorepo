"""extract_month — read-only pull of the four CONTEXT event types."""

from __future__ import annotations

import hashlib
import json
from datetime import date, datetime, timezone
from typing import Any

from data.pipelines.monthly_clinic_supply_performance.db import get_pipeline_engine
from data.pipelines.paths import SAMPLE_EVENTS_PATH, extract_path_for
from prefect import task
from sqlalchemy import inspect, text


class TelemetryTableMissing(RuntimeError):
    """Not a transient outage — do not retry extract_month."""


def _retry_transient_extract(_task, _task_run, state) -> bool:
    try:
        state.result()
    except TelemetryTableMissing:
        return False
    except Exception:
        return True
    return False

SOURCE_EVENT_TYPES = (
    "inbound_order_created",
    "outbound_order_created",
    "stock_threshold_triggered",
    "supply_expiry_flagged",
)


def month_window(month_start: date) -> tuple[datetime, datetime]:
    start = datetime(month_start.year, month_start.month, 1, tzinfo=timezone.utc)
    if month_start.month == 12:
        end = datetime(month_start.year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end = datetime(month_start.year, month_start.month + 1, 1, tzinfo=timezone.utc)
    return start, end


def _as_tags(tags: Any) -> dict[str, Any]:
    if isinstance(tags, dict):
        return tags
    if isinstance(tags, (bytes, bytearray)):
        tags = tags.decode("utf-8")
    if isinstance(tags, str):
        try:
            parsed = json.loads(tags)
        except json.JSONDecodeError:
            return {}
        return parsed if isinstance(parsed, dict) else {}
    return {}


def _serialize_event(timestamp: Any, event_type: str, value: Any, tags: Any) -> dict[str, Any]:
    if hasattr(timestamp, "isoformat"):
        stamp = timestamp.isoformat()
    else:
        stamp = str(timestamp)
    return {
        "timestamp": stamp,
        "event_type": event_type,
        "value": float(value) if value is not None else None,
        "tags": _as_tags(tags),
    }


def _content_hash(rows: list[dict[str, Any]]) -> str:
    payload = json.dumps(rows, sort_keys=True, default=str).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def write_extract_file(month_start: date, rows: list[dict[str, Any]]) -> str:
    path = extract_path_for(month_start.isoformat())
    path.write_text(
        json.dumps({"month_start": month_start.isoformat(), "events": rows}, default=str, indent=2),
        encoding="utf-8",
    )
    return str(path)


def load_sample_events(month_start: date) -> list[dict[str, Any]]:
    if not SAMPLE_EVENTS_PATH.is_file():
        return []
    payload = json.loads(SAMPLE_EVENTS_PATH.read_text(encoding="utf-8"))
    events = payload.get("events", payload if isinstance(payload, list) else [])
    start, end = month_window(month_start)
    selected: list[dict[str, Any]] = []
    for event in events:
        raw_ts = event.get("timestamp")
        if raw_ts is None:
            continue
        text_ts = str(raw_ts).replace("Z", "+00:00")
        try:
            stamp = datetime.fromisoformat(text_ts)
        except ValueError:
            continue
        if stamp.tzinfo is None:
            stamp = stamp.replace(tzinfo=timezone.utc)
        stamp = stamp.astimezone(timezone.utc)
        if start <= stamp < end:
            selected.append(
                {
                    "timestamp": stamp.isoformat(),
                    "event_type": event.get("event_type"),
                    "value": event.get("value"),
                    "tags": event.get("tags") if isinstance(event.get("tags"), dict) else {},
                }
            )
    return selected


def query_telemetry_events(month_start: date) -> list[dict[str, Any]]:
    engine = get_pipeline_engine()
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    if engine.dialect.name == "postgresql":
        table_names.update(inspector.get_table_names(schema="public"))
    if "telemetry_events" not in table_names:
        raise TelemetryTableMissing("telemetry_events table is not available")

    start, end = month_window(month_start)
    placeholders = ", ".join(f":t{i}" for i in range(len(SOURCE_EVENT_TYPES)))
    # SQLite: bind naive UTC strings so we never hit Python 3.12's deprecated
    # default datetime adapter. Postgres accepts aware datetime values.
    if engine.dialect.name == "sqlite":
        start_bound: Any = (
            start.astimezone(timezone.utc).replace(tzinfo=None).isoformat(sep=" ")
        )
        end_bound: Any = (
            end.astimezone(timezone.utc).replace(tzinfo=None).isoformat(sep=" ")
        )
    else:
        start_bound = start
        end_bound = end
    params: dict[str, Any] = {
        "start": start_bound,
        "end": end_bound,
    }
    for index, event_type in enumerate(SOURCE_EVENT_TYPES):
        params[f"t{index}"] = event_type

    sql = text(
        f"""
        SELECT timestamp, event_type, value, tags
        FROM telemetry_events
        WHERE timestamp >= :start AND timestamp < :end
          AND event_type IN ({placeholders})
        ORDER BY timestamp
        """
    )
    with engine.connect() as conn:
        result = conn.execute(sql, params)
        return [
            _serialize_event(timestamp, event_type, value, tags)
            for timestamp, event_type, value, tags in result
        ]


# 3 retries, 5s apart: Session pooler / Codespaces IPv6 blips are transient;
# three attempts cover a brief outage without delaying the board pack past
# the first-working-day window (cron 06:00 UTC on the 1st).
@task(
    name="extract_month",
    retries=3,
    retry_delay_seconds=5,
    retry_condition_fn=_retry_transient_extract,
)
def extract_month(month_start: date) -> dict[str, Any]:
    rows = query_telemetry_events(month_start)
    path = write_extract_file(month_start, rows)
    return {
        "extract_path": path,
        "records_read": len(rows),
        "content_hash": _content_hash(rows),
        "source": "telemetry_events",
    }


def extract_from_sample(month_start: date) -> dict[str, Any]:
    rows = load_sample_events(month_start)
    path = write_extract_file(month_start, rows)
    return {
        "extract_path": path,
        "records_read": len(rows),
        "content_hash": _content_hash(rows),
        "source": "data/raw/telemetry_events_sample.json",
    }

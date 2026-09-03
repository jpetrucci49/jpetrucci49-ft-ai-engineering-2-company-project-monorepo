"""Load → refine → convert types → group → aggregate. No default date window here."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from typing import Any

import pandas as pd
from sqlmodel import Session, select

from telemetry.table import TelemetryEventRow

LOAD_COLUMNS = ("timestamp", "event_type", "level", "value", "tags")
LATENCY_EVENT_TYPE = "api_latency_recorded"
AUTH_EVENT_TYPES = ("login_failed", "login_succeeded")


def load_events(
    session: Session,
    start: datetime,
    end: datetime,
    event_types: Sequence[str] | None = None,
) -> pd.DataFrame:
    statement = select(
        TelemetryEventRow.timestamp,
        TelemetryEventRow.event_type,
        TelemetryEventRow.level,
        TelemetryEventRow.value,
        TelemetryEventRow.tags,
    ).where(
        TelemetryEventRow.timestamp >= start,
        TelemetryEventRow.timestamp < end,
    )
    if event_types:
        statement = statement.where(TelemetryEventRow.event_type.in_(list(event_types)))

    rows = session.exec(statement).all()
    if not rows:
        return pd.DataFrame(columns=list(LOAD_COLUMNS))

    frame = pd.DataFrame.from_records(rows, columns=list(LOAD_COLUMNS))
    frame["tags"] = frame["tags"].where(frame["tags"].notna(), {}).map(_as_tags)
    frame["timestamp"] = pd.to_datetime(frame["timestamp"], utc=True)
    return frame


def events_per_day(session: Session, start: datetime, end: datetime) -> list[dict[str, Any]]:
    frame = load_events(session, start, end)
    if frame.empty:
        return []
    grouped = (
        _with_day(frame)
        .groupby(["day", "event_type"], sort=True, observed=True)
        .size()
        .reset_index(name="count")
    )
    return _as_records(grouped, date_from="day", keep=("event_type", "count"))


def error_rate_by_type(session: Session, start: datetime, end: datetime) -> list[dict[str, Any]]:
    frame = load_events(session, start, end)
    if frame.empty:
        return []
    working = _with_day(frame)
    working["is_error"] = (working["level"] == "error").astype(int)
    grouped = (
        working.groupby(["day", "event_type"], sort=True, observed=True)
        .agg(errors=("is_error", "sum"), total=("is_error", "count"))
        .reset_index()
    )
    grouped["rate"] = (grouped["errors"] / grouped["total"]).where(grouped["total"] > 0, 0.0)
    return _as_records(grouped, date_from="day", keep=("event_type", "errors", "total", "rate"))


def latency_by_day(session: Session, start: datetime, end: datetime) -> list[dict[str, Any]]:
    frame = load_events(session, start, end, event_types=(LATENCY_EVENT_TYPE,))
    if frame.empty:
        return []
    working = _with_day(frame)
    duration = pd.to_numeric(working["tags"].map(lambda tags: tags.get("duration_ms")), errors="coerce")
    value = pd.to_numeric(working["value"], errors="coerce")
    working["latency"] = value.where(value.notna(), duration)
    working["route_template"] = working["tags"].map(lambda tags: tags.get("route_template"))
    working = working.dropna(subset=["latency", "route_template"])
    if working.empty:
        return []
    grouped = (
        working.groupby(["day", "route_template"], sort=True, observed=True)
        .agg(avg_ms=("latency", "mean"), count=("latency", "count"))
        .reset_index()
    )
    return _as_records(grouped, date_from="day", keep=("route_template", "avg_ms", "count"))


def auth_failure_rate(session: Session, start: datetime, end: datetime) -> list[dict[str, Any]]:
    frame = load_events(session, start, end, event_types=AUTH_EVENT_TYPES)
    if frame.empty:
        return []
    working = _with_day(frame)
    working["is_failure"] = (working["event_type"] == "login_failed").astype(int)
    grouped = (
        working.groupby("day", sort=True, observed=True)
        .agg(failures=("is_failure", "sum"), attempts=("is_failure", "count"))
        .reset_index()
    )
    grouped["rate"] = (grouped["failures"] / grouped["attempts"]).where(grouped["attempts"] > 0, 0.0)
    return _as_records(grouped, date_from="day", keep=("failures", "attempts", "rate"))


def build_report(session: Session, start: datetime, end: datetime) -> dict[str, Any]:
    return {
        "period": {"from": start.isoformat(), "to": end.isoformat()},
        "metrics": {
            "events_per_day": events_per_day(session, start, end),
            "error_rate_by_type": error_rate_by_type(session, start, end),
            "latency_by_day": latency_by_day(session, start, end),
            "auth_failure_rate": auth_failure_rate(session, start, end),
        },
    }


def _as_tags(value: object) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _with_day(frame: pd.DataFrame) -> pd.DataFrame:
    working = frame.copy()
    working["timestamp"] = pd.to_datetime(working["timestamp"], utc=True)
    working["day"] = working["timestamp"].dt.floor("D")
    return working


def _as_records(
    frame: pd.DataFrame,
    *,
    date_from: str,
    keep: tuple[str, ...],
) -> list[dict[str, Any]]:
    export = frame.loc[:, [date_from, *keep]].copy()
    export["date"] = pd.to_datetime(export[date_from], utc=True).dt.strftime("%Y-%m-%d")
    export = export.drop(columns=[date_from])
    ordered = export.loc[:, ["date", *keep]]
    records = ordered.reset_index(drop=True).to_dict(orient="records")
    return [_json_safe(row) for row in records]


def _json_safe(row: dict[str, Any]) -> dict[str, Any]:
    safe: dict[str, Any] = {}
    for key, value in row.items():
        if hasattr(value, "item"):
            value = value.item()
        if isinstance(value, float):
            value = float(value)
        elif isinstance(value, int) and not isinstance(value, bool):
            value = int(value)
        safe[key] = value
    return safe

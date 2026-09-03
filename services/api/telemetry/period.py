"""Resolve the report window. Metric functions never own the default."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone


class InvalidReportPeriod(ValueError):
    """ISO parse failure or start >= end."""


def parse_iso_datetime(raw: str) -> datetime:
    text = raw.strip()
    if not text:
        raise ValueError("empty datetime")
    if text.endswith("Z"):
        text = f"{text[:-1]}+00:00"
    if len(text) == 10 and text[4] == "-" and text[7] == "-":
        return datetime.fromisoformat(text).replace(tzinfo=timezone.utc)
    parsed = datetime.fromisoformat(text)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def resolve_report_period(
    start_date: str | None,
    end_date: str | None,
    *,
    now: datetime | None = None,
) -> tuple[datetime, datetime]:
    """Inclusive start, exclusive end, UTC. Default window is the last 7 days."""
    clock = now or datetime.now(timezone.utc)
    try:
        end = parse_iso_datetime(end_date) if end_date else clock
        start = parse_iso_datetime(start_date) if start_date else end - timedelta(days=7)
    except ValueError as exc:
        raise InvalidReportPeriod("start_date and end_date must be ISO 8601 datetimes.") from exc
    if start >= end:
        raise InvalidReportPeriod("start_date must be before end_date.")
    return start, end

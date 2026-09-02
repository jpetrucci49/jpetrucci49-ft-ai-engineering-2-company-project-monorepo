"""Bulk insert telemetry rows. Caller owns the transaction (get_db commit)."""

from __future__ import annotations

from sqlmodel import Session

from telemetry.table import TelemetryEventRow


def bulk_insert(session: Session, rows: list[TelemetryEventRow]) -> None:
    if not rows:
        return
    session.add_all(rows)

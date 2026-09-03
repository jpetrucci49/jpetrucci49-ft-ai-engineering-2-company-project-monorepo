"""Write-only ingest plus authenticated operational report."""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import ValidationError
from sqlmodel import Session

from auth.dependencies import get_current_user
from auth.models import UserPublic
from inventory.database import get_db
import telemetry.config  # noqa: F401 — read TELEMETRY_ENDPOINT at import
from telemetry.analysis import build_report
from telemetry.cache import report_cache
from telemetry.mapping import to_row
from telemetry.models import (
    TelemetryBatchEnvelope,
    TelemetryBatchOut,
    TelemetryEvent,
    TelemetryReportOut,
)
from telemetry.period import InvalidReportPeriod, resolve_report_period
from telemetry.repository import bulk_insert
from telemetry.table import TelemetryEventRow

logger = logging.getLogger(__name__)

router = APIRouter(tags=["telemetry"])


@router.post("/telemetry/events", response_model=TelemetryBatchOut)
def ingest_events(
    batch: TelemetryBatchEnvelope,
    session: Session = Depends(get_db),
) -> TelemetryBatchOut:
    received = len(batch.events)
    rows: list[TelemetryEventRow] = []
    rejected = 0
    for raw in batch.events:
        try:
            event = TelemetryEvent.model_validate(raw)
            rows.append(to_row(event))
        except ValidationError:
            rejected += 1
    if rows:
        bulk_insert(session, rows)
    types = ",".join(row.event_type for row in rows)
    logger.info(
        "received=%s stored=%s rejected=%s types=%s",
        received,
        len(rows),
        rejected,
        types,
    )
    return TelemetryBatchOut(received=received, stored=len(rows), rejected=rejected)


CurrentUser = Annotated[UserPublic, Depends(get_current_user)]
DbSession = Annotated[Session, Depends(get_db)]


@router.get("/telemetry/report", response_model=TelemetryReportOut)
def get_report(
    session: DbSession,
    _: CurrentUser,
    start_date: str | None = None,
    end_date: str | None = None,
) -> dict:
    try:
        start, end = resolve_report_period(start_date, end_date)
    except InvalidReportPeriod as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    cached = report_cache.get(start, end)
    if cached is not None:
        logger.info("telemetry report cache hit from=%s to=%s", start.isoformat(), end.isoformat())
        return cached

    payload = build_report(session, start, end)
    report_cache.set(start, end, payload)
    logger.info("telemetry report computed from=%s to=%s", start.isoformat(), end.isoformat())
    return payload

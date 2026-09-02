"""Write-only ingest: validate per event, bulk-insert valid rows, one commit via get_db()."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends
from pydantic import ValidationError
from sqlmodel import Session

from inventory.database import get_db
import telemetry.config  # noqa: F401 — read TELEMETRY_ENDPOINT at import
from telemetry.mapping import to_row
from telemetry.models import TelemetryBatchEnvelope, TelemetryBatchOut, TelemetryEvent
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

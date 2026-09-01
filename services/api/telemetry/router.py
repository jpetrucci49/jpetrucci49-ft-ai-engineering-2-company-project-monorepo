"""Public stub: validate the envelope, log types, return 200. No persistence."""

from __future__ import annotations

import logging

from fastapi import APIRouter

import telemetry.config  # noqa: F401 — read TELEMETRY_ENDPOINT at import
from telemetry.models import TelemetryBatchIn, TelemetryBatchOut

logger = logging.getLogger(__name__)

router = APIRouter(tags=["telemetry"])


@router.post("/telemetry/events", response_model=TelemetryBatchOut)
def ingest_events(batch: TelemetryBatchIn) -> TelemetryBatchOut:
    types = ",".join(event.event_type for event in batch.events)
    logger.info("received=%s types=%s", len(batch.events), types)
    return TelemetryBatchOut(received=len(batch.events))

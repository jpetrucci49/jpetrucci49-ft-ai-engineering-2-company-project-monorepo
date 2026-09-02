"""Standard event envelope. Field names on TelemetryEvent are a contract — do not rename."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class TelemetryEvent(BaseModel):
    eventId: str
    timestamp: datetime
    sessionId: str
    userId: str | None
    event_type: str
    schemaVersion: str
    requestId: str
    properties: dict[str, Any] = Field(default_factory=dict)


class TelemetryBatchEnvelope(BaseModel):
    """Loose batch: items are validated one-by-one so a bad event does not 422 the rest."""

    events: list[TelemetryEvent]


class TelemetryBatchOut(BaseModel):
    received: int
    stored: int
    rejected: int

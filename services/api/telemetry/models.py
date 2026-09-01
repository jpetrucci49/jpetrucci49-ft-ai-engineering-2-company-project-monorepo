"""Standard event envelope. Reused as-is when persistence is added."""

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


class TelemetryBatchIn(BaseModel):
    events: list[TelemetryEvent]


class TelemetryBatchOut(BaseModel):
    received: int

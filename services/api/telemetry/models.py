"""Standard event envelope. Field names on TelemetryEvent are a contract — do not rename."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


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

    events: list[Any]


class TelemetryBatchOut(BaseModel):
    received: int
    stored: int
    rejected: int


class TelemetryReportPeriod(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    from_field: str = Field(alias="from")
    to: str


class EventsPerDayRow(BaseModel):
    date: str
    event_type: str
    count: int


class ErrorRateByTypeRow(BaseModel):
    date: str
    event_type: str
    errors: int
    total: int
    rate: float


class LatencyByDayRow(BaseModel):
    date: str
    route_template: str
    avg_ms: float
    count: int


class AuthFailureRateRow(BaseModel):
    date: str
    failures: int
    attempts: int
    rate: float


class TelemetryReportMetrics(BaseModel):
    events_per_day: list[EventsPerDayRow]
    error_rate_by_type: list[ErrorRateByTypeRow]
    latency_by_day: list[LatencyByDayRow]
    auth_failure_rate: list[AuthFailureRateRow]


class TelemetryReportOut(BaseModel):
    period: TelemetryReportPeriod
    metrics: TelemetryReportMetrics

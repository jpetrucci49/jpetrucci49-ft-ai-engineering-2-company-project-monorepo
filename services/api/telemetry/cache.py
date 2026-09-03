"""Process-local 60s TTL for GET /telemetry/report."""

from __future__ import annotations

import time
from datetime import datetime
from typing import Any

TTL_SECONDS = 60.0


class ReportCache:
    def __init__(self, ttl_seconds: float = TTL_SECONDS) -> None:
        self.ttl_seconds = ttl_seconds
        self._store: dict[tuple[str, str], tuple[float, dict[str, Any]]] = {}

    def _key(self, start: datetime, end: datetime) -> tuple[str, str]:
        return (start.isoformat(), end.isoformat())

    def get(self, start: datetime, end: datetime) -> dict[str, Any] | None:
        key = self._key(start, end)
        hit = self._store.get(key)
        if hit is None:
            return None
        expires_at, payload = hit
        if time.monotonic() >= expires_at:
            self._store.pop(key, None)
            return None
        return payload

    def set(self, start: datetime, end: datetime, payload: dict[str, Any]) -> None:
        self._store[self._key(start, end)] = (time.monotonic() + self.ttl_seconds, payload)

    def clear(self) -> None:
        self._store.clear()


report_cache = ReportCache()

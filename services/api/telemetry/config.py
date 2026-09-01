"""Read TELEMETRY_ENDPOINT so the frontend URL can change without a code change."""

from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)

TELEMETRY_ENDPOINT = os.getenv("TELEMETRY_ENDPOINT", "")

logger.info("TELEMETRY_ENDPOINT=%s", TELEMETRY_ENDPOINT or "(unset)")

export const SCHEMA_VERSION = "1.0.0";

export const SESSION_STORAGE_KEY = "healthcore_telemetry_session";

export const FLUSH_INTERVAL_MS = 10_000;
export const MAX_QUEUE = 20;
export const MAX_RETRIES = 3;
export const RETRY_BASE_MS = 500;

export const ERROR_DEDUPE_MS = 60_000;
export const THRESHOLD_THROTTLE_MS = 15 * 60_000;
export const LATENCY_ALWAYS_MS = 500;
export const LATENCY_SAMPLE_RATE = 0.1;

export const EXPIRY_WINDOW_DAYS = 30;

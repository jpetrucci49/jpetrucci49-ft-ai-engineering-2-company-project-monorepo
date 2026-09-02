-- Fallback DDL for Supabase SQL Editor (same shape as telemetry.table.TelemetryEventRow).
-- Prefer API startup create_all against SUPABASE_DATABASE_URL.

CREATE TABLE IF NOT EXISTS telemetry_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp timestamptz NOT NULL,
    service text NOT NULL,
    event_type text NOT NULL,
    level text NOT NULL DEFAULT 'info',
    value numeric NULL,
    message text NULL,
    tags jsonb NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT ck_telemetry_events_level CHECK (level IN ('info', 'warn', 'error'))
);

CREATE INDEX IF NOT EXISTS ix_telemetry_events_timestamp ON telemetry_events (timestamp);
CREATE INDEX IF NOT EXISTS ix_telemetry_events_event_type ON telemetry_events (event_type);
CREATE INDEX IF NOT EXISTS ix_telemetry_events_tags_gin ON telemetry_events USING gin (tags);

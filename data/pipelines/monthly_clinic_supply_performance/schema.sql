-- reporting schema for Monthly Clinic Supply Performance (Postgres).
-- SQLite uses the same columns without the reporting. prefix (see db.py).

CREATE SCHEMA IF NOT EXISTS reporting;

CREATE TABLE IF NOT EXISTS reporting.monthly_clinic_supply_performance (
  id uuid PRIMARY KEY,
  clinic_id text NOT NULL,
  country text NOT NULL,
  month_start date NOT NULL,
  total_supply_cost numeric NOT NULL DEFAULT 0,
  supply_consumption_count integer NOT NULL DEFAULT 0,
  critical_stockout_count integer NOT NULL DEFAULT 0,
  expiry_risk_count integer NOT NULL DEFAULT 0,
  currency text NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, month_start)
);

CREATE TABLE IF NOT EXISTS reporting.pipeline_runs (
  id uuid PRIMARY KEY,
  pipeline_name text NOT NULL,
  month_start date NOT NULL,
  started_at timestamptz NOT NULL,
  finished_at timestamptz,
  status text NOT NULL,
  records_read integer NOT NULL DEFAULT 0,
  records_written integer NOT NULL DEFAULT 0,
  error_message text,
  prefect_flow_run_id text
);

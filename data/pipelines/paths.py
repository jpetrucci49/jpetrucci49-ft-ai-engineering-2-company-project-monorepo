"""Repo paths for pipeline I/O. data/raw = extracts; data/eval = validation snapshots."""

from __future__ import annotations

import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
API_ROOT = REPO_ROOT / "services" / "api"
DATA_DIR = REPO_ROOT / "data"
RAW_DIR = DATA_DIR / "raw"
EVAL_DIR = DATA_DIR / "eval"
PROCESS_DIR = DATA_DIR / "process"
SAMPLE_EVENTS_PATH = RAW_DIR / "telemetry_events_sample.json"
LOCAL_REPORTING_DB = RAW_DIR / "reporting.db"

# Prefect 3 persists cache/results under PREFECT_HOME; keep it inside the repo.
_PREFECT_HOME = REPO_ROOT / ".prefect"
_PREFECT_HOME.mkdir(parents=True, exist_ok=True)
(_PREFECT_HOME / "storage").mkdir(parents=True, exist_ok=True)
os.environ.setdefault("PREFECT_CLI_PROMPT", "false")
os.environ["PREFECT_HOME"] = str(_PREFECT_HOME)
os.environ["PREFECT_RESULTS_LOCAL_STORAGE_PATH"] = str(_PREFECT_HOME / "storage")


def ensure_import_paths() -> None:
    for path in (str(REPO_ROOT), str(API_ROOT)):
        if path not in sys.path:
            sys.path.insert(0, path)


def extract_path_for(month_start) -> Path:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    return RAW_DIR / f"extract_{month_start}.json"


def kpis_path_for(month_start) -> Path:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    return RAW_DIR / f"kpis_{month_start}.json"


def eval_snapshot_path_for(month_start) -> Path:
    EVAL_DIR.mkdir(parents=True, exist_ok=True)
    return EVAL_DIR / f"monthly_clinic_supply_performance_{month_start}.json"


def last_run_log_path() -> Path:
    EVAL_DIR.mkdir(parents=True, exist_ok=True)
    return EVAL_DIR / "last_run.json"

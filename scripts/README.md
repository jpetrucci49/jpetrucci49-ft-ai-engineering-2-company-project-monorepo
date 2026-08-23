# `scripts` folder

This folder contains **helper scripts** for the monorepo: development automation, maintenance utilities, repetitive tasks (setup, lint, migrations, data generation, etc.), and internal tooling.

- **Main purpose**: group support tools that do not belong to a specific app, agent, or pipeline but make the team’s work easier.
- **Recommendation**: document each script (what it does, parameters, requirements, usage examples) and keep them reproducible (and safe) across environments.

## Python environment (uv)

Python scripts in this folder use **[uv](https://docs.astral.sh/uv/)** for dependency management. Configuration lives at the **repository root** — not in this folder.

| File | Purpose |
| --- | --- |
| `pyproject.toml` | Declares Python version and dependencies (e.g. `pandas`) |
| `uv.lock` | Locked dependency versions — commit this file |
| `.python-version` | Pin for local Python 3.12 |
| `.venv/` | Virtual environment created by `uv sync` (gitignored) |

### Setup

From the repository root:

```bash
uv sync
```

### Adding a dependency

From the repository root:

```bash
uv add <package-name>
```

## Scripts

| Script | Milestone | Purpose |
| --- | --- | --- |
| `analyze.py` | M5 | Offline aggregate analysis of `incidents.csv` |
| `seed_incidents.py` | M11 | Load validated CSV rows into the incident manager TinyDB |

---

### `analyze.py`

HealthCore patient incident CSV analysis CLI. Shares business rules with `services/api/app/incidents/analysis.py` and the M5 upload API.

**Requirements:** root `uv sync` (pandas only).

```bash
uv run python scripts/analyze.py scripts/incidents.csv
```

Optional: pass a different CSV path as the first argument.

Expected for `scripts/incidents.csv`: 100 total records, 94 valid, 6 invalid, average satisfaction 3.58.

---

### `seed_incidents.py`

Idempotent seeder for the **incident manager** (M11). Reads `scripts/incidents.csv`, validates each row with the same rules as M5 analysis (`services/api/app/incidents/csv_validation.py`), transforms valid rows into incident records, and inserts them into `services/api/incidents.json`.

**Requirements:** the **API virtualenv** (`services/api`) — the script imports FastAPI app modules and writes via TinyDB.

**Does not** store raw CSV, `patient_id`, or CSV enum values. Invalid or unmapped rows are counted as rejected, not inserted.

```bash
# from services/api/ (recommended)
uv run python ../../scripts/seed_incidents.py

# from repo root
uv run --directory services/api python ../../scripts/seed_incidents.py

# optional custom CSV path
uv run --directory services/api python ../../scripts/seed_incidents.py /path/to/incidents.csv
```

| Run | Expected output |
| --- | --- |
| First run | `inserted: 94`, `rejected: 6` |
| Later runs | `inserted: 0`, `skipped (duplicate): 94`, `rejected: 6` |

**Reset database:** from `services/api/`, delete `incidents.json` and run the seeder again. Override the TinyDB path with `INCIDENTS_DB_PATH` in `services/api/.env`.

After seeding, `GET /api/incidents/summary` should report **94** incidents — status `open` 28, `resolved` 52, `discarded` 14; categories `patient_experience` 61, `billing_error` 20, `other` 13. See `context/11_CONTEXT.md` and [`services/api/README.md`](../services/api/README.md#incident-manager-m11) for API endpoints and UI routes.

Spec: `specs/11_SPECS.md` §9.

---

### `incidents.csv`

Sample patient-incident export used across M5 and M11:

| Consumer | How it is used |
| --- | --- |
| `analyze.py` | Offline CLI report |
| M5 API | `POST /api/incidents/analyze` (backoffice CSV upload) |
| `seed_incidents.py` | Historical data for the incident manager |

100 rows: **94 valid**, **6 invalid** (validation failures — same rules as M5).

> _Spanish version: [README.es.md](./README.es.md)._

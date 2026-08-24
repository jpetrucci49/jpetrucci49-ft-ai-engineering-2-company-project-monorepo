# HealthCore API

FastAPI service for internal HealthCore Digital tools:

| Milestone | Feature | Backoffice route |
| --- | --- | --- |
| M5 | Patient incident CSV analysis | `/incidents` |
| M6 | Supplier directory (TinyDB) | `/suppliers` |
| M7 | JWT auth + route protection | — |
| M8 | Frontend auth (login, guards, BFF token forward) | `/login`, `/account/profile` |
| M9 | Password reset + change | `/forgot-password`, `/reset-password`, `/account/change-password` |
| M11 | Incident manager (TinyDB lifecycle CRUD) | `/incidents/register`, `/incidents/manage`, `/incidents/summary` |
| M12 | Error handling hardening | Field-specific validation messages, BFF error proxy, UI error states |
| M5.5 | Medical supply inventory (SQLModel + Postgres/SQLite) | API only (`/inventory`) — no UI this milestone |

## Stack

| Item | Value |
| --- | --- |
| Framework | FastAPI · Python 3.12+ · [uv](https://docs.astral.sh/uv/) |
| Port | `8000` |
| Storage | TinyDB — `suppliers.json`, `auth.json`, `incidents.json` (gitignored); SQLModel — inventory tables on Postgres (Supabase) or local SQLite |
| Auth | PyJWT (HS256) + libpass bcrypt |
| Inventory ORM | SQLModel + `psycopg` (Postgres) or SQLite for local/CI |

## Quick start

```bash
cd services/api
uv sync
cp .env.example .env          # set JWT_SECRET and SUPABASE_DATABASE_URL
uv run seed                   # load 15 suppliers (idempotent)
uv run --env-file .env uvicorn app.main:app --reload --port 8000
```

Incident manager seed: [`scripts/README.md`](../../scripts/README.md#seed_incidentspy). Inventory seed: `uv run --env-file .env python seed_inventory.py` (register a user first).

From the repo root: `npm run dev:api` (loads `services/api/.env`).

OpenAPI docs: [http://localhost:8000/docs](http://localhost:8000/docs)

The API fails fast at startup if `JWT_SECRET` is missing, if password-reset / email env vars are incomplete (see below), or if `SUPABASE_DATABASE_URL` is missing (inventory schema).

## Authentication (M7)

Stateless bearer JWT. Public routes: `POST /users`, `POST /auth/login`, password recovery routes (M9), and docs. Everything else requires `Authorization: Bearer <token>`.

| Method | Path | Access |
| --- | --- | --- |
| `POST` | `/users` | Public — register user + profile |
| `POST` | `/auth/login` | Public — OAuth2 form (`username` = email) |
| `POST` | `/auth/forgot-password` | Public — request reset link (always **200**) |
| `POST` | `/auth/reset-password` | Public — set new password with reset token |
| `POST` | `/auth/change-password` | Authenticated — change password with current password |
| `GET` | `/auth/me` | Authenticated |
| `GET/PUT` | `/profiles/me` | Owner |
| `GET` | `/users` | Admin |
| `GET/PUT/DELETE` | `/users/{id}` | Self or admin |

All supplier and incident endpoints require a valid token when called on FastAPI directly. Internal apps attach the token via `authFetch` and the Next.js BFF forwards the `Authorization` header.

### Auth smoke test

```bash
BASE=http://127.0.0.1:8000

curl -s -X POST "$BASE/users" -H 'Content-Type: application/json' \
  -d '{"email":"ops@example.com","password":"securepass123","name":"Ops User"}'

TOKEN=$(curl -s -X POST "$BASE/auth/login" \
  -d 'username=ops@example.com&password=securepass123' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

curl -s "$BASE/suppliers" -H "Authorization: Bearer $TOKEN"
```

**First admin:** edit `auth.json` while the API is stopped, set `"role": "admin"`, restart. Spec: `specs/07_SPECS.md`.

## Password recovery and change (M9)

Spec: `specs/09_SPECS_BACK.md`.

Reset tokens are opaque, single-use, and stored hashed in TinyDB (`password_reset_tokens` table in `auth.json`). The `/auth/forgot-password` endpoint always returns **200** with the same message — it never reveals whether an email is registered. If email delivery fails for a registered user, the API logs the error, **revokes the unused token**, and still returns **200** (anti-enumeration).

### Environment variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `RESET_TOKEN_EXPIRE_MINUTES` | No | `30` | Reset link lifetime (15–60) |
| `PASSWORD_RESET_URL` | **Yes** | — | Frontend reset page, e.g. `http://localhost:3001/reset-password` |
| `RESEND_API_KEY` | **Yes** | — | [Resend](https://resend.com/) API key |
| `RESEND_FROM_EMAIL` | **Yes** | — | Verified or onboarding sender |

Create a free [Resend](https://resend.com/) account, copy the API key, and use Resend’s onboarding sender (e.g. `onboarding@resend.dev`) until you verify a custom domain.

### Testing

#### API (curl)

```bash
BASE=http://127.0.0.1:8000

# Request reset link (always 200 — same body whether or not the email exists)
curl -s -X POST "$BASE/auth/forgot-password" \
  -H 'Content-Type: application/json' \
  -d '{"email":"ops@example.com"}'

# Invalid email format → 422
curl -s -w "\nHTTP %{http_code}\n" -X POST "$BASE/auth/forgot-password" \
  -H 'Content-Type: application/json' \
  -d '{"email":"not-an-email"}'

# Use token from the reset email:
curl -s -X POST "$BASE/auth/reset-password" \
  -H 'Content-Type: application/json' \
  -d '{"token":"<token-from-email>","new_password":"newsecurepass123"}'

# Second use of the same token → 400
curl -s -w "\nHTTP %{http_code}\n" -X POST "$BASE/auth/reset-password" \
  -H 'Content-Type: application/json' \
  -d '{"token":"<token-from-email>","new_password":"anotherpass123"}'

# Log in, then change password while authenticated:
TOKEN=$(curl -s -X POST "$BASE/auth/login" \
  -d 'username=ops@example.com&password=newsecurepass123' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

curl -s -X POST "$BASE/auth/change-password" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"current_password":"newsecurepass123","new_password":"anothersecurepass123"}'

# Wrong current password → 400
curl -s -w "\nHTTP %{http_code}\n" -X POST "$BASE/auth/change-password" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"current_password":"wrong","new_password":"xpass1234"}'
```

| Step | Expected |
| --- | --- |
| `forgot-password` with registered email | **200** + generic message; email in Resend dashboard / inbox |
| `forgot-password` with unknown email | **200** + identical message; no email |
| `forgot-password` with invalid email | **422** |
| `reset-password` with valid token | **200**; login works with new password |
| `reset-password` with reused/expired token | **400** |
| `change-password` without bearer | **401** |
| `change-password` with wrong current | **400** |
| `change-password` with correct current | **200** |

#### UI (internal apps)

With `npm run dev`, test in the browser on `:3001` (backoffice) or `:3002` (tracker). Full UI checklist: root [`README.md`](../../README.md#testing-password-recovery-and-change-m9).

Ensure `PASSWORD_RESET_URL` matches the app under test (e.g. `http://localhost:3001/reset-password`).

## Supplier directory (M6)

Models in `models.py`, TinyDB in `database.py`, seed data from `context/06_CONTEXT.md`.

```bash
uv run seed                              # from services/api/
uv run --directory services/api seed     # from repo root
```

| Run | Expected |
| --- | --- |
| First run | `15 supplier(s) inserted` |
| Later runs | `0 inserted` with `15 total` — already loaded |

Reset: `rm -f suppliers.json && uv run seed`. Override path with `SUPPLIERS_DB_PATH` (see `.env.example`).

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/suppliers` | Register supplier |
| `GET` | `/suppliers` | List; optional `?country=` and `?category=` |
| `GET` | `/suppliers/{id}` | Detail |
| `PATCH` | `/suppliers/{id}/rate` | Update `monthly_rate` |
| `PATCH` | `/suppliers/{id}/status` | Set `active` or `suspended` |
| `DELETE` | `/suppliers/{id}` | Remove supplier |

All supplier routes require a bearer token. UI: `uis/backoffice/app/suppliers/`.

Specs: `specs/06_SPECS_*.md`.

## Medical supply inventory (M5.5)

Spec: `specs/05.5_SPECS.md` · Context: `context/05.5_CONTEXT.md`

Dual-database backend: **TinyDB remains the auth store**; inventory lives in **PostgreSQL via SQLModel** (Supabase in shared environments, SQLite for local/CI). Auth lookups never hit SQL; inventory queries never read TinyDB user tables. Every delivery and consumption stores `user_uuid` as `str(current_user.id)` from the JWT.

`current_stock` is **computed**, never stored: `SUM(deliveries) − SUM(consumptions)` per supply, across all clinics. There is no endpoint that sets stock directly.

### Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `SUPABASE_DATABASE_URL` | **Yes** | psycopg3 URI (`postgresql+psycopg://…`), or `sqlite:///./inventory.db` for local development |

```bash
# Session pooler (IPv4). Copy from Dashboard → Connect → Session pooler, then use the psycopg3 dialect.
SUPABASE_DATABASE_URL=postgresql+psycopg://postgres.<project-ref>:[password]@aws-0-[region].pooler.supabase.com:5432/postgres?sslmode=require

# Local without Postgres
# SUPABASE_DATABASE_URL=sqlite:///./inventory.db
```

`create_all()` runs at API startup for local/learning environments. Do **not** use it against a shared production database — use Alembic (or equivalent) in production.

### Seed

Register at least one TinyDB user first (`POST /users` or backoffice `/register`), then:

```bash
cd services/api
uv run --env-file .env python seed_inventory.py
# or:
uv run --env-file .env seed-inventory

# Dev reset (drops inventory tables, then re-seeds)
uv run --env-file .env python seed_inventory.py --reset
```

From repo root: `uv run --directory services/api python seed_inventory.py`.

Idempotent by SKU for catalogue rows. Movements are inserted only when the deliveries table is empty.

Expected after a clean seed: six supplies; `HCR-PPE-001` stock **50**; `HCR-PPE-002` stock **16**; `HCR-WND-001` stock **15**; remaining SKUs **0**.

**Reset:** `--reset` (dev only) or delete the local SQLite file (`rm -f inventory.db`) and re-run the seeder. Do not drop a shared Supabase database casually.

### Endpoints

All routes require `Authorization: Bearer <token>`. Paths use `products` / `orders`; entities remain `MedicalSupply`, `SupplyDelivery`, `SupplyConsumption`.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/inventory/products` | List supplies with computed `current_stock` |
| `POST` | `/inventory/products` | Register a supply (stock starts at 0) |
| `GET` | `/inventory/products/{id}` | One supply + `current_stock` |
| `POST` | `/inventory/orders/inbound` | Log a vendor delivery |
| `POST` | `/inventory/orders/outbound` | Log clinical consumption (rejects negative stock) |
| `GET` | `/inventory/orders` | List deliveries and consumptions with supply data |

Insufficient stock → **400** with `Insufficient stock for supply '{name}'. Available: {available}, requested: {quantity}.` Duplicate SKU → **409**. Validation errors follow M12 (sanitized field messages; HTTP **400**).

### Tests

```bash
cd services/api && uv run pytest tests/test_inventory.py -v
```

Tests use **in-memory SQLite** (no live Supabase in CI). Postgres-specific dialect behaviour is not exercised.

```text
Browser / curl
    │  Bearer JWT
    ▼
FastAPI
    ├── get_current_user ──► TinyDB (auth.json)
    │         └── user.id → user_uuid on writes
    └── get_db ──► SQLModel session ──► Postgres / SQLite
              ├── MedicalSupply
              ├── SupplyDelivery
              └── SupplyConsumption
```

## Incident analysis (M5)

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/incidents/analyze` | Upload CSV → JSON summary |
| `GET` | `/api/incidents/results/export` | Download last analysis as CSV |

Business rules live in `app/incidents/analysis.py` (shared with `scripts/analyze.py`). Last result is **in-memory** — restart clears it.

**PHI policy:** Never store, log, or return `patient_id` or `description` — aggregates only.

```bash
curl -X POST http://127.0.0.1:8000/api/incidents/analyze \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@../../scripts/incidents.csv"
```

Expected for `scripts/incidents.csv`: 100 total, 94 valid, 6 invalid, avg satisfaction 3.58.

## Incident manager (M11)

Spec: `specs/11_SPECS.md` · Context: `context/11_CONTEXT.md`

Persistent incident lifecycle in TinyDB (`incidents.json`). Shared CSV validation lives in `app/incidents/csv_validation.py` (also used by M5 analysis). **Seed data:** [`scripts/README.md`](../../scripts/README.md#seed_incidentspy).

Post-seed summary (`GET /api/incidents/summary`): **94** incidents — status `open` 28, `resolved` 52, `discarded` 14; categories `patient_experience` 61, `billing_error` 20, `other` 13.

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/incidents` | Register incident |
| `GET` | `/api/incidents` | List; optional `?status=`, `?origin=`, `?branch=`, `?category=` |
| `GET` | `/api/incidents/summary` | Aggregates by status, category, origin, branch |
| `GET` | `/api/incidents/{id}` | Detail |
| `PATCH` | `/api/incidents/{id}/status` | Lifecycle update (`open` → `in_progress`/`discarded`; `in_progress` → `resolved`/`discarded`) |

All manager routes require a bearer token. UI: `uis/backoffice/app/(authenticated)/incidents/`.

**PHI policy:** Do not store or return patient identifiers. Registration UI shows a mandatory warning on the description field.

Shared TypeScript constants: `packages/shared/incidents/` (`@healthcore/incidents` in backoffice).

## Error handling and validation (M12)

Spec / audit: `specs/12_SPECS.md` · Progress: `memory-bank/progress.md` § M12.

| Area | Behaviour |
| --- | --- |
| Validation errors | `400` with `detail` array; messages name the field (e.g. `Title should have at least 1 character`) — no submitted `input` echoed |
| Unhandled errors | `500` with generic `"An unexpected error occurred."` |
| Password reset | Failed email send → token revoked, logged; HTTP **200** unchanged for enumeration safety |

Humanization logic: `app/core/validation_errors.py`. Tests: `tests/test_validation_errors.py`.

Example — empty title on incident create:

```bash
curl -s -X POST "$BASE/api/incidents" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"","description":"x","category":"other","origin":"internal","branch":"central"}' | jq .
# detail[0].msg → "Title should have at least 1 character"
```

## Automated tests

From `services/api/`:

```bash
uv sync --group dev
uv run pytest                # full suite (includes inventory)
uv run pytest tests/test_inventory.py -v
uv run pytest tests/test_validation_errors.py -v   # M12 field-labelled messages
```

Full test plan and manual M12 checks: root [`TESTING.md`](../../TESTING.md).

## CORS and architecture

CORS defaults cover `localhost:3001` and Codespaces (`*.github.dev`). The backoffice normally proxies server-side, so CORS is not required for standard UI flows.

```text
Browser → backoffice :3001 /api/{incidents,suppliers}/*
       → Next.js BFF (server-side, forwards Authorization)
       → FastAPI :8000
```

`/api/incidents` (no suffix) proxies to the M11 manager; `/api/incidents/analyze` and `/api/incidents/results/export` remain M5 CSV analysis.

## Project layout

```text
services/api/
  app/main.py           ← FastAPI app + validation error handler
  app/core/validation_errors.py  ← Field-specific API error messages (M12)
  auth/                 ← JWT module (M7) + password reset (M9)
  routes/               ← auth, users, profiles, suppliers
  app/incidents/        ← csv_validation, analysis (M5), manager (M11)
  inventory/            ← SQLModel inventory (M5.5) — models, schemas, service, router
  incidents_database.py ← Incident manager TinyDB
  models.py             ← Supplier Pydantic models
  database.py           ← Supplier TinyDB
  seed.py               ← Supplier seeder
  seed_inventory.py     ← Inventory seeder
  auth.json             ← Users + profiles (gitignored)
  suppliers.json        ← Suppliers (gitignored)
  incidents.json        ← Incidents (gitignored)
  inventory.db          ← Local SQLite inventory (gitignored; optional)
```

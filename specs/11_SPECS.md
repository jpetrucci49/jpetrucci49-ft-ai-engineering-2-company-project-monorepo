# SPECS — Milestone 11: Centralized Incident Manager

Implementation specification for the HealthCore **incident lifecycle manager** (CRUD, seeding, backoffice UI). Build exactly what is described below.

**Prerequisite:** M5 incident CSV analysis (`app/incidents/analysis.py`), M7–M8 auth, M6 supplier patterns (TinyDB, BFF).  
**Authoritative domain data:** [`context/11_CONTEXT.md`](../context/11_CONTEXT.md) — branches, categories, statuses, origins, CSV mappings, seed expected totals.

---

## 1. Objective

Persist and manage operational incidents with a defined lifecycle and origin context. Leadership can filter and aggregate by status, category, origin, and branch. Legacy CSV rows are seeded via transformation — **never inserted raw**.

**Coexistence:** Keep existing M5 routes `POST /api/incidents/analyze` and `GET /api/incidents/results/export` (CSV aggregate analysis). M11 adds **manager** routes on the same `/api/incidents` prefix (list/create/detail/status/summary).

---

## 2. Required Reading

| File | Use |
| --- | --- |
| [`context/11_CONTEXT.md`](../context/11_CONTEXT.md) | Branches, categories, lifecycle, origins, CSV mappings, seed totals |
| `scripts/incidents.csv` | Seed input |
| `services/api/app/incidents/analysis.py` | Existing CSV validation — refactor source |
| `services/api/routes/suppliers.py` | TinyDB + router pattern |
| `uis/backoffice/app/incidents/` | Existing CSV analysis UI (do not remove) |
| `specs/06_SPECS_FRONTEND.md` | BFF proxy pattern |
| `AGENTS.md` | Pre-commit workflow |

---

## 3. Deliverables

| Item | Path |
| --- | --- |
| Context | `context/11_CONTEXT.md` (given) |
| Shared TS constants/helpers | `packages/shared/incidents/` |
| Shared CSV validation (Python) | `services/api/app/incidents/csv_validation.py` (extract from `analysis.py`) |
| Incident models | `services/api/app/incidents/models.py` (or `services/api/models_incidents.py`) |
| TinyDB access | `services/api/incidents_database.py` |
| Service layer | `services/api/app/incidents/manager.py` |
| Manager router | `services/api/app/incidents/manager_router.py` — mount in `app/main.py` |
| Seed script | `scripts/seed_incidents.py` (run with API venv — see §9) |
| Backoffice UI | `uis/backoffice/app/(authenticated)/incidents/…` (extend; add manager pages) |
| BFF routes | `uis/backoffice/app/api/incidents/…` (manager proxies) |

---

## 4. Data model — `Incident`

| Field | Type | Rules |
| --- | --- | --- |
| `id` | `int` | Auto-generated TinyDB doc id |
| `title` | `string` | Required, non-empty, max 120 |
| `description` | `string` | Required, non-empty |
| `category` | enum | Values from CONTEXT § Incident Categories |
| `status` | enum | `open`, `in_progress`, `resolved`, `discarded` — default `open` on create |
| `origin` | enum | `customer`, `branch`, `internal` |
| `branch` | enum | Values from CONTEXT § HealthCore Clinics |
| `created_at` | `datetime` | UTC; set on create |
| `updated_at` | `datetime` | UTC; set on create; update on status change |

**Do not store:** CSV `incident_id`, `patient_id`, or any PHI.  
**Optional internal field (not exposed in API responses):** `seed_key` — idempotency key (`incident_id` from CSV, or `title|created_at` fallback); used only for seed dedup.

Display labels for branches: use CONTEXT table (e.g. `central` → `Central — Austin Main Clinic`).

---

## 5. Lifecycle

| From | Allowed to |
| --- | --- |
| `open` | `in_progress`, `discarded` |
| `in_progress` | `resolved`, `discarded` |
| `resolved` | _(none — final)_ |
| `discarded` | _(none — final)_ |

Invalid transition → `400` with plain-language message naming current and requested status.

---

## 6. Shared validation extraction

### 6.1 Python — `services/api/app/incidents/csv_validation.py`

Extract from `analysis.py` (keep `analyze()` and metrics there; import validation):

- `validate_record(row) -> list[str]` (rule keys)
- `validate_columns(df) -> list[str]`
- `load_incidents_from_bytes(content: bytes) -> DataFrame`

Refactor `analysis.py` to import these. `seed_incidents.py` uses the same module — **one validation implementation**.

### 6.2 TypeScript — `packages/shared/incidents/`

Export for backoffice (and future apps):

- Enum constants: `categories`, `statuses`, `origins`, `branches`
- `BRANCH_LABELS`, `CATEGORY_LABELS` (from CONTEXT)
- `isValidStatusTransition(from, to): boolean`
- Optional: client-side form validators mirroring API rules

---

## 7. Backend — persistence

- TinyDB file: `services/api/incidents.json` (default); override via `INCIDENTS_DB_PATH`
- Table: `incidents`
- Pattern: mirror `database.py` / `auth/database.py` singleton reset for tests
- All manager endpoints require `get_current_user` (same as suppliers)

---

## 8. Backend — endpoints

Base path: `/api/incidents`. Register static paths (`/summary`) **before** `/{id}`.

| Method | Path | Behaviour |
| --- | --- | --- |
| `POST` | `/api/incidents` | Create incident. Body: all model fields except `id`, `created_at`, `updated_at`. Validate enums and required strings. `201` + created record. |
| `GET` | `/api/incidents` | List all. Optional query: `status`, `origin`, `branch`, `category` (exact match). Empty DB → `[]`. Sort by `created_at` desc. |
| `GET` | `/api/incidents/summary` | Aggregates: totals by `status`, `category`, `origin`, `branch`. Empty DB → zero counts per bucket, not an error. |
| `GET` | `/api/incidents/{id}` | Detail. `404` if missing. |
| `PATCH` | `/api/incidents/{id}/status` | Body: `{ "status": "…" }` only. Enforce lifecycle (§5). Update `updated_at`. |

**Validation errors (`400`):** JSON `{ "detail": [ { "loc": ["body", "field"], "msg": "…" } ] }` or equivalent field-keyed object — plain language, no stack traces.

**Unhandled errors (`500`):** `{ "detail": "An unexpected error occurred." }` — never expose stack traces.

---

## 9. Seed script — `scripts/seed_incidents.py`

```bash
cd services/api && uv run python ../../scripts/seed_incidents.py
# or from repo root:
uv run --directory services/api python ../../scripts/seed_incidents.py
```

**Input:** `scripts/incidents.csv` (repo root).

**Flow:**

1. Load CSV via `load_incidents_from_bytes`
2. For each row: run `validate_record` — if any violations, skip row (count for report)
3. Transform valid rows per CONTEXT § Historical Data (field, status, category, branch mappings)
4. Derive `title` = first 120 chars of `description` (trim); skip if empty
5. Set `origin` = `customer`, `created_at`/`updated_at` from CSV `date` (midnight UTC)
6. **Idempotent insert:** skip if `seed_key` (= CSV `incident_id`, else `title|created_at`) already exists
7. Print summary: inserted, skipped (duplicate), rejected (invalid/unmapped)

**Do not** insert invalid CSV rows. **Do not** store `patient_id` or raw CSV enums.

**Post-seed verification:** `GET /api/incidents/summary` totals must match CONTEXT § Expected Values After Seeding (94 records; status and category counts as specified).

---

## 10. Frontend — `uis/backoffice/`

Authenticated routes only. BFF proxies to FastAPI with `Authorization` header (same pattern as suppliers/incidents analyze).

### 10.1 Navigation

Add menu links (labels in English):

- **Register incident** — e.g. `/incidents/register`
- **Incident list** — e.g. `/incidents/manage` (or extend existing `/incidents` with tabs — avoid breaking CSV analysis page)
- **Summary** — e.g. `/incidents/summary` or combined dashboard section

Keep existing **CSV analysis** page functional at its current route.

### 10.2 Registration form

- All model fields: `title`, `description`, `category`, `origin`, `branch`, `status` (default `open` on create — may be hidden or fixed to `open`)
- **Branch:** required select; all CONTEXT branches with display labels
- **Origin = `branch`:** highlight `branch` field (visual emphasis)
- **PHI warning:** prominent notice above `description` (CONTEXT compliance requirement — not optional)
- Submit: loading state, disable button while pending
- Success: clear form + confirmation message
- Error: user-friendly message via `parseApiError` / field errors — never raw server text

### 10.3 Incident list

- Fetch `GET /api/incidents` with filters: `status`, `origin`, `branch`
- Loading, error + retry, empty state (no blank table)
- Per row: inline status update via `PATCH …/status`; revert UI + notify on failure
- Only show transitions allowed by lifecycle (disable invalid options)

### 10.4 Summary panel

- Fetch `GET /api/incidents/summary`
- Display totals by status, category, origin, branch
- Loading and error states without breaking page shell

### 10.5 Layout (target)

```text
uis/backoffice/
  app/(authenticated)/incidents/
    register/page.tsx
    manage/page.tsx          # list + filters
    summary/page.tsx
  app/api/incidents/
    route.ts                 # GET list, POST create
    summary/route.ts
    [id]/route.ts
    [id]/status/route.ts
  components/incidents/
    IncidentRegisterForm.tsx
    IncidentListPanel.tsx
    IncidentSummaryPanel.tsx
  lib/api/incidents-manager.ts
packages/shared/incidents/
  index.ts
  constants.ts
  labels.ts
  lifecycle.ts
```

---

## 11. Error handling (mandatory)

| Case | Response |
| --- | --- |
| Invalid field / enum / transition | `400`, field-identified message |
| Not found | `404` |
| Unhandled exception | `500`, generic message only |
| Empty database on read | `[]` or zeroed summary — never `500` |

Global exception handler in FastAPI if not already present for manager routes.

---

## 12. Quality gates

```bash
cd services/api && uv run python ../../scripts/seed_incidents.py && uv run pytest   # when tests added
npm run lint --prefix uis/backoffice && npm run build --prefix uis/backoffice
```

Manual checks:

- [ ] Seed twice → second run inserts 0 duplicates
- [ ] Summary matches CONTEXT expected totals after seed
- [ ] Invalid status transition rejected
- [ ] Form PHI warning visible
- [ ] CSV analyze/export (M5) still works

---

## 13. Acceptance checklist

### Backend

- [ ] `Incident` model with all required fields
- [ ] TinyDB persistence + `seed_incidents.py` (idempotent)
- [ ] CSV validation extracted; shared with analyzer
- [ ] All five manager endpoints implemented
- [ ] Lifecycle enforced on PATCH status
- [ ] Error handling per §11

### Shared

- [ ] `packages/shared/incidents/` — constants, labels, transition helper
- [ ] `csv_validation.py` extracted; `analysis.py` refactored

### Frontend

- [ ] Registration form with PHI warning and branch/origin UX
- [ ] List with filters, status updates, empty/error/loading states
- [ ] Summary panel with aggregates
- [ ] BFF routes; auth forwarded

### Data

- [ ] Field values match CONTEXT exactly
- [ ] Post-seed summary matches expected counts (94 valid rows)

---

## 14. Hard constraints

| Rule | Detail |
| --- | --- |
| CONTEXT is source of truth | Branches, categories, mappings, labels |
| No PHI | No patient identifiers in DB, API, logs, or UI persistence |
| No raw CSV insert | Transform + validate first |
| Idempotent seed | Safe to re-run |
| Do not break M5 | CSV analyze/export endpoints remain |
| Protected routes | Auth required on manager API |

---

## 15. Out of scope

- Automatic alerts for `compliance_breach`
- Patient/satisfaction fields from legacy CSV (analysis only)
- Multilingual UI (English required)
- Deleting incidents
- Talent tracker / public website incident UI
- CI changes unless programme requires

# Error Handling Audit Report

Repository-wide review of `/uis/`, `/services/api/`, `/scripts/`, `/packages/`, and `/src/utils/`. Findings are ordered **CRITICAL → HIGH → MEDIUM → LOW** within each severity band.

---

## CRITICAL

| File | Lines | Category | Problem | Suggested fix |
|------|-------|----------|---------|---------------|
| `services/api/auth/services/password_reset.py` | 107–117 | **SILENT FAILURE** | Email send failures are caught with `except Exception`, logged, and swallowed; `/auth/forgot-password` still returns **200** with a success message. | Propagate a delivery failure to the route (or queue retry/dead-letter); return a distinct error or alert ops while keeping anti-enumeration semantics. |
| `services/api/routes/auth.py` | 65–68 | **SILENT FAILURE** (downstream) | Route unconditionally returns `FORGOT_PASSWORD_MESSAGE` after `request_password_reset()`, masking email delivery failure. | Only return success when delivery is confirmed; otherwise log/alert and return a safe generic error or retry path. |
| `services/api/app/main.py` | 45–47 | **SENSITIVE DATA LEAK** | Global validation handler returns `exc.errors()` verbatim, including Pydantic's `input` field with submitted body values (incident descriptions, profile phone/address, passwords on malformed requests). | Strip `input`/`ctx` from error payloads; return `{loc, msg, type}` only, or a single generic validation message. |
| `uis/backoffice/app/api/**/route.ts` (all BFF proxies) | e.g. `incidents/route.ts` 18–40 | **SENSITIVE DATA LEAK** (pass-through) | BFF routes forward upstream JSON unchanged via `proxyResponse`, so validation responses with `input` reach the browser. | Sanitize `detail` arrays in the BFF before forwarding, or fix at the FastAPI handler (above). |

---

## HIGH

| File | Lines | Category | Problem | Suggested fix |
|------|-------|----------|---------|---------------|
| `uis/website/app/global-error.tsx` | 14 | **RAW ERROR EXPOSURE** | Renders `{error.message}` directly to end users; may expose internal Next.js/React errors. | Show a generic user-facing message; log `error.message`/`digest` server-side only. |
| `uis/backoffice/app/api/**/route.ts` | 23 routes, e.g. `auth/login/route.ts` 10–27, `incidents/route.ts` 18–40, `suppliers/route.ts` 15–30 | **OVERLY BROAD CATCH** | Entire handler wrapped in bare `catch {}`; JSON parse errors, body read failures, and network errors all become indistinguishable **502** responses. | Catch `fetch`/`TypeError` separately; let/request validation errors return **400**; log unexpected errors. |
| `scripts/seed_incidents.py` | 111–144 | **MISSING TRY/CATCH** + **MISSING sys.exit ON SCRIPT FAILURE** | `load_incidents_from_bytes()` and `create_incident()` are uncaught; failures produce Python tracebacks with no friendly message (non-zero exit, but poor operability). | Wrap `main()` body in `try/except`, print actionable stderr message, `return 1`. |
| `scripts/analyze.py` | 116–126 | **MISSING TRY/CATCH** | `analyze(df)` and `export_csv()` are uncaught after file read; runtime/analysis/write errors crash with traceback. | Wrap in `try/except`, print user-friendly error to stderr, `return 1`. |
| `uis/talent-pipeline-tracker/app/(authenticated)/candidates/[id]/page.tsx` | 21–26 | **RAW ERROR EXPOSURE** + **NO USER CALL TO ACTION** | Server component displays `fetchError.message` (may include raw API `detail`) with no retry or navigation. | Map to safe messages; add "Back to pipeline" link and retry/reload action. |
| `uis/backoffice/components/auth/ProfileForm.tsx` | 91–96 | **NO USER CALL TO ACTION** | Initial load failure shows error text only; no retry button (talent tracker `ProfileForm.tsx` 87–96 same). | Add a Retry button calling `loadProfile()`. |
| `uis/backoffice/components/suppliers/SupplierDirectoryPage.tsx` | 164–168 | **NO USER CALL TO ACTION** | List fetch error is displayed with no retry (though `reloadSuppliers` exists). | Add Retry button wired to `reloadSuppliers(filters)`. |
| `uis/talent-pipeline-tracker/components/candidates/CandidateListView.tsx` | 86–87 | **NO USER CALL TO ACTION** | Error `Alert` shown but `reload` from `useCandidateRecords` is never exposed in UI. | Add Retry button calling `reload()`. |
| `uis/backoffice/components/incidents/IncidentAnalysisPage.tsx` | 77–80, 102–108 | **NO USER CALL TO ACTION** | Upload/download errors shown without explicit retry (re-upload is possible but not guided). | Add Retry on download; clarify re-upload CTA on upload failure. |
| `uis/backoffice`, `uis/talent-pipeline-tracker` | — | **MISSING LOADING/ERROR UI STATES** | No `global-error.tsx` or `error.tsx` boundaries (only website has `global-error.tsx`); unhandled render errors have no app-level recovery UI. | Add `app/error.tsx` and/or `app/global-error.tsx` with reset action in both internal apps. |

---

## MEDIUM

| File | Lines | Category | Problem | Suggested fix |
|------|-------|----------|---------|---------------|
| `uis/backoffice/lib/api/incidents-manager.ts` | 35–90 | **MISSING TRY/CATCH** | `authFetch` / `response.json()` uncaught; network/parse failures bubble to callers (most callers handle, but library is fragile). | Optional: wrap with typed `IncidentsManagerApiError` for network/JSON failures. |
| `uis/backoffice/lib/api/incidents.ts` | 21–46 | **MISSING TRY/CATCH** | Same pattern for analyze/export helpers. | Same as above. |
| `uis/backoffice/lib/api/suppliers.ts` | 35–94 | **MISSING TRY/CATCH** | Same pattern for supplier CRUD. | Same as above. |
| `uis/talent-pipeline-tracker/lib/api/client.ts` | 31–53 | **MISSING TRY/CATCH** | `fetch` and `response.json()` uncaught; `getBaseUrl()` throws if `NEXT_PUBLIC_API_URL` missing. | Catch network/JSON errors; surface config-missing as a dedicated startup error. |
| `packages/shared/auth/fetch.ts` | 11 | **MISSING TRY/CATCH** | `fetch` not wrapped; network failures propagate as unhandled rejections if caller omits catch. | Document contract or add optional wrapper; audit all call sites. |
| `uis/backoffice/app/api/auth/login/route.ts` | 11 | **OVERLY BROAD CATCH** (misleading) | Malformed client JSON triggers outer `catch` → **502** "Unable to reach authentication API" instead of **400**. | Validate body outside network catch; return **400** for bad input. |
| `uis/backoffice/components/incidents/IncidentAnalysisPage.tsx` | 12–16 | **RAW ERROR EXPOSURE** | `getErrorMessage` forwards `Error.message` from API parsers, which may include upstream `detail` strings. | Use safe fallbacks; whitelist known user-safe messages. |
| `uis/backoffice/components/suppliers/SupplierDirectoryPage.tsx` | 20–24 | **RAW ERROR EXPOSURE** | Same `getErrorMessage` pattern surfacing API `detail`. | Map status codes to safe messages. |
| `uis/backoffice/components/suppliers/SupplierTable.tsx` | 178, 200 | **RAW ERROR EXPOSURE** | Inline rate/status update errors show `error.message` from API. | Use generic messages for 5xx; keep business-rule messages only for 4xx. |
| `uis/talent-pipeline-tracker/components/candidates/StatusStageControls.tsx` | 31–32 | **RAW ERROR EXPOSURE** | Pipeline update errors display raw `error.message`. | Same safe-message mapping. |
| `uis/talent-pipeline-tracker/components/candidates/NotesSection.tsx` | 45, 60 | **RAW ERROR EXPOSURE** | Note add/delete errors show raw `error.message`. | Same safe-message mapping. |
| `services/api/app/incidents/manager_router.py` | 91–96 | **RAW ERROR EXPOSURE** | `HTTPException(detail=str(exc))` forwards exception text (currently controlled messages, but fragile if internals change). | Map to fixed error constants at the router boundary. |
| `services/api/routes/users.py` | 18–21, 53–60, 68–71 | **RAW ERROR EXPOSURE** | `detail=str(exc)` on `ValueError`/`LookupError`/`PermissionError`. | Use explicit message constants per exception type. |
| `services/api/routes/profiles.py` | 37–40 | **RAW ERROR EXPOSURE** | `detail=str(exc)` on `LookupError`. | Use fixed `"Profile not found."` message. |
| `services/api/routes/auth.py` | 73–78, 88–98 | **RAW ERROR EXPOSURE** | `detail=str(exc)` on reset/change-password errors (messages are currently safe strings). | Replace with constants to prevent future leakage. |
| `uis/backoffice/components/incidents/IncidentSummaryPanel.tsx` | 128–129 | **MISSING LOADING/ERROR UI STATES** | `if (!summary) return null` renders blank content if summary is unexpectedly null after load. | Show empty-state or error fallback instead of `null`. |
| `uis/backoffice/components/utilities/UtilityTester.tsx` | 56–61 | **RAW ERROR EXPOSURE** | Displays `error.message` from JSON parse / utility execution (internal dev tool). | Acceptable for dev tool; optionally sanitize if exposed to non-engineers. |
| `scripts/analyze.py` | 112–113 | **SENSITIVE DATA LEAK** (low) | OSError handler prints `{exc}`, which may include filesystem paths. | Print generic "unable to read file" without exception text. |
| `services/api/seed.py` | 217–218 | **RAW ERROR EXPOSURE** (CLI) | Prints `{exc}` to stderr on failure; may expose internal paths/state. | Log full error internally; print generic message to user. |

---

## LOW

| File | Lines | Category | Problem | Suggested fix |
|------|-------|----------|---------|---------------|
| `packages/shared/auth/errors.ts` | 13–15, 34–35 | **SILENT FAILURES** (intentional) | Parse failures fall through to generic messages with no logging. | Acceptable for UX; optional debug logging in development. |
| `packages/shared/auth/cross-app.ts` | 14–15 | **SILENT FAILURES** (intentional) | Invalid URL in `buildAuthenticatedAppUrl` returns original URL silently. | Log in dev or validate URLs at call sites. |
| `uis/talent-pipeline-tracker/components/candidates/CandidateDetailView.tsx` | 40–42 | **SILENT FAILURES** (partial) | `handleReplace` catch returns `false` without preserving error detail (form shows generic message via `CandidateForm`). | Acceptable; optionally pass through error type for richer feedback. |
| `uis/talent-pipeline-tracker/components/candidates/RegisterCandidatePanel.tsx` | 22–24 | **SILENT FAILURES** (partial) | Swallows create errors; generic message via `CandidateForm`. | Acceptable pattern. |
| `uis/backoffice/components/auth/AuthGuard.tsx` | 26–27 | **MISSING LOADING/ERROR UI STATES** | Shows loading spinner indefinitely during redirect to login (no timeout/error if redirect fails). | Add timeout fallback or error state. |
| `skills/data-analysis/scripts/pandas_clean.py` | 8–30 | **MISSING TRY/CATCH** | Example snippet; uncaught I/O/pandas errors. | Add try/except + `sys.exit(1)` if promoted to operational script. |
| `src/utils/**` | — | — | Pure synchronous business logic; no I/O. **No findings.** | — |
| `packages/shared/incidents/**` | — | — | Client validation only; no runtime I/O. **No findings.** | — |
| `uis/website/**` (except `global-error.tsx`) | — | — | Static/marketing site; no `fetch` usage. **No findings.** | — |

---

## Cross-cutting patterns

### BFF proxy routes (backoffice + talent tracker)

All **23** Next.js API route handlers under `uis/*/app/api/` follow the same pattern: wrap the entire handler in `catch {}` and return a generic **502**. This is the single largest source of **OVERLY BROAD CATCH** and **misleading error** findings. Representative files:

- `uis/backoffice/app/api/incidents/route.ts` (lines 18–40)
- `uis/backoffice/app/api/auth/login/route.ts` (lines 10–27)
- `uis/talent-pipeline-tracker/app/api/auth/login/route.ts` (lines 10–27)

### Positive patterns (for context)

- `services/api/app/main.py` 50–55: unhandled **500** returns generic `"An unexpected error occurred."` ✓
- `services/api/app/incidents/router.py` 32–41: CSV parse errors mapped to safe **400** messages ✓
- `services/api/seed.py` 214–223: top-level `try/except` with `sys.exit(1)` ✓
- `uis/backoffice/components/incidents/IncidentListPanel.tsx` / `IncidentSummaryPanel.tsx`: loading spinners + retry ✓
- Most auth forms (`LoginForm`, `RegisterForm`, etc.): network catch with safe fallback message ✓

---

## Summary by category

| Category | CRITICAL | HIGH | MEDIUM | LOW |
|----------|----------|------|--------|-----|
| Silent failures | 2 | 0 | 0 | 3 |
| Sensitive data leaks | 2 | 0 | 1 | 0 |
| Raw error exposure | 0 | 1 | 10 | 0 |
| Overly broad catch | 0 | 1 | 1 | 0 |
| Missing try/catch | 0 | 2 | 5 | 1 |
| Missing loading/error UI | 0 | 1 | 1 | 1 |
| No user call to action | 0 | 5 | 0 | 0 |
| Missing sys.exit on script failure | 0 | 2 | 0 | 0 |

### Top 3 remediation priorities

1. Fix validation error responses to never echo submitted input (`main.py` + BFF pass-through).
2. Fix password-reset email failure handling so users are not told a link was sent when it was not.
3. Add retry/recovery affordances to profile, supplier, candidate, and analysis error states; add error boundaries to backoffice and talent-tracker.
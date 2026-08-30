# HealthCore Telemetry Plan

**Status:** Design only — no instrumentation in this deliverable.  
**Audience:** the team implementing capture tomorrow.  
**Domain source:** [`context/13_CONTEXT.md`](../../context/13_CONTEXT.md)  
**Companion schema:** [`event-schemas.json`](./event-schemas.json) (JSON Schema draft-07 plus a documented catalogue wrapper)

This plan answers: what is worth capturing **today**, what becomes valuable **tomorrow**, and what we will **never** emit. An event exists only if this sentence can be completed:

> We capture `[event_type]` because we need to know `[hypothesis]`, which allows us to make the decision `[concrete decision]`.

If the sentence fails, the event is discarded (§9).

---

## 1. Purpose and stakeholders

HealthCore’s inventory has been live long enough that operations cannot answer basic questions: outbound volume per day, which supplies fail validation, whether staff try to edit stock directly, and when low-stock alerts fire. The rest of the backoffice is equally opaque (login failures, navigation, abandoned forms).

| Stakeholder | What telemetry must eventually support |
| --- | --- |
| **Dr. Okonkwo** | Network operations dashboard; inbound/outbound volume by clinic and country |
| **Claire** | Compliance alerts — expiry windows, traceability bypass attempts |
| **Dr. Marcus Reid** | Urgent restock when a clinic runs short of PPE or medication |
| **James Osei** | Technical health of the Digital platform (latency, errors, auth abuse) |
| Clinic administrators | Training and permissions where bypass attempts cluster |

Events describe **supplies and staff operations**, never patients. HIPAA / UK GDPR: no `properties` field may contain patient names, medical-record identifiers, diagnoses, or anything that could be read as PHI — real or simulated.

---

## 2. Identifier and taxonomy contract

CONTEXT entity names are the telemetry names. The running API uses different labels; implementers map, they do not invent a third vocabulary.

| CONTEXT / telemetry | Running application | Notes |
| --- | --- | --- |
| `Product` | `MedicalSupply` | `product_id` = `medical_supplies.id` |
| `InboundOrder` | `SupplyDelivery` | `POST /inventory/orders/inbound` |
| `OutboundOrder` | `SupplyConsumption` | `POST /inventory/orders/outbound` |
| `clinic` | `clinic_id` 1–12 | 1–9 US, 10–12 UK (Austin Main … Manchester Central) |
| `department` | **not stored yet** | Required on outbound telemetry; capture from a new form field (never a patient id) |

### 2.1 `product_category` (mandatory enum)

CONTEXT allows only: `medication` · `ppe` · `consumable` · `equipment`.

Map from today’s API `category`:

| API `category` | Telemetry `product_category` |
| --- | --- |
| `ppe` | `ppe` |
| `medications` | `medication` |
| `consumables`, `wound_care`, `diagnostics` | `consumable` |
| *(future equipment SKUs)* | `equipment` |

Do not emit API-only values (`wound_care`, `diagnostics`) in telemetry `product_category`.

### 2.2 `department` (outbound / clinical context only)

Allowlist: `general_consultation` · `chronic_care` · `specialty_care` · `chronic_disease_management` · `pharmacy`. Never a person. Inbound orders omit `department`.

### 2.3 Gaps the capture work must close

These are product/API gaps, not reasons to skip mandatory events:

1. **`expiry_date` on `Product`** — CONTEXT requires it so `supply_expiry_flagged` is computable. Not on `MedicalSupply` today.
2. **`department` on outbound** — not on `SupplyConsumption` today.
3. **Per-clinic stock** — `current_stock` is network-wide. Until per-clinic balances exist, `stock_threshold_triggered` still includes `clinic_id` of the movement that crossed the threshold, plus network remaining quantity. Document the limitation in the event.
4. **Direct stock edit** — UI does not offer a stock editor; API has no PATCH on stock. Emit `direct_stock_edit_rejected` on `PATCH`/`PUT`/`DELETE /inventory/products/{id}` (today 404/405) and any future “set stock” attempt.

---

## 3. Standard event envelope

Every event **must** include these fields. Names match the programme contract (mixed camelCase / snake_case is intentional).

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `eventId` | UUID v4 string | yes | Idempotent id of this emission |
| `timestamp` | ISO 8601 UTC (`…Z`) | yes | When the fact occurred, not when the batch flushed |
| `sessionId` | UUID v4 string | yes | Browser session, or a synthetic id for jobs (`job:<runId>`) |
| `userId` | string or `null` | yes | TinyDB staff id as string. `null` only when the actor is unknown (failed login). **Never an email.** |
| `event_type` | string | yes | `entity_action` taxonomy |
| `schemaVersion` | string | yes | Envelope version; start at `1.0.0` |
| `requestId` | UUID v4 string | yes | Correlation across BFF → FastAPI. Generate in the BFF if the client omitted `X-Request-ID` |
| `properties` | object | yes | Event payload. **Allowlist only** (`additionalProperties: false`) |

No envelope field may hold PHI. `userId` is a staff identifier, not a patient identifier.

`event_type` verbs used in this plan: `created`, `rejected`, `triggered`, `flagged`, `failed`, `succeeded`, `viewed`, `expired`, `recorded`, `uncaught`, `abandoned`, `requested`, `changed`.

---

## 4. Inventory management flow — instrumentation map

Authenticated path from login to a completed inbound or outbound order. **Minimum five capture points** are marked ★; the flow has more.

```text
[Public] POST /auth/login
    → login_succeeded | login_failed
[AuthGuard] protected route without token
    → session_expired
        ★ 1. page_viewed  (route=/inventory/products)
[Catalogue] GET /inventory/products
        ★ 2. catalogue_viewed
    → "Log vendor delivery"  (?supply_id=)
    → "Log clinical consumption" (?supply_id=)
[Inbound form] POST /inventory/orders/inbound
        ★ 3. inbound_order_created          (201)
             inventory_validation_failed    (400)
             after write: maybe stock_threshold_triggered if still below min
[Outbound form] POST /inventory/orders/outbound
        ★ 4. outbound_order_created         (201)
             outbound_order_rejected        (400 insufficient stock)
             inventory_validation_failed    (400 other)
             ★ stock_threshold_triggered    (remaining < configured minimum)
[Bypass] PATCH|PUT|DELETE /inventory/products/{id}
        ★ 5. direct_stock_edit_rejected
[Nightly job]
        supply_expiry_flagged               (expiry_date within 30 days)
[Abandon] inbound/outbound form unmounted without 201
        flow_abandoned
```

UX stock bands today (comment in `types/inventory.ts`): 0 out, 1–10 low, >10 healthy. Those bands are the **initial** configured minimum for `stock_threshold_triggered` (`threshold_kind`: `out` | `low`) until Claire publishes clinic-specific minima.

---

## 5. Phase 1 — catalogue

**Classification:** `mandatory` = CONTEXT §3 floor. `identified` = this exploration.

### 5.1 Mandatory (CONTEXT — implement without fail)

| event_type | We capture it because we need to know… | …which allows us to decide… |
| --- | --- | --- |
| `inbound_order_created` | how much and what supply is purchased, by clinic and vendor | consolidate purchasing across clinics and negotiate better vendor terms |
| `outbound_order_created` | which supplies are consumed most, and at what rate, by clinic and department | adjust automatic replenishment of critical supplies per clinic |
| `stock_threshold_triggered` | how often a clinic runs short of a critical supply (PPE, medication) | prioritise urgent restocking and escalate to Marcus (Clinical Operations) |
| `direct_stock_edit_rejected` | whether staff are attempting to bypass supply traceability controls | reinforce training or permissions at the clinic where this happens most |
| `supply_expiry_flagged` | which supplies are about to expire before they become waste or a compliance risk | prioritise use or controlled disposal of that batch before expiry |

Minimum `properties` on inventory events (plus envelope): `clinic_id`, `country` (`US`/`UK`), `product_id`, `product_category` (`medication`/`ppe`/`consumable`/`equipment`), `quantity`, `department` (only where applicable).

### 5.2 Identified — inventory flow

| event_type | We capture it because we need to know… | …which allows us to decide… |
| --- | --- | --- |
| `catalogue_viewed` | whether operators open the catalogue without creating a movement | if empty catalogues or missing SKUs are blocking clinics |
| `inbound_form_started` | how often delivery logging is begun vs completed | whether the inbound form is too slow or confusing |
| `outbound_form_started` | how often consumption logging is begun vs completed | whether stock display or clinic select is blocking submit |
| `outbound_order_rejected` | which SKUs and clinics hit insufficient-stock 400s | raise par levels or block oversell in the UI earlier |
| `inventory_validation_failed` | which products/fields accumulate schema errors (qty 0, clinic 13, bad type) | fix the highest-friction fields first |
| `movements_list_viewed` | whether the audit trail is actually used | invest in filters/export or leave it as a simple log |
| `product_created` | how fast the catalogue grows and in which categories | freeze SKU creation or add an approvals step |
| `duplicate_sku_rejected` | how often staff re-register an existing SKU | improve search-before-create in the catalogue |
| `oversell_warned` | how often the UI amber warning appears before a still-allowed submit | whether to block submit client-side |
| `flow_abandoned` | which inventory forms are left without a 201 | simplify that step or add save-draft |

### 5.3 Identified — authentication

| event_type | We capture it because we need to know… | …which allows us to decide… |
| --- | --- | --- |
| `login_succeeded` | successful staff access volume by hour | size support cover for Monday clinic open |
| `login_failed` | failed attempts per day (no email in payload) | lock or throttle the source, or reset a shared clinic password process |
| `session_expired` | how often operators lose a JWT mid-task | shorten/lengthen `ACCESS_TOKEN_EXPIRE_MINUTES` |
| `logout_succeeded` | explicit vs abandoned sessions | whether “shared workstation” logout training is needed |
| `register_succeeded` | new staff accounts created | review unexpected self-registration |
| `register_failed` | which registration fields fail validation | fix the form copy |
| `password_reset_requested` | volume of forgot-password use | detect an auth incident vs normal turnover |
| `password_reset_completed` | how many reset emails actually finish | fix delivery (Resend) vs expired tokens |
| `password_change_succeeded` | authenticated password changes | confirm the M9 control is used |
| `auth_forbidden` | 403s on admin-only routes | tighten or explain role (admin/manager/user) |

### 5.4 Identified — navigation

| event_type | We capture it because we need to know… | …which allows us to decide… |
| --- | --- | --- |
| `page_viewed` | which backoffice sections operators visit most | put high-traffic tools first in `BackofficeShell` |
| `nav_clicked` | which header links are used vs ignored | drop or regroup unused nav items |
| `cross_app_opened` | hops to website / talent tracker | keep or cut cross-app links |
| `dashboard_viewed` | whether the M2 operations home is used | replace it with Okonkwo’s live dashboard later |
| `utilities_run` | which M2 functions testers execute | keep the tester or hide it from clinic staff |

### 5.5 Identified — performance

| event_type | We capture it because we need to know… | …which allows us to decide… |
| --- | --- | --- |
| `api_latency_recorded` | which FastAPI/BFF routes are slow for clinic staff | cache, index, or split the worst route |
| `web_vital_recorded` | backoffice LCP/INP on catalogue and forms | fix the page that blocks a clinic shift |
| `bff_upstream_failed` | 502s when the UI cannot reach `api` | page on-call for Compose/API outages |

### 5.6 Identified — errors

| event_type | We capture it because we need to know… | …which allows us to decide… |
| --- | --- | --- |
| `frontend_error_uncaught` | unhandled UI exceptions by route | patch the crashing screen before next clinic day |
| `api_unhandled_error` | FastAPI 500s (generic detail only) | fix the handler that is failing closed incorrectly |
| `inventory_not_found` | 404 supply id from stale `?supply_id=` links | expire or validate query prefill |

### 5.7 Identified — incidents (sanitised)

Incident **description** is PHI-adjacent and is **never** copied into telemetry (§9).

| event_type | We capture it because we need to know… | …which allows us to decide… |
| --- | --- | --- |
| `incident_registered` | volume by category/origin/branch (no description) | staff the incident desk |
| `incident_status_changed` | lifecycle throughput | unblock statuses that stall |
| `incident_csv_analyzed` | whether the M5 CSV tool is still used | keep or retire the upload path |
| `incident_summary_viewed` | leadership use of `/incidents/summary` | invest in that view for Okonkwo |

### 5.8 Identified — suppliers

| event_type | We capture it because we need to know… | …which allows us to decide… |
| --- | --- | --- |
| `supplier_registered` | new vendor onboarding rate | align with inbound `vendor_name` |
| `supplier_suspended` | how often vendors are taken offline | audit purchasing risk |
| `supplier_rate_changed` | rate edits (not the amount, only that it changed) | detect unusual commercial activity |

Rate **values** are commercially sensitive; emit a boolean/count signal, not `monthly_rate`.

---

## 6. Phase 2 — events designed for capture (schemas)

Fully specified below and in `event-schemas.json`: **all 5 mandatory events** plus **10 identified events** in four categories (inventory, authentication, performance, errors/navigation).

PII policy: staff `userId` only. No emails, names, phones, addresses, passwords, tokens, or incident descriptions. `vendor_name` is an organisation name, not personal data.

### 6.1 Mandatory schemas

Shared inventory property set: `clinic_id` (1–12), `country` (`US`/`UK`), `product_id` (int), `product_category` (enum), `quantity` (int ≥ 0), `department` (enum, outbound/clinical only).

#### `inbound_order_created` — mandatory · inventory · stream

Fires on `201` from `POST /inventory/orders/inbound`.

| property | type | req | description |
| --- | --- | --- | --- |
| `clinic_id` | integer | yes | Receiving clinic 1–12 |
| `country` | string | yes | `US` or `UK` |
| `product_id` | integer | yes | `Product` / supply id |
| `product_category` | string | yes | CONTEXT enum |
| `quantity` | integer | yes | Units received (> 0) |
| `vendor_name` | string | yes | Vendor (needed for purchasing consolidation) |
| `order_id` | integer | yes | `SupplyDelivery.id` |
| `sku` | string | no | Catalogue code for joins |

Sensitive: no. `department` omitted (not applicable).

#### `outbound_order_created` — mandatory · inventory · stream

Fires on `201` from `POST /inventory/orders/outbound`.

| property | type | req | description |
| --- | --- | --- | --- |
| `clinic_id` | integer | yes | Clinic of consumption |
| `country` | string | yes | `US` or `UK` |
| `product_id` | integer | yes | |
| `product_category` | string | yes | |
| `quantity` | integer | yes | Units consumed (> 0) |
| `department` | string | yes | Clinical area allowlist — **never a patient** |
| `consumption_type` | string | yes | `clinical_use` or `expiry_waste` |
| `order_id` | integer | yes | `SupplyConsumption.id` |
| `remaining_stock` | integer | no | Network remaining after write |

Sensitive: no, provided `department` stays on the allowlist.

#### `stock_threshold_triggered` — mandatory · inventory · **stream**

Fires when remaining stock for the product is **at or below** the configured minimum after a movement (or on catalogue load if already below). `quantity` is remaining units.

| property | type | req | description |
| --- | --- | --- | --- |
| `clinic_id` | integer | yes | Clinic of the triggering movement (limitation: stock is still network-wide) |
| `country` | string | yes | |
| `product_id` | integer | yes | |
| `product_category` | string | yes | |
| `quantity` | integer | yes | Remaining stock |
| `threshold_value` | integer | yes | Configured minimum (initial: 10 low, 0 out) |
| `threshold_kind` | string | yes | `low` or `out` |
| `trigger_order_type` | string | no | `inbound` / `outbound` / `scan` |

Sensitive: no.

#### `direct_stock_edit_rejected` — mandatory · inventory · stream

Fires when a client attempts to set stock outside `InboundOrder`/`OutboundOrder`.

| property | type | req | description |
| --- | --- | --- | --- |
| `clinic_id` | integer | no | If present on the attempt |
| `country` | string | no | Derived from clinic or product jurisdiction |
| `product_id` | integer | no | Path id if numeric |
| `product_category` | string | no | If the product is known |
| `quantity` | integer | no | Attempted stock value if parsed |
| `http_method` | string | yes | `PATCH` / `PUT` / `DELETE` |
| `http_status` | integer | yes | 404 / 405 / 403 |
| `route` | string | yes | e.g. `/inventory/products/12` (no query secrets) |

Sensitive: no. Do not log request bodies.

#### `supply_expiry_flagged` — mandatory · inventory · **batch** (daily job)

Fires when `Product.expiry_date` is within 30 days (inclusive) and remaining quantity > 0.

| property | type | req | description |
| --- | --- | --- | --- |
| `clinic_id` | integer | no | If/when stock is per clinic; else omit |
| `country` | string | yes | Product jurisdiction |
| `product_id` | integer | yes | |
| `product_category` | string | yes | |
| `quantity` | integer | yes | Remaining units at flag time |
| `expiry_date` | string | yes | ISO date (`YYYY-MM-DD`) |
| `days_to_expiry` | integer | yes | 0–30 |
| `department` | string | no | If a preferred using department is configured |

Sensitive: no. No batch patient linkage.

### 6.2 Additional schemas (identified)

#### `inventory_validation_failed` — identified · inventory · batch

400 validation (M12 sanitised `detail`), including invalid `consumption_type`, clinic 13, quantity 0. **Not** the insufficient-stock message (that is `outbound_order_rejected`).

Allowlist: `clinic_id?`, `country?`, `product_id?`, `product_category?`, `quantity?`, `route`, `field`, `error_code`. No raw `input` from Pydantic.

#### `outbound_order_rejected` — identified · inventory · stream

HTTP 400 insufficient stock. Allowlist: mandatory inventory set + `available`, `requested`, `product_name` (supply name only).

#### `catalogue_viewed` — identified · inventory · batch

Allowlist: `result_count`, `out_of_stock_count`, `low_stock_count`.

#### `login_failed` — identified · authentication · stream

Allowlist: `reason` (`invalid_credentials` \| `inactive` \| `malformed`). **No email, no IP** (IP is personal under UK GDPR unless separately justified). Count + timestamp + session is enough to see daily failure volume and brute-force spikes.

#### `login_succeeded` — identified · authentication · stream

Allowlist: `role` (`admin` \| `manager` \| `user`). No email.

#### `session_expired` — identified · authentication · stream

Allowlist: `from_route` (path only, e.g. `/inventory/orders/outbound`). `userId` may be `null` if the token is already gone.

#### `api_latency_recorded` — identified · performance · batch

Allowlist: `route_template` (e.g. `/inventory/products/{id}`), `method`, `status_code`, `duration_ms`, `layer` (`bff` \| `api`).

#### `frontend_error_uncaught` — identified · errors · stream

Allowlist: `route`, `name` (`Error` constructor), `digest` (Next.js digest if any). **Never `error.message` if it might echo API `detail` with stock names in edge cases** — use a stable `code` when known (`ChunkLoadError`, `RenderError`).

#### `page_viewed` — identified · navigation · batch

Allowlist: `route`, `referrer_route` (internal path or `null`).

#### `flow_abandoned` — identified · navigation · batch

Allowlist: `flow` (`inbound_order` \| `outbound_order` \| `incident_register` \| `supplier_register` \| `login`), `last_step`, `duration_ms`.

---

## 7. Phase 3 — delivery strategy

| event_type | Mode | Why (decision urgency, not taste) |
| --- | --- | --- |
| `inbound_order_created` | stream | Purchasing consolidation can wait a day, but Okonkwo’s live ops dashboard must not lag clinic receipts |
| `outbound_order_created` | stream | Replenishment and “outbound per day” should update as clinics log use, not next morning |
| `stock_threshold_triggered` | stream | Marcus restock is **shift-critical**; batching until night is clinically unsafe |
| `direct_stock_edit_rejected` | stream | Traceability bypass is a control failure; Claire needs same-day visibility |
| `supply_expiry_flagged` | batch | 30-day window; a daily job matches how pharmacies already review expiry |
| `outbound_order_rejected` | stream | Repeated oversell at one clinic is an immediate par-level problem |
| `inventory_validation_failed` | batch | “Which products accumulate validation errors?” is a weekly UX decision |
| `catalogue_viewed` | batch | Traffic mix, not an emergency |
| `login_failed` | stream | Credential stuffing must be visible within minutes |
| `login_succeeded` | stream | Ties sessions to later inventory events (`userId` + `sessionId`) |
| `session_expired` | stream | If expiries spike mid-shift, change token TTL the same day |
| `api_latency_recorded` | batch | p95 review is periodic; raw samples are high volume |
| `frontend_error_uncaught` | stream | A crashing consumption form blocks clinics now |
| `page_viewed` | batch | Nav popularity is a product decision, not an incident |
| `flow_abandoned` | batch | Funnel analysis is periodic |

### 7.1 Throttle / debounce

| event_type | Rule |
| --- | --- |
| `page_viewed` | Once per `route` per `sessionId` (ignore React remounts) |
| `catalogue_viewed` | Once per catalogue visit (not per table re-render) |
| `api_latency_recorded` | Sample 10% **or** always if `duration_ms >= 500` |
| `frontend_error_uncaught` | Dedupe `{route, name, digest}` for 60 seconds |
| `stock_threshold_triggered` | Once per `{product_id, threshold_kind}` per 15 minutes unless `quantity` changes band |
| `login_failed` | No throttle (volume **is** the signal); store counts, not identities |

---

## 8. Correlation and capture points (for implementers)

- Browser: `sessionId` in `sessionStorage`; `requestId` on each `authFetch`.
- BFF: forward `X-Request-ID`; emit `api_latency_recorded` on proxy return.
- FastAPI: emit inventory and auth events next to the status code (after commit for 201s, on the exception path for 400/404/405).
- Job: `supply_expiry_flagged` from a daily scan; `sessionId` = `job:{date}`; `userId` = `null`.

Do not emit from both UI and API for the same 201 (double count). **API is source of truth** for order and rejection events. UI owns `page_viewed`, `flow_abandoned`, `frontend_error_uncaught`, form started.

---

## 9. Risks and exclusions

### 9.1 Considered and discarded (sentence failed, or privacy/cost)

| Candidate | Why discarded |
| --- | --- |
| Keystrokes / field-level heatmaps | No decision that justifies recording what staff type; high PII/PHI risk |
| Patient id on consumption | CONTEXT forbids it; HIPAA |
| Incident `description` | Operational notes can contain PHI |
| Login email or email hash | Anti-enumeration + UK GDPR; `login_failed` works as a count |
| Client IP / user-agent as default properties | Personal data; not required for the ops questions |
| JWT / refresh material | Secret leakage |
| `monthly_rate` amounts | Commercial sensitivity; `supplier_rate_changed` without the figure is enough |
| Full JSON bodies of 400s | M12 stripped `input` for a reason; keep `field` + `error_code` |
| Public website enquiry form contents | Patient-adjacent PII; out of inventory/backoffice ops scope |
| Docker/build telemetry | No clinic decision |
| Pixel-perfect mouse trails | Cost; no hypothesis |

### 9.2 Will not capture

- Any PHI or plausible PHI (names, MRN, diagnosis, free-text clinical notes).
- Passwords, reset tokens, `JWT_SECRET`.
- Simulated patient data “for tests” (CONTEXT §6).

### 9.3 Residual risks

- **Network-wide stock vs clinic_id** on `stock_threshold_triggered` can over-alert until per-clinic stock exists. Call that out on the dashboard.
- **Category mapping** can hide `diagnostics` vs `wound_care` inside `consumable`. Keep SKU on inbound/outbound for drill-down.
- **Staff `userId`** is still personal data under UK GDPR (employee data). Retain with a documented purpose (traceability, training) and a retention cap (suggested 24 months, confirm with Claire).

---

## 10. Future (do not instrument until the question is real)

Once Okonkwo’s dashboard exists: pre-aggregates by `clinic_id` and `country` (CONTEXT §3). Once Claire’s alerts exist: stream rules on `stock_threshold_triggered` and `supply_expiry_flagged`. Seed targets in CONTEXT §5 (8–10 products, four categories, mixed US/UK clinics, threshold and expiry cases) belong to **capture/storage**, not this plan.

---

## 11. Acceptance checklist

- [x] CONTEXT mandatory `event_type`s present with the same names and hypotheses
- [x] Inventory flow has ≥ 5 instrumentation points including rejection, validation failure, and threshold
- [x] Catalogue extends through auth, nav, performance, errors, incidents, suppliers — not the floor alone
- [x] Every retained event completes the hypothesis/decision sentence
- [x] Events classified `mandatory` vs `identified`
- [x] Envelope fields as specified
- [x] Allowlists; PHI called out
- [x] ≥ 8 additional events, ≥ 3 categories, `entity_action` names
- [x] Stream vs batch justified by decision urgency
- [x] Throttle for high-frequency events
- [x] Risks and exclusions
- [x] `event-schemas.json` draft-07

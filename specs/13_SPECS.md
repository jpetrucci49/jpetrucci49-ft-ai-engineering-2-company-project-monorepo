# SPECS — Milestone 13: Docker Compose development environment

Reproducible local stack: one UI container (website + backoffice, hot reload) and one FastAPI container (`--reload`), started with `docker compose up` from the repository root.

**Programme brief:** dockerize `/uis` and `/services`; orchestration via Compose; containers talk **by Docker service name**, not `localhost`.  
**There is no `context/13_CONTEXT.md`.** Domain/company copy does not change. Do not edit `context/` or `milestones/`.

---

## 0. Agent workflow (do this in order)

1. Read this spec fully, then `uis/backoffice/.env.example`, `services/api/.env.example`, `services/api/pyproject.toml`, `uis/backoffice/tsconfig.json` (path aliases), and `.gitignore`.
2. Create ignore files, Dockerfiles, `uis/start.sh`, `services/requirements.txt`, root `.env.example`, `docker-compose.yml`.
3. Confirm `.env` is gitignored. **Never** put real secrets, API keys, or passwords in Compose, Dockerfiles, `.env.example`, or the spec.
4. Boot: `cp .env.example .env` (one-time, secrets file) then `docker compose up --build`.
5. Run the verification checklist in §8. Fix URL mistakes before claiming done.
6. Update `README.md`, `memory-bank/progress.md`, and `memory-bank/techContext.md`.

Do not dockerize the talent tracker, the hub (`public/` :4173), or CI. Do not rewrite application business logic. Native `npm run dev` / `npm run dev:api` must keep working.

---

## 1. Objective

Any teammate, after copying `.env.example` → `.env`, can run:

```bash
docker compose up --build
```

from the repo root and reach:

| App | Host URL |
| --- | --- |
| Public website | http://localhost:3000 |
| Operations backoffice | http://localhost:3001 |
| FastAPI (OpenAPI) | http://localhost:8000/docs |

No host `npm install` or `uv sync` is required for that path.

The **only** allowed extra step is creating root `.env` from `.env.example`. Secrets cannot live in Git.

---

## 2. Required reading

| File | Why |
| --- | --- |
| `uis/backoffice/.env.example` | BFF targets (`*_API_URL`) vs browser `NEXT_PUBLIC_*` |
| `services/api/.env.example` | API boot vars (`JWT_SECRET`, Resend, `SUPABASE_DATABASE_URL`, CORS) |
| `services/api/pyproject.toml` | Runtime Python deps (source for `requirements.txt`) |
| `services/api/app/main.py` | Lifespan: JWT + password-reset config + inventory schema **must** be set or the API exits |
| `uis/backoffice/tsconfig.json` | `@healthcore/*` aliases point **outside** `uis/` (`../../packages`, `../../src`, `../../tests/utils`) |
| `packages/shared/api/proxy.ts` | `getFastApiOrigin()` — server-side only |
| `.gitignore` | `.env` is already ignored; keep it that way |

---

## 3. Target layout

```text
uis/
  Dockerfile              # official Node Alpine
  start.sh                # website :3000 + backoffice :3001
  .dockerignore
services/
  Dockerfile              # official Python 3.12 + uv
  requirements.txt        # generated; PyPI only
  .dockerignore
  api/                    # existing FastAPI app (WORKDIR here at runtime)
docker-compose.yml        # repo root
.env.example              # repo root — Docker contract (placeholders only)
.env                      # repo root — gitignored; never commit
```

Compose **build contexts** are `./uis` and `./services` (the directories that contain those Dockerfiles).

Suggested Compose **service keys** (these become DNS names on the Docker network):

| Service key | Build | Host ports |
| --- | --- | --- |
| `ui` | `./uis` | `3000:3000`, `3001:3001` |
| `api` | `./services` | `8000:8000` |

If you rename a service, every URL in §4 must use that new hostname. Do not use `network_mode: host`.

Named network (explicit), e.g. `healthcore`.

---

## 4. URL rules (sign-off — read twice)

Two different callers, two different hosts.

| Caller | Destination | Host in the URL | Example |
| --- | --- | --- | --- |
| **Browser** (developer machine) | website / backoffice / API docs | `localhost` | `http://localhost:3001` |
| **Next.js BFF** (Node inside `ui`) | FastAPI | Compose service name | `http://api:8000` |
| **Email / password-reset link** | backoffice reset page | `localhost` (human clicks it) | `http://localhost:3001/reset-password` |
| **CORS allow-list** | browser origin | `localhost` | `http://localhost:3001` |
| **`NEXT_PUBLIC_*`** | other apps in the browser | `localhost` | `http://localhost:3000` |

**Never** put a Docker service name in `NEXT_PUBLIC_*`, `PASSWORD_RESET_URL`, or `CORS_ORIGINS`. The browser is not on the Compose network.

**Never** leave BFF targets as `http://127.0.0.1:8000` or `http://localhost:8000` inside the `ui` container — that points at the UI container itself, not FastAPI.

Do **not** change committed `uis/backoffice/.env.example` (or tracker/website examples) to Docker hostnames. Those files remain the **native** `npm run dev` contract (`127.0.0.1:8000`). Docker injects process env from the **root** `.env`, and Next.js / Uvicorn honour process env over dotenv files.

### 4.1 Root `.env.example` — required keys

Placeholders only. No real Resend keys, JWT material, or database passwords.

**UI container (BFF + public nav)**

```bash
NEXT_PUBLIC_WEBSITE_URL=http://localhost:3000
NEXT_PUBLIC_BACKOFFICE_URL=http://localhost:3001
NEXT_PUBLIC_TRACKER_URL=http://localhost:3002
INCIDENTS_API_URL=http://api:8000
SUPPLIERS_API_URL=http://api:8000
AUTH_API_URL=http://api:8000
INVENTORY_API_URL=http://api:8000
```

**API container (must match `services/api` lifespan checks)**

The API **exits on startup** unless all of these are non-empty: `JWT_SECRET`, `PASSWORD_RESET_URL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `SUPABASE_DATABASE_URL` (`auth/config.py`, `inventory/database.py`).

```bash
JWT_SECRET=change-me-to-a-long-random-string
ACCESS_TOKEN_EXPIRE_MINUTES=30
RESET_TOKEN_EXPIRE_MINUTES=30
PASSWORD_RESET_URL=http://localhost:3001/reset-password
RESEND_API_KEY=re_replace_me
RESEND_FROM_EMAIL=onboarding@resend.dev
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001
SUPABASE_DATABASE_URL=sqlite:///./inventory.db
```

Use SQLite in `.env.example` so `docker compose up` works without Supabase. Operators who already have a pooler URI put it in **their** gitignored `.env` — never in YAML or the Dockerfile.

Do not hardcode any of these values in `docker-compose.yml`. Use `env_file: .env` on both services (Compose also auto-loads `.env` for `${VAR}` interpolation). Extra keys in the other container are harmless.

---

## 5. Implementation

### 5.1 `uis/.dockerignore`

Must exclude at least: `node_modules`, `.next`, `.env*`, `*.log`.

Also exclude `talent-pipeline-tracker/` (out of scope) to keep the build context small.

### 5.2 `uis/Dockerfile`

- Base: official **Node Alpine** (Node **20+**; 22-alpine is fine). Install `libc6-compat` (Next.js on Alpine).
- Install dependencies for **`website` and `backoffice` separately** (`WORKDIR` + `npm install` in each app). Use `npm install`, not `npm ci` — `package-lock.json` is gitignored in this repo.
- Copy `start.sh`, make it executable.
- Default `CMD` **must** run `start.sh`.
- Bind-mounts overlay source at runtime; the image only needs `package.json` + install for a warm `node_modules`.

Suggested filesystem (must keep `../../packages` resolution from `uis/backoffice`):

```text
/app/website      ← uis/website
/app/backoffice   ← uis/backoffice
/packages         ← repo packages/     (bind-mount; not in uis/ build context)
/src              ← repo src/
/tests/utils      ← repo tests/utils/
```

From `/app/backoffice`, `../../packages` is `/packages`. Compose must mount those three host paths or backoffice `next dev` cannot resolve `@healthcore/auth`, `@healthcore/utils`, etc. **Do not** “fix” this by rewriting tsconfig aliases unless mounts are impossible.

Anonymous/named volumes for `/app/website/node_modules` and `/app/backoffice/node_modules` so a bind-mount of source does not hide Alpine `node_modules` with the host’s.

Polling for bind-mount file watchers (Linux VMs / Codespaces):

```bash
WATCHPACK_POLLING=true
CHOKIDAR_USEPOLLING=true
```

### 5.3 `uis/start.sh`

Starts **both** Next apps with `next dev` (hot reload):

- website: port **3000**, hostname **`0.0.0.0`**
- backoffice: port **3001**, hostname **`0.0.0.0`**

`next dev` binds localhost only unless `--hostname 0.0.0.0` is set — published ports will fail without it.

Use `#!/bin/sh`, `set -e`, forward signals (`trap` + `wait`) so `docker compose stop` actually stops both processes. LF line endings.

### 5.4 `services/.dockerignore`

Must exclude at least: `__pycache__`, `*.pyc`, `.env*`, `tests/`, `*.log`.

Also exclude `.venv/`. Do not exclude the application package (`api/`).

### 5.5 `services/requirements.txt`

This repo uses **uv + `services/api/pyproject.toml` + `uv.lock`**, not a checked-in requirements file. Create one **from that project** (not root `pyproject.toml`, which is pandas-only).

Preferred:

```bash
uv export --directory services/api --frozen --no-dev --no-hashes --no-emit-project -o services/requirements.txt
```

If `--no-emit-project` is unavailable, write the file from the `dependencies` list in `services/api/pyproject.toml`. The file must contain **only PyPI packages** (fastapi, uvicorn, sqlmodel, psycopg, …). No `file://` or `-e .` lines.

Do not add pytest (tests are dockerignored; `--reload` image is for running the server).

### 5.6 `services/Dockerfile`

- Official **Python 3.12** image. Prefer `python:3.12-slim-bookworm` over Alpine — `psycopg[binary]` wheels are reliable on glibc.
- Install **uv**, then `uv pip install -r requirements.txt` (system Python is fine: `UV_SYSTEM_PYTHON=1` or `uv pip install --system`).
- `WORKDIR` = the FastAPI app root (the contents of `services/api/`, e.g. `/app`) so `uvicorn app.main:app` resolves.
- Default `CMD` starts Uvicorn with **`--reload`**, **`--host 0.0.0.0`**, **`--port 8000`**.

  Binding `127.0.0.1` makes the API unreachable from the `ui` container and from the host port map.

### 5.7 `docker-compose.yml`

Two services, bind mounts, named network, published ports.

**`ui`**

- `build.context: ./uis`
- volumes: `./uis/website` → `/app/website`, `./uis/backoffice` → `/app/backoffice`, plus `./packages`, `./src`, `./tests/utils` as in §5.2, plus `node_modules` volumes
- `env_file: .env`
- `depends_on: api` (optionally `condition: service_healthy`)
- do not override `CMD` unless you still invoke `start.sh` / both `next dev` processes

**`api`**

- `build.context: ./services`
- volume: `./services/api` → `/app` (or whatever `WORKDIR` you chose) so `--reload` picks up Python edits
- `env_file: .env`
- healthcheck hitting a local URL **inside** the api container (`GET /health`). Slim images often lack `curl`; use `python -c` + `urllib`. Do **not** probe `/openapi.json` — it regenerates the full schema on every check and floods access logs.

Omit Compose `version:`. No credentials in `environment:` blocks.

### 5.8 Gitignore

Confirm repository `.gitignore` already lists `.env` (it does). Do not ignore `.env.example`. Do not commit `.env`, `uis/*/.env`, or `services/api/.env`.

---

## 6. Out of scope

- `uis/talent-pipeline-tracker/` and hub port **4173**
- Production multi-stage images, Kubernetes, CI workflow changes (`.github/` is protected)
- Auto-seed on container start (operators still run seed via `docker compose exec` if they want data)
- Changing BFF code, FastAPI routes, or M2 signatures
- Putting Docker hostnames into app-level committed `.env.example` files

---

## 7. Docs (when the stack works)

| File | Update |
| --- | --- |
| `README.md` | Docker quick start: `cp .env.example .env` then `docker compose up --build`; keep native `npm run dev` as an alternative |
| `memory-bank/progress.md` | M13 deliverable |
| `memory-bank/techContext.md` | Compose service names, bind-mount + reload, BFF uses `http://api:8000` in Docker |

Optional: one paragraph on `docker compose exec api …` for `seed` / `seed_inventory.py` (WORKDIR must match).

---

## 8. Acceptance

Assignment checkboxes plus HealthCore-specific gates.

### 8.1 Files

- [ ] `uis/Dockerfile` — Node Alpine; separate `npm install` for website and backoffice; `CMD` runs `start.sh`
- [ ] `uis/start.sh` — `next dev` on 3000 and 3001, host `0.0.0.0`
- [ ] `uis/.dockerignore` — `node_modules`, `.next`, `.env*`, `*.log`
- [ ] `services/Dockerfile` — official Python; uv; `uv pip install -r requirements.txt`; Uvicorn `--reload`, `0.0.0.0:8000`
- [ ] `services/.dockerignore` — `__pycache__`, `*.pyc`, `.env*`, `tests/`, `*.log`
- [ ] `docker-compose.yml` — `ui` + `api`, bind mounts, named network, published 3000/3001/8000
- [ ] Root `.env.example` with all vars; no secrets; BFF URLs use the **api** service name
- [ ] `.env` remains gitignored

### 8.2 Boot and URLs

From a clean clone path (image build + compose):

```bash
cp .env.example .env    # if not already present
docker compose up --build
```

- [ ] Website responds on http://localhost:3000
- [ ] Backoffice responds on http://localhost:3001 (login page is enough; AuthGuard is client-side)
- [ ] http://localhost:8000/docs returns 200
- [ ] From **inside the ui container**, FastAPI is reachable by **service name**:

  ```bash
  docker compose exec ui python -c "import urllib.request; urllib.request.urlopen('http://api:8000/docs')"
  ```

  If the UI image has no Python, use `wget -qO- http://api:8000/openapi.json` or `node -e "fetch('http://api:8000/openapi.json').then(r=>console.log(r.status))"`.
- [ ] Unauthenticated `GET http://localhost:3001/api/inventory/products` is **401** from FastAPI via the BFF (proves `INVENTORY_API_URL=http://api:8000`, not localhost)
- [ ] `grep -R "localhost:8000\|127.0.0.1:8000" docker-compose.yml uis/Dockerfile services/Dockerfile` — no matches used as inter-service URLs
- [ ] No real API keys in those Docker files or `.env.example`

### 8.3 Reload (smoke)

- [ ] Edit a visible string in `uis/website` or `uis/backoffice` → browser updates without rebuilding the image
- [ ] Edit a Python module under `services/api` → Uvicorn reload log line; `/docs` still 200

### 8.4 Native dev still works

- [ ] Committed `uis/backoffice/.env.example` still defaults BFF URLs to `http://127.0.0.1:8000`
- [ ] `npm run dev:api` documentation still uses host loopback (optional: do not change that script)

---

## 9. Pitfalls (if something fails, check here first)

| Symptom | Likely cause |
| --- | --- |
| Host `:3000`/`:3001` connection refused | Missing `--hostname 0.0.0.0` on `next dev` |
| Host `:8000` connection refused | Uvicorn bound to `127.0.0.1` instead of `0.0.0.0` |
| BFF 502 / “Unable to reach … API” | `*_API_URL` still `localhost`/`127.0.0.1` inside `ui` |
| Backoffice compile errors `@healthcore/auth` | `packages/`, `src/`, `tests/utils` not mounted at `/packages`, `/src`, `/tests/utils` |
| `Cannot find module` after bind-mount | Host `node_modules` overlay; add dedicated `node_modules` volumes |
| API exits immediately | Missing `JWT_SECRET`, Resend vars, `PASSWORD_RESET_URL`, or `SUPABASE_DATABASE_URL` |
| `psycopg` install fails on Alpine | Use Python slim, not Alpine, for the API image |
| `uv pip install` looks for a local path | `requirements.txt` still has `-e .` / `file://` |
| Hot reload does nothing | Bind mounts wrong; or enable `WATCHPACK_POLLING` / `CHOKIDAR_USEPOLLING` |
| Reset email link / CORS broken | `PASSWORD_RESET_URL` or `CORS_ORIGINS` used `http://ui:3001` |

---

## 10. Definition of done

`docker compose up` from the repo root (with root `.env` present) runs website, backoffice, and FastAPI with hot reload; BFF calls FastAPI at `http://api:8000`; browsers and CORS still use `localhost`; no secrets in versioned Docker files.

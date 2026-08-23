# `uis` folder

All HealthCore frontend applications live here as independent Next.js apps.

| App | Port | Routes |
| --- | --- | --- |
| `website/` | 3000 | `/`, `/application` |
| `backoffice/` | 3001 | `/`, `/utilities`, `/incidents`, `/incidents/register`, `/incidents/manage`, `/incidents/summary`, `/suppliers`, auth routes |
| `talent-pipeline-tracker/` | 3002 | `/`, `/candidates/[id]` |

## Run all apps

From the repository root:

```bash
npm run dev
```

Dev hub with links: http://localhost:4173

All apps use the M12 BFF error proxy (`lib/api/bff-proxy.ts` in backoffice and talent-tracker) and safe error boundaries — see each app's README.

## Run one app

```bash
cd uis/website && npm install && npm run dev
```

> _Spanish version: [README.es.md](./README.es.md)._

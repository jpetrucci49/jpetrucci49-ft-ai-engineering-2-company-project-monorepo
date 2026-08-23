# `packages` folder

This folder contains **shared packages** for the monorepo: internal libraries, utilities, types, shared components, SDKs, clients, and any code reused by multiple applications, agents, or pipelines.

Each subfolder under `packages/` should represent **one versionable package** (for example `shared-types`, `ui`, `analytics-sdk`) with its own README.

- **Main purpose**: encourage reuse and consistency across all company deliverables.
- **Recommendation**: document packages as you add them—their public API and how they are consumed from `apps/`, `agents/`, and `workflows/`.

| Package | Import alias | Purpose |
| --- | --- | --- |
| `shared/navigation/` | `@healthcore/navigation` | Cross-app nav labels (EN/ES), paths, and URL helpers |
| `shared/auth/` | `@healthcore/auth` | JWT token helpers, fetch wrappers, cross-app auth, validation message humanization (M8/M10/M12) |
| `shared/api/` | (import path) | Client-safe API error helpers — `sanitizeApiDetail`, `toUserFacingMessage` (M12) |
| `shared/incidents/` | `@healthcore/incidents` | Incident enums, labels, lifecycle rules, validation (M11) |

> _Spanish version: [README.es.md](./README.es.md)._

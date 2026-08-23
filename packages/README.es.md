# Carpeta `packages`

Esta carpeta contiene **paquetes compartidos** del monorepo: librerías internas, utilidades, tipos, componentes comunes, SDKs, clientes y cualquier código reutilizable por varias aplicaciones/agentes/pipelines.

Cada subcarpeta dentro de `packages/` debería representar **un paquete versionable** (por ejemplo `shared-types`, `ui`, `analytics-sdk`) con su README propio.

- **Propósito principal**: fomentar reutilización y consistencia entre todos los desarrollos de la compañía.
- **Recomendación**: documenta los paquetes que vayas añadiendo, su API pública y cómo se consumen desde `apps/`, `agents/` y `workflows/`.

| Paquete | Alias | Propósito |
| --- | --- | --- |
| `shared/navigation/` | `@healthcore/navigation` | Etiquetas de navegación (EN/ES), rutas y helpers URL |
| `shared/auth/` | `@healthcore/auth` | JWT, fetch autenticado, mensajes de validación (M8/M10/M12) |
| `shared/api/` | (ruta de import) | Helpers de errores API — `sanitizeApiDetail`, `toUserFacingMessage` (M12) |
| `shared/incidents/` | `@healthcore/incidents` | Enums, etiquetas y reglas de ciclo de vida de incidentes (M11) |

> _Versión en inglés: [README.md](./README.md)._

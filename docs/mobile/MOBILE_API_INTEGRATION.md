# ACADLYX Mobile API Integration

## API origin and database

The mobile client defaults to the existing API origin https://acadlyx-api.onrender.com and appends /api/v1. EXPO_PUBLIC_API_URL is only an origin and must not contain credentials. Local test devices need an address reachable from their own network context.

The web app uses the same API prefix and origin pattern. The API, its Prisma services and the current PostgreSQL/Supabase setup remain the sole authoritative data path. No direct database connection or second identity system was introduced.

## Connected routes in this increment

| Capability | Endpoint | Method | State |
|---|---|---|---|
| Login | /auth/login | POST | Implemented from inspected route/controller contract |
| MFA completion | /auth/mfa/verify | POST | Implemented from inspected route/controller contract |
| Current user | /auth/me | GET | Implemented for restoration |
| Token renewal | /auth/refresh | POST | Implemented with bounded single retry |
| Logout | /auth/logout | POST | Implemented; local logout completes if network fails |
| Password change | /auth/change-password | POST | Implemented; client clears local session after success |
| My Work | /my-work | GET | Implemented in home |
| Notifications | /portal/notifications | GET | Implemented read-only list |
| Mark all read | /portal/notifications/read-all | POST | Implemented; queries invalidated after success |
| Student self-service | /students/me/dashboard, /attendance, /marks, /assignments, /timetable | GET | Mapped in module catalog; not yet live-smoke-tested |
| Student master | /students | GET | Generic read-only surface |
| Assignments | /assignments | GET | Generic read-only surface |
| Attendance sessions | /attendance-sessions | GET | Generic read-only surface |
| Examinations | /examinations/sessions | GET | Generic read-only surface |
| Finance | /finance/overview, /finance/invoices, /finance/payments | GET | Generic read-only surfaces |
| Documents | /portal/documents/me | GET | Catalog mapping only |
| Other listed modules | See MOBILE_FEATURE_PARITY.md | GET | Foundation only; actual response schemas still need verification |

## Request behavior

- Authenticated calls use the access token from Expo SecureStore.
- A 401 response may trigger one refresh request through the existing refresh-token API. If it fails, client credentials are cleared.
- Responses matching the existing success/data envelope are unwrapped.
- The client uses request timeouts, actionable generic server/network messages, and a generated X-Idempotency-Key for non-GET requests. Endpoint-level rules still determine whether an action is idempotent and transactional.
- 403s are surfaced as denied operations.
- Query data is in-memory, and the query client clears after account identity changes.
- The client does not implement multipart/binary operations or offline write queues.

## Backend changes and migrations

No backend route, controller, service, RBAC policy, Prisma schema or database migration was changed in this increment. Existing endpoints and permission contracts are used. No production record was modified.

## Contract work still required

Every feature needs a dedicated, typed API contract based on the actual route validator and service/controller response. Add isolated integration tests for success, validation failures, expired and revoked sessions, deactivated users, direct unauthorized calls, tenant/campus/department/individual-student isolation, and mutation idempotency. The generic record normalizer intentionally does not pretend to supply these module-level contracts.

Password recovery requires a backend contract before implementing a native recovery screen; the inspected auth router did not expose a password-reset endpoint.
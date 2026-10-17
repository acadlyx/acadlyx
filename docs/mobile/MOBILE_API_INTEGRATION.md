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

## Dedicated module workflows in this increment

| Capability | Endpoint(s) | Methods wired in the native UI | Scope / gaps |
|---|---|---|---|
| Assignments | `/assignments`, `/assignments/:id`, `/assignments/:id/submit`, `/assignments/:id/submissions`, `/assignments/:id/submissions/:studentId`, `/assignments/:id/submissions/:studentId/reopen` | GET, POST, PATCH | Draft creation, publish/unpublish, submit, review and reopen. Server validates course offering, reviewer authority and ownership. Attachments and isolated integration tests remain. |
| Notices | `/erp/notices`, `/erp/notices/:id` | GET, POST, PATCH, DELETE | Read uses notices.read; mutation controls are displayed with notices.manage. Department-targeted audience selection is not implemented. |
| Timetable | `/erp/timetable`, `/erp/timetable/:id`, `/course-offerings` | GET, POST, PATCH, DELETE | Uses selected course offering records; backend performs scope and collision validation. Dedicated device/API tests remain. |
| Library | `/library/books`, `/library/reservations`, `/library/loans`, `/library/loans/mine`, `/library/loans/:id/renew`, `/library/loans/:id/return`, `/library/fines`, `/students` | GET, POST, PATCH | Catalogue, reservation, staff issue/renew/return-condition, fines and book create/edit. Fine waiver, copy-level tools and borrower lookup when /students is denied remain. |
| Calendar | `/calendar/events`, `/calendar/events/:id` | GET, POST, PATCH, DELETE | Native event list/search/create/edit/delete. Academic-year-specific selection and time-zone/recurrence UX are not implemented. |
| Notifications | `/portal/notifications`, `/portal/notifications/:id`, `/portal/notifications/read-all` | GET, PATCH, POST | Individual and bulk mark-read. Push registration/delivery and deep links are not implemented. |

These methods are wired in source and remain subject to real CI, live isolated-API testing and server-side authorization. Table inclusion is not a claim that an end-to-end test has passed.

## Request behavior

- Authenticated calls use the access token from Expo SecureStore.
- A 401 response may trigger one refresh request through the existing refresh-token API. If it fails, client credentials are cleared.
- Responses matching the existing success/data envelope are unwrapped.
- The client uses request timeouts, actionable generic server/network messages, and a generated X-Idempotency-Key for non-GET requests. Endpoint-level rules still determine whether an action is idempotent and transactional.
- 403s are surfaced as denied operations.
- Query data is in-memory, and the query client clears after account identity changes.
- The workspace provider validates scope changes through `/workspace/context`, then resets and invalidates cached queries. Context identifiers are only appended to known list endpoints with compatible query contracts (`/departments`, `/programs`, `/semesters`, `/sections`, `/course-offerings`); other screens still depend on their dedicated API scope enforcement and may require explicit filters.
- The client does not implement multipart/binary operations or offline write queues.

## Backend changes and migrations

The existing `GET /workspace/context` route and service were extended to accept campus selection, return accessible campus options and campus scope, keep department options switchable within the authorized campus set, and explicitly reject an invalid selected academic year. No Prisma schema or database migration was added. The protected production branch and production records were not changed.

## Contract work still required

Every feature needs a dedicated, typed API contract based on the actual route validator and service/controller response. Add isolated integration tests for success, validation failures, expired and revoked sessions, deactivated users, direct unauthorized calls, tenant/campus/department/individual-student isolation, and mutation idempotency. The generic record normalizer intentionally does not pretend to supply these module-level contracts.

Password recovery requires a backend contract before implementing a native recovery screen; the inspected auth router did not expose a password-reset endpoint.
# Phase 1 — Authentication + Multi-Tenant Foundation

## Scope
Institution/User/RBAC data model, JWT access + rotating opaque refresh
tokens, password hashing, `authenticate`/`authorize` middleware, tenant
context resolution, and an audit log foundation.

## New Prisma models
- `Institution` — a tenant. AIMT is the first row, not a special case.
- `User` — `institutionId` is nullable (null only for SUPER_ADMIN).
- `Role` — institution-scoped except `SUPER_ADMIN` (`institutionId = null`).
  Roles are data, not an enum — new institutions can define their own.
- `Permission` — global catalog, e.g. `students.read`.
- `RolePermission` / `UserRole` — join tables.
- `RefreshToken` — stores only a SHA-256 hash of the token, supports
  rotation and reuse detection.
- `AuditLog` — foundation only; wired up for auth events in this phase,
  intended to be called from every sensitive mutation in later phases.

## Endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/v1/auth/login` | none | `{ email, password }` |
| POST | `/api/v1/auth/refresh` | none | `{ refreshToken }` — rotates the token |
| POST | `/api/v1/auth/logout` | none | `{ refreshToken }` — revokes it |
| GET | `/api/v1/auth/me` | Bearer access token | Fresh roles/permissions from DB |

## Tenant isolation — how it's enforced
`institutionId` is **never** read from the request body, query string, or
route params for authorization purposes. It is embedded in the signed
access token at login/refresh time (derived from the `User` row in the
database) and attached to `req.user.institutionId` by the `authenticate`
middleware. Every future protected route must scope its Prisma queries
using `req.user.institutionId`, not a client-supplied value.

## RBAC — how it's enforced
`authorize('students.read')` (and similar) checks `req.user.permissions`,
which is the de-duplicated union of every permission granted by every
role the user holds, computed fresh from the database at login/refresh
(and again on `/auth/me`). Route handlers check **permissions**, never
role names — so an institution can rename or add roles later without any
controller code changing.

## Token strategy
- **Access token:** JWT, 15 minutes by default (`JWT_ACCESS_EXPIRES_IN`),
  carries `sub`, `institutionId`, `email`, `roles`, `permissions`.
- **Refresh token:** opaque random string (not a JWT), 30 days by default
  (`JWT_REFRESH_EXPIRES_IN_DAYS`). Only its SHA-256 hash is stored.
  Refreshing **rotates** the token: the old one is revoked and a new
  pair is issued. Presenting an already-revoked refresh token is treated
  as possible theft and revokes every active token for that user.
- Deactivating a user (`isActive = false`) takes effect immediately on
  refresh/login, and within `JWT_ACCESS_EXPIRES_IN` for an already-issued
  access token — a live access token is not individually revocable in
  this phase. Keep `JWT_ACCESS_EXPIRES_IN` short for that reason.

## Decisions that affect future phases
- The frontend does not yet store/send tokens (Phase 0's page still just
  checks `/health`). Phase 2+ frontend work should read
  `docs/PHASE-1.md` before adding a login form: refresh tokens are
  returned in the JSON body, not a cookie — deciding between httpOnly
  cookie storage vs. in-memory storage belongs to whichever phase adds
  the frontend auth flow, not to this phase.
- `authorize()` takes permission keys, never role names — keep using it
  that way in every future route.
- Every protected route added from here on should use both
  `authenticate` and, where relevant, `authorize(...)` — see
  `src/routes/auth.routes.ts` for the pattern.
- `recordAuditLog()` in `src/services/audit.service.ts` is ready to be
  called from any future sensitive mutation (user management, marks
  entry, fee changes, etc.).

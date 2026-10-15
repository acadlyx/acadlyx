# Placement Workspace Authorization and Runtime Audit — 2026-10-15

## Scope

Reviewed the Placement frontend request clients, shared dashboard shell, protected Placement router, live Render logs, and the live PostgreSQL table inventory. This report distinguishes source inspection from runtime evidence; it does not claim a successful build or end-to-end test.

## Authorization findings

- The backend Placement router applies `authenticate` and `requireFeature("placements")` to the router before endpoint handlers.
- Read operations use `authorize("placements.read")`; create/update operations use `authorize("placements.manage")`.
- Company, drive, opening, interview, visit, offer and metrics handlers resolve the institution and authenticated actor before calling the service layer. Backend authorization remains the enforcement boundary.
- Protected frontend Placement requests must use `authedFetch` / `authedBlobFetch`; the generic `apiFetch` does not attach a Bearer token. This audit found seven additional role dashboards still using the generic client: Institution Admin, Management, Registrar, Dean, Faculty, HOD and Parent. Those seven dashboards have now been switched to `authedFetch`, with explicit session-expired messaging. The main Placement Team, Chairman, Director, Company Master, drives, openings, visits, interviews, tests, offers and reports paths were already using the authenticated client.
- Render logs show `GET /api/v1/placements/companies` returning 401 at 2026-10-15 07:27:24Z and 07:30:50Z, before the latest live backend deploy at 07:48:18Z. Later Placement company requests reached authenticated route handlers. This suggests the earlier missing-header issue may have been tied to the old frontend/request path, but a browser-level verification is still required to rule out stale frontend assets or another remaining caller.

## Confirmed 500 root cause

Render logs at 2026-10-15 08:34:04Z show:

`GET /api/v1/placements/companies` → 500

Prisma reports that `public.placement_company_history` does not exist. The current Prisma schema includes `PlacementCompanyHistory`, and `listPlacementCompanies` queries the relation, so the route fails even after authentication succeeds.

The live database inventory also lacks `placement_joining_verifications`, although the current Prisma schema includes `PlacementJoiningVerification`. The joining-verification workflow is therefore at risk of similar database errors.

A `POST /api/v1/placements/companies` request at 08:32:36Z returned 409 due to the existing unique constraint on `(institutionId, name)`. That is a duplicate-company conflict, not an authentication failure or a server crash; the UI should present it as a conflict.

## Remediation prepared

This branch adds two forward-only Prisma migrations:

1. `20261015010000_placement_company_history`
2. `20261015020000_placement_joining_verifications`

They create the missing tenant-scoped tables, indexes, uniqueness constraints, and foreign keys. No existing rows or authorization rules are loosened. The migrations have been committed to this branch but have **not** been applied to the live database and this branch has **not** been merged or deployed.

## Verification still required

- Run backend typecheck/build and migration validation against a disposable database.
- After an authorized deployment, confirm both tables exist and Prisma migrations are recorded.
- Sign in with test accounts for Placement, Institution Admin, Management, Registrar, Dean, Faculty, HOD, Parent, Chairman and Director; verify every dashboard request sends `Authorization: Bearer ...`, and confirm expired/missing sessions show a sign-in message rather than a raw backend auth error.
- Verify tenant isolation and read/manage permissions with at least two institutions and a non-Placement role.
- Confirm company listing and joining-verification routes return successful responses; inspect request IDs and backend logs for any remaining 401/403/500.

## Safety

Do not bypass `authenticate`, `requireFeature`, `authorize`, institution resolution, or service-level scope checks to mask these failures. The missing-table issue must be resolved through tracked migrations.

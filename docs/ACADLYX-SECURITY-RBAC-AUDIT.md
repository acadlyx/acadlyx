# ACADLYX Security, RBAC and Data-Isolation Audit — Milestone 3

Date: 2026-10-09  
Repository: acadlyx/acadlyx  
Working branch: stabilization-platform-2026-10-09  
Protected base: production-upgrade-2026-09-20  
Scope: source-level authentication, authorization, RBAC, entitlement and scope audit. No production deployment, base-branch write, database mutation or secret access was performed.

## Executive status

**Overall: PARTIALLY VERIFIED; executable verification BLOCKED.** One confirmed session-invalidation defect was fixed in source and pure regression tests were added. The patch has not been compiled or executed in this environment. This is not a declaration that ACADLYX is fully secure.

The repository connector permits branch source reads and commits but this execution environment has no ACADLYX checkout. Consequently the test suite, TypeScript, lint, production builds, API integration, browser tests and authenticated runtime checks could not be run. A source-level review cannot prove every route, export, background job or query enforces isolation.

## Status definitions

- **FIXED** — source changed to address a confirmed cause; runtime verification may still be pending.
- **VERIFIED** — the stated behavior was executed and passed.
- **PARTIALLY VERIFIED** — source or a subset of behavior was inspected, but required execution/coverage is missing.
- **UNVERIFIED** — insufficient evidence to decide.
- **BLOCKED** — the necessary checkout, runtime, test database, credentials or browser is unavailable.

## Canonical authorization contract

The existing implementation's intended contract is:

1. **Identity and account state:** JWT signature/expiry validates the access token; backend/src/middleware/authenticate.ts reloads the user and role bindings from the database and rejects missing/inactive users.
2. **Session validity:** each access JWT is tied to a refresh-token record through sid. A request must now prove that this record exists, belongs to the JWT subject, has not been revoked, and has not expired.
3. **Role and permission source:** backend/src/config/rbac.ts defines SYSTEM_ROLE_NAMES, ROLE_PERMISSIONS, normalization, platform permission classification and effective permissions. backend/src/config/permissions.ts is a compatibility re-export, not a second catalogue. Effective request permissions are computed from canonical role names via getEffectivePermissions.
4. **Tenant identity:** effective institutionId is derived from current database user/role bindings. Conflicting institution bindings are rejected. Client-provided tenant identifiers are not authoritative.
5. **Operation permission:** backend/src/middleware/authorize.ts checks all requested permissions unless a route explicitly uses authorizeAnyPermission. Role gates are additional workspace restrictions, not substitutes for permissions.
6. **Module entitlement:** backend/src/middleware/requireFeature.ts calls assertTenantFeature; entitlement is independent from RBAC. Canonical keys are in backend/src/config/features.ts; subscription/feature records are managed by backend/src/services/entitlement.service.ts.
7. **Resource scope/workflow:** service/resource checks must additionally enforce institution, campus, department, program, course offering, student relationship and workflow authority. The shared scope implementation is backend/src/services/accessScope.service.ts. Frontend checks are UX only; they cannot authorize backend requests.

The code-derived permission union is currently based on the canonical role catalogue. Whether institution-specific, user-specific or database-managed role grants are intended to exist as a separate supported capability was not established by this source pass; no parallel permission model was introduced.

## Confirmed finding

### M3-001 — Revoked refresh sessions did not invalidate already-issued access JWTs

**Status: FIXED (source); PARTIALLY VERIFIED (regression tests authored, not executed). Severity: High.**

**Evidence before the fix:** backend/src/services/auth.service.ts rotates refresh tokens and revokes refresh records on logout, password change and token reuse. Access tokens carry sid, and the Prisma RefreshToken model stores userId, expiresAt and revokedAt. However, the previous authenticate middleware verified JWT expiry and reloaded the active user/roles but did not check the sid record. A stolen access JWT could therefore remain accepted until JWT expiry after its refresh session was revoked.

**Root cause:** access-token verification and refresh-session revocation were not connected at the protected-request boundary.

**Fix:** backend/src/middleware/authenticate.ts now rejects tokens with no session id and loads the corresponding refresh record, validating that it belongs to the token subject and is not revoked or expired before attaching req.user. This makes logout, refresh rotation, password-change revocation and session revocation take effect for subsequent authenticated requests using that session. Existing access tokens lacking sid must sign in again; this compatibility impact is intentional and should be checked in staging.

**Regression tests added:** backend/src/utils/refreshSession.ts and backend/src/__tests__/refreshSession.test.ts cover active, missing, wrong-user, revoked, expired and boundary-expired session records. These tests are authored but **not run** in this environment.

**Changed files:**
- backend/src/middleware/authenticate.ts
- backend/src/utils/refreshSession.ts
- backend/src/__tests__/refreshSession.test.ts

No Prisma migration is required; the sid and refresh-session columns already exist in the inspected schema.

## Authentication and session lifecycle inventory

| Area | Source evidence | Status / remaining check |
|---|---|---|
| Login / password validation | routes/auth.routes.ts, controllers/auth.controller.ts, services/auth.service.ts; login rate limiting, schema validation, inactive-account rejection, failed-login tracking and optional MFA challenge are present | PARTIALLY VERIFIED — no HTTP execution |
| JWT signature / expiry | utils/jwt.ts signs and verifies access JWTs; access-token expiry comes from configuration | PARTIALLY VERIFIED — invalid/expired-token tests not executed |
| Current user, role and tenant refresh | authenticate.ts reloads active user and role bindings from DB per request | PARTIALLY VERIFIED — DB/runtime unavailable |
| Refresh rotation | auth.service.ts stores only hashed opaque refresh tokens, revokes the old record and issues a new record | PARTIALLY VERIFIED — concurrent refresh race/integration test remains UNVERIFIED |
| Revoked-session access | New active-session check in authenticate.ts | FIXED in source; tests not executed |
| Logout | POST /auth/logout revokes the submitted refresh record; the new middleware also checks access-token session state | PARTIALLY VERIFIED — endpoint and subsequent-request test not run |
| Password change | POST /auth/change-password checks current password, changes hash and revokes active refresh records | PARTIALLY VERIFIED — old access-token rejection not run |
| Disabled users / institution | Authentication rejects inactive users/institutions and unavailable subscription states | PARTIALLY VERIFIED — runtime paths not run |
| Per-tab credentials | frontend/src/lib/auth.ts uses sessionStorage, single-flight refresh, and per-JS-realm caches; legacy shared localStorage keys are removed without being read for authentication | PARTIALLY VERIFIED — browser multi-tab test unavailable |
| Protected route initialization | ProtectedRouteBoundary.tsx waits for current-user resolution and route check before mounting protected children | PARTIALLY VERIFIED — browser/race tests unavailable |
| Shared authenticated requests | authedFetch, authedDownload, authedBlobFetch attach bearer tokens and use shared refresh handling | PARTIALLY VERIFIED — all direct fetch call sites not exhaustively enumerated |
| Generic apiFetch | frontend/src/lib/api.ts is a separate request/cache helper and does not attach bearer credentials; its intended use is not proven to be limited to public endpoints | UNVERIFIED — complete call-site inventory required before changing it |
| Token confidentiality | No token values were intentionally logged or emitted by the new code | PARTIALLY VERIFIED — repository-wide secret/log scan not run |

## Role-to-permission and scope matrix

This is the source-reviewed baseline, not a claim that every page/API has been tested. The exact permission keys are defined in backend/src/config/rbac.ts; route middleware remains authoritative.

| Canonical role | Intended authority boundary | Source-reviewed scope/control | Status |
|---|---|---|---|
| SUPER_ADMIN | Platform operations; not automatically an institution operator | Platform permission gate in authorize.ts; institution context must remain null | PARTIALLY VERIFIED |
| INSTITUTION_ADMIN | Institution administration and academic structure; not unrestricted specialist finance/exam/HR operations | Explicit role permission array and authorization-foundation tests | PARTIALLY VERIFIED |
| CHAIRMAN / MANAGEMENT | Governance and leadership read/report scope; explicitly granted approval/configuration permissions only | ROLE_PERMISSIONS and leadership read catalogue | PARTIALLY VERIFIED |
| DIRECTOR | Leadership, approval and assigned campus scope | accessScope.service.ts derives Director campus IDs from CampusAccess; department proxy is not used for campus authority | PARTIALLY VERIFIED |
| DEAN | Assigned academic scope | Managed department assignments and department-bound academic queries | PARTIALLY VERIFIED |
| HOD | Assigned department scope | DepartmentAccess through getManagedDepartmentIds | PARTIALLY VERIFIED |
| FACULTY | Assigned teaching scope | Active course offerings assigned to actor constrain student scope in shared scope helper | PARTIALLY VERIFIED |
| ACCOUNTS | Explicit finance permissions within institutional scope | Dedicated Finance/fee permissions; separate canonical and legacy finance contracts | PARTIALLY VERIFIED |
| EXAMINATION | Examination operations granted by its permission array; institution scope remains mandatory | Permission middleware and feature middleware in routed modules | PARTIALLY VERIFIED |
| REGISTRAR | Explicit institutional academic/administrative scope | Role permissions plus service scope checks | UNVERIFIED per endpoint |
| ADMISSIONS | Admissions operations within institution scope | Role permissions and route-level feature/permission middleware where present | UNVERIFIED per endpoint |
| LIBRARIAN | Library workflows within institution scope | Role permissions and library routes; record-level access not exhaustively traced | UNVERIFIED per endpoint |
| HR | HR/leave operations explicitly granted | Role permissions and HR/leave routes; record scope not exhaustively traced | UNVERIFIED per endpoint |
| PLACEMENT | Permitted placement workflows and institution-bound company/placement records | Placement authorization tests exist; cross-tenant adversarial execution unavailable | PARTIALLY VERIFIED |
| IT | Explicit IT/operations permissions, not role-name-only access | Canonical role catalogue | UNVERIFIED per endpoint |
| CMS | CMS permissions and tenant CMS entitlement where enforced | CMS role exists; all media routes/downloads not exhaustively checked | UNVERIFIED per endpoint |
| STUDENT | Self-service records, not institutional student-directory access | RBAC foundation test states no students.read; student-specific APIs must self-scope | PARTIALLY VERIFIED |
| PARENT | Linked-child self-service only | RBAC foundation test states no directory permission; linked-student endpoints need adversarial testing | PARTIALLY VERIFIED |
| CLUB_PRESIDENT | Only its specifically assigned club/workflow permissions | Role exists in canonical catalogue; workspace and record scope not exhaustively traced | UNVERIFIED |

Role names alone must not be treated as proof of permission or record ownership. The backend must enforce the permission, tenant entitlement, resource scope and workflow authority for each operation.

## Route/API to permission/entitlement mapping

Representative route-level contracts found in source:

| Route group / operation | Authentication | Permission | Entitlement | Scope requirement |
|---|---|---|---|---|
| GET /api/v1/auth/me | authenticate | Authenticated session | None | Current user only |
| POST /api/v1/auth/refresh | Refresh token validated by service | Valid refresh record, active user and tenant | Subscription usability check | Subject bound to refresh record |
| POST /api/v1/auth/logout | Refresh token validated by service | Own refresh token | None | Revokes only matching record |
| User list/detail | Router authentication | users.read | Route-specific if declared | Must be institution-bound and record-scoped |
| Fee structures/heads | Router authentication | fees.structure.read / fees.structure.manage; approval uses fees.structure.approve | fees | Academic references and student/structure belong to tenant |
| Canonical Finance reads/mutations | Authenticated Finance router | fees.read, fees.invoice.manage, fees.payment.record, specialized concession/refund permissions | fees | Institution-bound financial records |
| Legacy ERP payment | Authenticated legacy ERP route | fees.pay | payments in the inspected legacy route | Institution-bound student/invoice/payment |
| Import preview/commit | authenticate | imports.manage | import_export | Imported rows must be validated against caller's tenant/scope |
| Export endpoints | authenticate | reports.read in the inspected export router | import_export | Export query must preserve row-level scope |
| Feature-protected academic/library/placement APIs | Route-dependent | Route's explicit permission(s) | Relevant key in features.ts | Resource/service scope is independently required |

This table is deliberately representative. The complete exhaustive mapping of every route, UI button, mutation, export, download and background job remains **UNVERIFIED**; the existence of middleware imports in a router does not prove that every nested query is correctly scoped.

## Entitlement rules and findings

- **PARTIALLY VERIFIED:** requireFeature(feature) calls assertTenantFeature(institutionId, feature) separately from authorize(permission).
- **PARTIALLY VERIFIED:** TENANT_FEATURES is defined in backend/src/config/features.ts; fee, payment, exams/results, placements, admissions, HR, library, CMS, LMS and other feature keys exist.
- **PARTIALLY VERIFIED:** unavailable subscription statuses and expired subscriptions are rejected; disabled feature records are rejected.
- **UNVERIFIED:** entitlement changes and caches under concurrent requests, all export/download routes, and background-job execution paths were not exercised.
- **UNVERIFIED:** legacy tenant lazy provisioning and default entitlement policy require explicit product/security review; no policy was changed in this milestone.
- **Policy invariant:** an entitlement never grants a permission; a permission never overrides a disabled entitlement; disabling a feature must not delete its historical records.

## Tenant, campus, department and student isolation

### Source-reviewed safeguards

- **PARTIALLY VERIFIED:** authenticate.ts resolves tenant context from current DB user/role assignments and rejects conflicting institution bindings.
- **PARTIALLY VERIFIED:** authorize.ts requires institution context for non-platform permissions and blocks platform-only permissions for institution roles.
- **PARTIALLY VERIFIED:** accessScope.service.ts centralizes department/program/semester/section/course/offering scope helpers. Director scope is derived from CampusAccess, HOD/Dean scope from DepartmentAccess, and faculty student scope from active course offerings.
- **PARTIALLY VERIFIED:** tests in authorization.test.ts cover pure same-institution decisions, permission gates and role separation.

### Required adversarial cases still UNVERIFIED

- MCA HOD changing parameters/IDs to access B.Tech students, courses, analytics or nested records.
- Faculty access to an unassigned course offering/section/student through detail, search, bulk, export and indirect references.
- Student A accessing Student B's fees, results, admit card, profile, documents or download URLs.
- Parent access to an unlinked student or a record indirectly linked through another module.
- Cross-institution company, invoice, examination, campus, file or export access.
- Pagination totals, aggregation and dashboard analytics preserving the same row-level scope as list/detail APIs.
- Campus-bound Director queries across every module, including exports and background tasks.
- Tenant-sensitive GET caches/in-flight request de-duplication after account/session changes.
- Superadmin platform operations and tenant-specific administration boundaries in authenticated runtime.

## File/download and raw request audit

- **PARTIALLY VERIFIED:** shared authenticated helpers in frontend/src/lib/auth.ts attach the current tab's bearer token and refresh on 401; download helpers also retry after refresh.
- **PARTIALLY VERIFIED:** data-transfer APIs use authedFetch / authedBlobFetch; the CMS page uses authedFetch for reads, writes and media upload on this branch.
- **UNVERIFIED:** complete repository-wide raw fetch / Axios inventory, signed URL ownership, generated PDFs/admit cards, report exports and static/media access.
- **UNVERIFIED:** no exhaustive background-job inventory was completed; startup schedules include deleted-user cleanup and domain-event outbox draining in backend/src/index.ts. Each job's tenant context and authorization assumptions need a dedicated review.

## Exact verification ledger

| Check | Exact command / evidence | Result |
|---|---|---|
| Working branch source read | GitHub tree and file reads at stabilization-platform-2026-10-09 | PASS for source retrieval only |
| Confirm no base branch write/deploy | Remote commits were made only with working-branch target; no deployment action used | PASS for actions taken in this milestone |
| New refresh-session tests | cd backend && npm test | BLOCKED — no local repository checkout; not executed |
| Backend TypeScript | cd backend && npm run typecheck | BLOCKED — not executed |
| Backend lint | cd backend && npm run lint | BLOCKED — not executed |
| Frontend TypeScript | cd frontend && npm run typecheck | BLOCKED — not executed |
| Frontend lint/build | cd frontend && npm run lint and cd frontend && npm run build | BLOCKED — not executed |
| Prisma schema validation | cd backend && npx prisma validate | BLOCKED — not executed |
| Authenticated API integration | Isolated test database and login-issued test tokens; replay revoked access token | BLOCKED — no runtime/test database or credentials available |
| Browser/session tests | Multi-tab, reload, concurrent 401/refresh, expired-session form submission | BLOCKED — no browser runner/runtime available |
| Tenant/campus/department adversarial suite | Isolated fixtures for cross-tenant/cross-scope list/detail/export/mutation | BLOCKED — not executed |
| Final source diff and static security scan | git diff --check, full route/raw-fetch/secret scan | BLOCKED — no local checkout; remote source was reviewed selectively |

No command is reported as passed unless it was actually executed. No database migration was added or applied. No production database or secret was accessed.

## Remaining risks / follow-up work

1. Run the new tests and the full backend/frontend check suites in a real checkout using each package's declared Node engine. Fix any compile/test failures before merge.
2. Add an integration test proving that a previously valid access token returns 401 immediately after logout, refresh rotation and password change; add concurrent refresh tests to evaluate rotation races and avoid unintended account-wide revocation on benign concurrency.
3. Complete a machine-generated route/API-to-permission-and-entitlement inventory, then trace each controller/service/database query including nested relations, list counts, search, filters, bulk actions, exports, downloads and jobs.
4. Audit all direct request call sites and ensure authenticated requests use the tab-scoped auth helpers; prove apiFetch has only public callers or explicitly harden its contract.
5. Run cross-tenant/campus/department/student/parent adversarial tests with isolated test data.
6. Confirm whether custom database role-permission grants or user-specific grants are supported. If yes, align authenticate/auth-service effective permission loading with that established source of truth rather than silently relying only on default role arrays.
7. Review entitlement lazy provisioning/defaults with product policy and test disable/re-enable behavior without deleting historical data.
8. Verify file ownership/signed URLs, PDF/admit-card downloads, scheduled jobs, outbox processing and platform-admin operations.
9. Re-run the complete audit against the final code after all remaining fixes. Do not interpret this milestone report as a platform-wide security certification.



---

# Milestone 10 — Adversarial authorization verification (2026-10-10)

## Candidate identity and method

- Starting branch: `stabilization-platform-2026-10-09`.
- Starting HEAD: `ff14eae53eca1e16b62b1ecff69429f8e0c20e6c`.
- Production baseline: `6ddcc30697071b6e55505caaf68337f704bdc7cd`.
- Last broad hosted CI source SHA before this milestone: `c10ec08489756ba770467fff7b81e7f992b2d0f0`.
- GitHub confirmed starting HEAD `ff14eae53eca1e16b62b1ecff69429f8e0c20e6c). Compare from `c10ec08...` shows six commits and only three modified documentation paths: the readiness audit, risk register, and deployment/rollback checklist. The application tree was unchanged between the CI-tested SHA and starting HEAD.
- The GitHub API exposes remote refs/files only. A local checkout/upstream configuration/local working tree cannot be observed here; local changes are therefore **UNVERIFIED**, not assumed clean.
- No production branch write, deployment, production database access, or destructive operation occurred.

## Threat model

Assume an authenticated user may intentionally alter path IDs, query parameters, JSON fields, nested foreign keys, export types, file IDs, or bulk lists; retain a stale access token after logout/role changes; have a valid module permission but disabled tenant entitlement; or hold a role valid for a different institution/campus/department. The security objective is to deny unauthorized reads and writes at backend boundaries, without relying on UI visibility or caller-supplied tenant scope.

Layers found in source:
1. `authenticate`: verifies signed access token, binds it to a live refresh-session record, reloads active user and role bindings from the database, resolves institution identity and rejects conflicting tenant bindings.
2. `authorize`: requires the specific backend permission and institutional context; platform permissions are separately gated to SUPER_ADMIN.
3. `requireFeature` + `assertTenantFeature`: requires a current tenant subscription and enabled feature entitlement; missing feature rows are provisioned and re-read, and inactive/expired subscriptions are denied.
4. `accessScope.service`: database-backed department, campus, course-offering and student scope functions; Director department scope is derived from CampusAccess, not department assignments.
5. Domain service relationships/workflow authority: Parent portal queries ParentStudentLink for each child request; workflow authority checks approval authority and separation of duties.
6. File storage and exports: tenant-scoped file lookup; per-module permission checks; export type permission map.

These are source findings, not proof that every endpoint uses every required layer.

## Route-to-permission inventory (inspected routes)

The API prefix is `/api/<configured apiVersion>`, mounted in `backend/src/app.ts`. The inventory below is a high-priority sample of actual route files, not a claim that all 57 route modules have been audited endpoint-by-endpoint.

| Route family / file | Backend gate observed | Resource / scope control observed | Assessment |
|---|---|---|---|
| `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me`, `/auth/account` — `auth.routes.ts` | Login/token rate limits and request validation where applicable; authenticated middleware for account operations | Profile/photo functions use authenticated user ID; refresh/logout logic requires separate tests | PARTIALLY VERIFIED |
| `/students/me/**` — `student.routes.ts` | `authenticate`, `requireFeature("students")`, `authorizeRoles("STUDENT")` | Self-service routes are ordered before `/:id`; admin routes use students.read/create/update | PARTIALLY VERIFIED |
| `/parent/children/**` — `parentPortal.routes.ts` | `authenticate`, `requireFeature("parent_portal")`, `authorize("parent-portal.read")` | `assertParentOfChild` queries `parentStudentLink` for each requested student; unlinked child uses 404 to avoid ID probing | PARTIALLY VERIFIED |
| `/campuses/**` — `campus.routes.ts` | `authenticate`; read/create/update/delete permission per operation | Controller/service scope still needs adversarial DB-backed tests; access assignment endpoints are sensitive | PARTIALLY VERIFIED |
| `/departments/**` — `department.routes.ts` | `authenticate`, `requireFeature("academics")`, per-operation departments permission | Controller/service scope still needs adversarial DB-backed tests | PARTIALLY VERIFIED |
| `/finance/**` — `finance.routes.ts` | `authenticate`, `requireFeature("fees")`; action-specific invoice/payment/concession/refund permissions; export has any-permission gate | Controller/service ownership, approval, id substitution, idempotency and persisted-state checks not exercised here | PARTIALLY VERIFIED |
| `/exports/**` — `export.routes.ts` | `authenticate`, `requireFeature("import_export")`; map of export type to domain permission; dedicated attendance gate | Unknown export types pass the route middleware to service-level validation; service validation and all exported query scopes require explicit tests | PARTIALLY VERIFIED |
| `/files/**` — `fileStorage.routes.ts` | `authenticate`; controller checks module permission for upload/delete and permission/ownership for read | Storage service filters file lookup by authenticated tenant; owner access can bypass module read permission and requires policy confirmation when role permissions are revoked | PARTIALLY VERIFIED |
| `/examinations/**` — `examination.routes.ts` | `authenticate`, `requireFeature("exams")`, route-level exams/marks/results permissions | Examination eligibility, marks scope, result publication and artifact generation require database-backed tests | PARTIALLY VERIFIED |
| `/attendance/**` — `attendanceGovernance.routes.ts`, `attendance-sessions/**` — `attendanceSession.routes.ts` | `authenticate`, attendance entitlement and read/correct/approve/lock permissions in governance routes | Session ownership and student scope need adversarial tests; session routes require review for consistent write gates | PARTIALLY VERIFIED |
| `/assignments/**` — `assignment.routes.ts` | `authenticate`, assignments entitlement and read/create/update/review/submit permissions | Assignment ownership, student submissions and reviewer scope need adversarial tests | PARTIALLY VERIFIED |
| `/lms/**` — `lmsProduction.routes.ts` | Per-action LMS, certificate and notice permissions | Service-level offering/student/file relationships need adversarial tests | PARTIALLY VERIFIED |
| `/placements/**` — `placement.routes.ts` | Per-action placements.apply/read/manage permissions | Student ID filters, test participant IDs, application transitions and profile ownership need adversarial tests | PARTIALLY VERIFIED |
| `/workflow/**` and approval services | Permission middleware where route declares it; `workflowAuthority.service.ts` contains domain-specific approval guards | Own-request denial and department authority exist for several workflow types; not exercised against DB fixtures | PARTIALLY VERIFIED |

## Adversarial regression test added

New file: `backend/src/__tests__/authorization-adversarial.test.ts`.

The file adds 12 deterministic unit tests against existing authorization contracts:
- Same-institution positive control.
- Institution A to Institution B resource substitution denied.
- Cross-user ID denied despite a module permission.
- Self-resource positive control.
- Student-to-student substitution denied.
- Missing write permission denied.
- Institution role cannot invoke platform-only permission, even with a stale permission string.
- SUPER_ADMIN does not automatically receive finance operational permission.
- Parent denied absent a server-verified linked-child boolean.
- Parent relationship positive control with the verified-link flag.
- Parent relationship does not grant student-directory permission.
- Owner ID substitution denied.

These tests exercise pure decision helpers. They do **not** create database fixtures, invoke HTTP routes, verify persisted state/side effects, or prove database-backed campus/department/faculty relationships. Those tests remain **BLOCKED** in this environment because no local repository checkout, disposable PostgreSQL integration fixture, or API test harness is available through the repository connector.

## Test identities / scopes

The new unit tests use synthetic IDs only:
- `institution-a`, `institution-b`
- `admin-a`, `faculty-a`, `student-a`, `student-b`, `parent-a`, `platform-admin`
- Role/permission lists come from the actual `config/rbac.ts` permission catalogue; no credentials or real personal data are used.

No actual database rows were created.

## Reproducible commands

Run from `backend/` on the declared backend Node 20 runtime after `npm ci`:

```sh
npm test
npm run typecheck
npm run lint
npm run build
npx prisma validate
npx prisma generate
```

For integration tests, provide an explicitly disposable PostgreSQL database using the repository's test configuration. Do not point tests at production.

## Findings and unresolved risks

| Finding | Evidence | Status |
|---|---|---|
| Core permission + institution-target pure decision contract | New deterministic tests in `authorization-adversarial.test.ts`; execution pending hosted CI | UNVERIFIED pending run |
| Parent-child link enforcement in parent portal service | Source shows DB lookup by institutionId + parentId + studentId per request; no integration test run | PARTIALLY VERIFIED |
| Campus / department / course-offering / faculty scope | DB-backed functions exist in `accessScope.service.ts`; no isolated adversarial fixture run | UNVERIFIED |
| Module entitlement plus user permission conjunction | `requireFeature` and route-level `authorize` observed on sampled routes; negative entitlement/permission matrix not integration-tested | PARTIALLY VERIFIED |
| File ID substitution and module read after permission revocation | File query is tenant-scoped; owner fallback bypasses module read permission. Whether this is intended ownership policy requires domain-owner decision and tests | BLOCKED pending policy/test |
| Export query scope and unknown export type | Route maps known export types to permissions, then defers unknown types to service; all service query scopes not yet verified | UNVERIFIED |
| Cross-scope bulk mutations, nested IDs, audit side effects | No HTTP + disposable DB test evidence | BLOCKED |
| Cached authorization and stale sessions after entitlement/scope changes | Auth reloads DB role binding on each request; session helper tests exist; end-to-end role/entitlement invalidation not run | PARTIALLY VERIFIED |

No confirmed exploitable vulnerability was established by runtime reproduction in this milestone. No source-level finding should be relabeled FIXED without a regression test and exact-SHA CI evidence.

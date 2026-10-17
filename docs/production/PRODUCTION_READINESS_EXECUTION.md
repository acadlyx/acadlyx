# ACADLYX Production Readiness Execution Tracker

> This is the authoritative resumable queue for the `native-mobile-parity-2026-10-17` release candidate. Production, `main`, and the production baseline must remain unchanged. PR #77 stays draft and must not be merged or deployed without explicit authorization.

## Execution snapshot

- Repository: https://github.com/acadlyx/acadlyx
- Authorized branch: `native-mobile-parity-2026-10-17`
- Protected production baseline: `production-upgrade-2026-09-20`
- Latest verified branch HEAD at tracker creation: `58b3999f9e47cdbe1307656173e891efcfd4f6cf`
- PR: https://github.com/acadlyx/acadlyx/pull/77 (draft; not approved for merge)
- Latest known required-check snapshot for HEAD above: Native Mobile CI **success**, Frontend build **success**, Production Gate **success**, Production Quality **success**, ERP verification **failure** (run 39058172602; backend job 117470368485). These results apply only to that tested revision.
- Environment limitation: no writable local checkout is mounted in this session. Remote source inspection and branch commits are available through the connected GitHub integration; local shell/test execution is not available here. CI must therefore provide the real runtime/database verification evidence for remote changes. Do not mark code verified before those results arrive.

## Status definitions

- `NOT_STARTED`: work has not begun.
- `IN_PROGRESS`: active investigation or implementation.
- `IMPLEMENTED_UNVERIFIED`: change exists but acceptance checks have not passed.
- `BLOCKED_EXTERNAL`: requires unavailable credentials, hardware, infrastructure, or external owner action.
- `FAILED`: a relevant acceptance check ran and failed.
- `VERIFIED`: all listed acceptance criteria and the relevant checks passed.
- `CANCELLED_WITH_REASON`: intentionally abandoned with an explicit rationale.

## Active P0 — release blockers

### P0-BE-001 — PostgreSQL placement notification test isolation
- Priority/module: P0 / backend domain events and Placement
- Required acceptance: the real PostgreSQL integration test `cohort targeting, idempotent notifications, rescheduling and cancellation stay synchronized` passes; publication notifications are delivered exactly once; draft publication and cancellation preserve schedule visibility; cohort targeting remains institution/current-enrollment scoped; backend suite passes.
- Relevant files: `backend/src/__tests__/placement-audience.integration.test.ts`, `backend/src/services/domainEvent.service.ts`, `backend/src/services/placementAutomation.service.ts`, `backend/src/services/placement.service.ts`.
- Status: `IN_PROGRESS`
- Evidence/observed failure: ERP verification run https://github.com/acadlyx/acadlyx/actions/runs/39058172602 failed test 173 at `placement-audience.integration.test.ts:278`: publication notification expected 1, actual 0. The test helper currently calls `drainDomainEventOutbox(100)` globally. That can spend the bounded drain on unrelated tenants/outbox rows; tests must drain their own institution only.
- Changes made: no fix committed yet at snapshot.
- Tests: run 39058172602 executed 239 tests, 238 passed, 1 failed. Prisma validation/generation/migrations, backend typecheck and build passed in that run. The integration test uses real PostgreSQL (`RUN_POSTGRES_INTEGRATION=1`).
- Commit SHA: pending.
- Remaining defect/dependency: update helper and all call sites to use `drainDomainEventOutbox(100, { institutionId })`; repeat real PostgreSQL integration and full backend suite.
- Precise next action: commit the institution-scoped outbox-drain test fix and rerun ERP verification on the resulting commit.

### P0-BE-002 — Synthetic institution foreign-key failure in domain-event unit test
- Priority/module: P0 / backend event test isolation
- Required acceptance: domain-event fan-out unit test does not issue an invalid foreign-key write; production constraints and event delivery semantics remain unchanged; backend suite emits no fixture-related FK failure.
- Relevant files: `backend/src/__tests__/domain-event.test.ts`, `backend/src/services/domainEvent.service.ts`, `backend/prisma/schema.prisma`.
- Status: `IN_PROGRESS`
- Evidence/observed failure: the same CI log records an outbox insert failure for `institutionId = 'institution-a'`, which is not a row in `institutions`. This is separate from test 173's zero-notification assertion. The unit test verifies subscriber fan-out and does not need a tenant identity.
- Changes made: no fix committed yet at snapshot.
- Tests: captured from backend job 117470368485 in run 39058172602.
- Commit SHA: pending.
- Remaining defect/dependency: make the subscriber-only unit test use a null institution/actor context (or a real disposable fixture if tenant data becomes part of its assertion); do not weaken the FK or swallow a product defect.
- Precise next action: adjust the unit fixture and verify the real database test suite.

### P0-MOB-SEC-001 — Mobile dependency vulnerability review
- Priority/module: P0 / mobile dependency chain
- Required acceptance: current advisory is verified from upstream sources; direct/transitive path and runtime/build-time usage are established; supported remediation or documented residual risk is chosen; lockfile is reproducible; install, compatibility, typecheck, tests, Expo Doctor and platform bundle checks pass.
- Relevant files: `mobile/package.json`, `mobile/package-lock.json`, mobile CI workflow, mobile build/release docs.
- Status: `NOT_STARTED`
- Evidence: current branch lockfile resolves `node-forge@1.4.0`; this alone does not establish current vulnerability status or exploitability.
- Changes made/tests/commit: none.
- Blockers: none confirmed yet.
- Precise next action: verify current upstream advisory and dependency paths before changing versions; inspect SBOM tooling availability.

## Remaining P1 queue

### P1-AUTH-001 — Full backend authorization and workspace isolation
- Priority/module: P1 / authentication, RBAC, API scope
- Acceptance: real Express + disposable PostgreSQL tests verify all canonical roles, multi-role precedence, institution/campus/department/programme/year/batch/semester/section/student/parent boundaries, revoked/deactivated access, record ownership, maker-checker, unauthorized direct REST calls, and cache/context transition safety.
- Relevant files: `backend/src/services/workspaceContext.service.ts`, `backend/src/services/accessScope.service.ts`, `backend/src/utils/workspaceScopeFilters.ts`, route/controller integration tests and mobile context/cache consumers.
- Status: `NOT_STARTED`
- Evidence: the failing ERP run's unrelated scope tests passed, but this is not proof that every authorization acceptance criterion passed.
- Changes/tests/commit: none in this tracker.
- Next action: inventory coverage gaps, add missing real API scenarios and run the PostgreSQL isolation suite.

### P1-WEB-001 — Web institutional/leadership workflows
- Priority/module: P1 / web ERP
- Acceptance: verify actual role routes, leadership data sources, campus/department scope, lifecycle operations, redirects, sidebar uniqueness, real quick actions and correct empty/error/loading states.
- Relevant files: existing app routes, controllers/services, role navigation and tests.
- Status: `NOT_STARTED`
- Changes/tests/commit: none.
- Next action: compare real routes and backend contracts, reproduce reported defects, implement and regress-test one bounded workflow at a time.

### P1-FIN-001 — Finance and fee-structure lifecycle
- Priority/module: P1 / finance
- Acceptance: draft, submit, maker-checker, authorized publication/assignment, invoices, payments, reconciliation, receipts, refund approval/processing, concessions, audit, retries and concurrency obey server/database invariants and scope.
- Relevant files: existing fee, finance, refund, payment controllers/services, schema/migrations, Accounts and Chairman/Director routes.
- Status: `NOT_STARTED`
- Changes/tests/commit: none.
- Next action: trace and reproduce fee-structure and refund workflows; add real API/PostgreSQL concurrency/idempotency tests.

### P1-ACADEMIC-001 — Academic, exam, attendance and learning workflows
- Priority/module: P1 / academics
- Acceptance: attendance/leave, assignments, internal marks, examination schedules, marksheet state transitions, approved/published results, registration, certificate and OBE workflows are functional and scoped.
- Relevant files: corresponding existing routes, controllers, services, role screens and integration tests.
- Status: `NOT_STARTED`
- Changes/tests/commit: none.
- Next action: audit lifecycle completeness against current APIs; reproduce zero performance metrics and any broken role workflow.

### P1-OPS-001 — Admissions, HR, parent, library, LMS, placement and campus operations
- Priority/module: P1 / operational ERP modules
- Acceptance: every user-facing workflow has real CRUD/state transitions, policy validation, audit/idempotency where applicable, scoped errors, and backend-backed tests; no placeholder is described as complete.
- Relevant files: existing module APIs, web/native screens, service and test files.
- Status: `NOT_STARTED`
- Changes/tests/commit: none.
- Next action: prioritize confirmed reported regressions; trace each from frontend through API to database and add regression coverage.

### P1-MOBILE-001 — Native mobile feature parity
- Priority/module: P1 / Expo Android and iOS
- Acceptance: all modules mapped to dedicated implemented workflows (not merely generic read-only surfaces); native navigation/session/file handling are safe; imports/exports and context changes are correct; shared web/mobile data is consistent.
- Relevant files: `mobile/**`, `docs/mobile/MOBILE_FEATURE_PARITY.md`, `MOBILE_IMPLEMENTATION_TRACKER.md`, `MOBILE_KNOWN_LIMITATIONS.md`, `MOBILE_API_INTEGRATION.md`, `MOBILE_TEST_REPORT.md`, `MOBILE_BUILD_AND_RELEASE.md`.
- Status: `NOT_STARTED`
- Evidence: PR #77 explicitly says most modules remain generic read-only surfaces and many workflows are incomplete. Existing mobile CI success does not imply feature parity.
- Changes/tests/commit: none.
- Next action: keep the existing app/backend; implement one module lifecycle at a time with role/scope tests.

### P1-XPORT-001 — Universal exports and imports
- Priority/module: P1 / web and mobile data handling
- Acceptance: applicable pages support authorized filtered/selected/page datasets and supported formats; large exports are server-side; import preview/normalization/row errors/manual correction/commit semantics are tested; student admission-number uniqueness remains enforced.
- Relevant files: existing export/import services, routes, web pages and mobile flows.
- Status: `NOT_STARTED`
- Changes/tests/commit: none.
- Next action: inventory actual tabular pages/APIs and implement missing shared service contracts.

### P1-DB-001 — Migration, outbox, concurrency and recovery reliability
- Priority/module: P1 / Prisma/PostgreSQL/operations
- Acceptance: clean and representative legacy migrations pass; transactional/outbox semantics and retries are verified; indexes and pool behavior are reviewed; finance concurrency, performance and backup/restore rehearsals execute with retained evidence.
- Relevant files: `backend/prisma/**`, backend database integration/performance/recovery scripts, outbox service/tests.
- Status: `NOT_STARTED`
- Changes/tests/commit: none.
- Next action: after P0 outbox tests pass, review transactional delivery/lease failure cases, then execute migration-compatibility, performance and recovery gates.

### P1-SECOPS-001 — Production security and observability
- Priority/module: P1 / auth, app hardening, deployment ops
- Acceptance: current dependency audit; secure sessions/MFA; CORS/headers/rate limits; authorization on uploads/downloads/exports; safe errors/logs; correlated logs, health, timeout/restart, alerts and retention/deletion behavior verified.
- Relevant files: app middleware, auth, file/export endpoints, package lockfiles, environment docs and operational scripts.
- Status: `NOT_STARTED`
- Changes/tests/commit: none.
- Next action: run security checks and trace remaining findings without exposing secrets or weakening controls.

### P1-CI-001 — Exact-commit release-grade CI
- Priority/module: P1 / GitHub Actions
- Acceptance: all required workflow and job-level checks pass on the same release-candidate SHA; no disabled/skipped gate is represented as passed; workflow links and exact SHAs are recorded.
- Relevant files: `.github/workflows/**`.
- Status: `IN_PROGRESS`
- Evidence: at HEAD `58b3999f9e47cdbe1307656173e891efcfd4f6cf`, four reported workflows passed and ERP verification failed. Results must be repeated for any new SHA.
- Next action: fix P0 tests, then review all required workflows and rerun them on the exact resulting commit.

### P1-BROWSER-001 — Real browser and API/device validation
- Priority/module: P1 / QA
- Acceptance: Playwright or existing browser tests cover authorized workflows, form persistence, errors, filtering, session expiry, stale context, imports/exports, cross-tenant isolation, and back navigation. Android/iOS builds and device tests are verified or blocked with exact external requirements.
- Relevant files: existing browser tests, mobile tests/build configuration and CI.
- Status: `NOT_STARTED`
- Changes/tests/commit: none.
- Next action: inspect available automation workflows and identify what can run against disposable CI/staging.

### P1-RELEASE-001 — Staging deployment and recovery acceptance
- Priority/module: P1 / release operations
- Acceptance: compatible frontend/backend revisions, staging migrations, environment/API origins, CORS/auth, health, integrations, recovery, performance, browser/mobile smoke and security dispositions are verified; production remains untouched.
- Relevant files: deployment config, CI, migration/recovery docs/scripts and tracker evidence.
- Status: `NOT_STARTED`
- Changes/tests/commit: none.
- Blockers: staging credentials/device signing availability must be confirmed before native signing and deployment tests.
- Next action: after implementation and CI gates stabilize, prepare staging-only smoke evidence; do not deploy or merge without explicit authorization.

## Verification ledger

| Date (UTC) | Commit | Check | Result | Evidence/notes |
|---|---|---|---|---|
| 2026-10-17 | `58b3999f9e47cdbe1307656173e891efcfd4f6cf` | ERP verification run 2232 | FAILED | https://github.com/acadlyx/acadlyx/actions/runs/39058172602 — backend 238 passed / 1 failed; placement publication notification assertion failed. |
| 2026-10-17 | `58b3999f9e47cdbe1307656173e891efcfd4f6cf` | Native Mobile CI run 230 | SUCCESS | https://github.com/acadlyx/acadlyx/actions/runs/39058172631 — does not imply mobile feature parity or signed device tests. |
| 2026-10-17 | `58b3999f9e47cdbe1307656173e891efcfd4f6cf` | Frontend build run 1387 | SUCCESS | https://github.com/acadlyx/acadlyx/actions/runs/39058172620. |
| 2026-10-17 | `58b3999f9e47cdbe1307656173e891efcfd4f6cf` | Production Gate run 1848 | SUCCESS | https://github.com/acadlyx/acadlyx/actions/runs/39058172744. |
| 2026-10-17 | `58b3999f9e47cdbe1307656173e891efcfd4f6cf` | Production Quality run 2903 | SUCCESS | https://github.com/acadlyx/acadlyx/actions/runs/39058172639. |

## Release decision

**NOT PRODUCTION READY.** The ERP PostgreSQL test failure is an active P0 release blocker; dependency disposition, full role isolation, workflow parity, exports/imports, device validation and staging/recovery gates remain unverified. The production baseline remains protected.

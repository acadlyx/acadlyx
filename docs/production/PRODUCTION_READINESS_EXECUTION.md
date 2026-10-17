# ACADLYX Production Readiness Execution Tracker

> This is the authoritative resumable queue for the `native-mobile-parity-2026-10-17` release candidate. Production, `main`, and the production baseline must remain unchanged. PR #77 stays draft and must not be merged or deployed without explicit authorization.

## Execution snapshot

- Repository: https://github.com/acadlyx/acadlyx
- Authorized branch: `native-mobile-parity-2026-10-17`
- Protected production baseline: `production-upgrade-2026-09-20`
- Latest branch HEAD at this status refresh: `e02303e5fff146312c94e5d6ee6e9849daab0de0` (P0 test fixes plus a stale-RBAC reconciliation fix and regression source check; this exact head's CI was queued when refreshed).
- PR: https://github.com/acadlyx/acadlyx/pull/77 (draft; not approved for merge)
- Prior check snapshot for `58b3999f9e47cdbe1307656173e891efcfd4f6cf`: Native Mobile CI, Frontend build, Production Gate, and Production Quality succeeded, but ERP verification failed (run 39058172602; backend job 117470368485). On updated branch commit `c7698ff636e40f31c24d0714c9635b1ec67b9fcf`, the PR merge candidate `ef7d79870320b69f2e637272bbd48d6de5e69fcd` passed ERP verification with 239/239 tests, and the standalone Frontend build and Native Mobile CI passed. Production Gate and Production Quality's remaining jobs were still running at this refresh. These results are not release-wide completion evidence.
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
- Status: `VERIFIED`
- Root cause: the test helper drained up to 100 events from the global outbox, so unrelated/retryable tenant events could consume the budget before this fixture's publication event.
- Changes made: commit `df4975a230a32637696400cecdaeacd61317af20` changes the helper to accept `institutionId`, drains with `drainDomainEventOutbox(100, { institutionId })`, and updates all seven helper calls.
- Tests: PR merge-candidate ERP verification run https://github.com/acadlyx/acadlyx/actions/runs/39060365657 (tested merge SHA `ef7d79870320b69f2e637272bbd48d6de5e69fcd` containing branch commit `c7698ff636e40f31c24d0714c9635b1ec67b9fcf`) completed with 239 tests passed, 0 failed. The formerly failing test 173 passed. Prisma validation/generation/migrations, backend typecheck/build and full `npm test` passed against disposable PostgreSQL.
- Commit SHA: `df4975a230a32637696400cecdaeacd61317af20` (follow-on fixture cleanup in `c7698ff636e40f31c24d0714c9635b1ec67b9fcf`).
- Remaining defect/dependency: none known for this exact regression; revalidate all required gates on the eventual release-candidate commit.
- Precise next action: continue to the dependency security review and remaining P1 queue; do not infer overall production readiness from this test fix.

### P0-BE-002 — Synthetic institution foreign-key failure in domain-event unit test
- Priority/module: P0 / backend event test isolation
- Required acceptance: domain-event fan-out unit test does not issue an invalid foreign-key write; production constraints and event delivery semantics remain unchanged; backend suite emits no fixture-related FK failure.
- Relevant files: `backend/src/__tests__/domain-event.test.ts`, `backend/src/services/domainEvent.service.ts`, `backend/prisma/schema.prisma`.
- Status: `VERIFIED`
- Evidence/observed defect: the previous full-suite run logged an asynchronous FK violation because this subscriber-only fan-out unit test published with fabricated `institution-a` / `actor-a` IDs that do not exist. This fixture problem was independent of test 173.
- Changes made: commit `c7698ff636e40f31c24d0714c9635b1ec67b9fcf` supplies null institution and actor IDs for the fan-out unit test; it does not change or weaken database constraints.
- Tests: fresh PostgreSQL-backed ERP verification https://github.com/acadlyx/acadlyx/actions/runs/39060365657 passed 239/239 tests. The captured log contains neither the previous synthetic-ID FK error nor a failed test.
- Commit SHA: `c7698ff636e40f31c24d0714c9635b1ec67b9fcf`.
- Remaining defect/dependency: none known for this synthetic fixture; real outbox persistence continues to be covered by integration tests.
- Precise next action: keep production constraints unchanged and move to mobile dependency risk triage.

### P0-MOB-SEC-001 — Mobile dependency vulnerability review
- Priority/module: P0 / mobile dependency chain
- Required acceptance: current advisory is verified from upstream sources; direct/transitive path and runtime/build-time usage are established; supported remediation or documented residual risk is chosen; lockfile is reproducible; install, compatibility, typecheck, tests, Expo Doctor and platform bundle checks pass.
- Relevant files: `mobile/package.json`, `mobile/package-lock.json`, mobile CI workflow, mobile build/release docs.
- Status: `BLOCKED_EXTERNAL`
- Current security evidence (checked 2026-10-18): GitHub Advisory Database GHSA-86w9-cpqp-85rv / CVE-2026-85393 reports high-severity RSA PKCS#1 v1.5 signature-verification ambiguity; affected versions are `<= 1.4.0`, and the advisory currently lists no patched version: https://github.com/advisories/GHSA-86w9-cpqp-85rv . Upstream pull requests attempting fixes were listed as open at review time: https://github.com/digitalbazaar/forge/pulls .
- Dependency path: `expo@57.0.30` -> `expo/node_modules/@expo/cli@57.0.31` -> `node-forge@1.4.0`; additionally `@expo/code-signing-certificates@0.0.6` depends on `node-forge@^1.3.3`. It is not a direct app dependency. This points to Expo CLI/code-signing tooling, but native bundle inclusion and actual call sites still require environment-level dependency/SBOM and bundle tracing before exposure can be fully scoped.
- Changes made/tests/commit: no lockfile modification made. Do not blindly override or patch cryptography while upstream lists no stable patched release.
- Blocker: a supported upstream fixed release is not available in the advisory at this review time; residual high-severity supply-chain/tooling risk remains until a supported patch and compatible Expo resolution can be validated.
- Precise next action: recheck advisory/upstream release status; run `npm audit --omit=dev` and full `npm audit`, generate an SBOM if supported, identify installed package call sites and verify Android/iOS bundle contents in a writable checkout. Then upgrade only to a supported patched release and rerun the mobile compatibility/build suite.

## Remaining P1 queue

### P1-AUTH-002 — Fresh RBAC reconciliation before route rendering
- Priority/module: P1 / frontend authorization state
- Acceptance: when cached roles/permissions are stale, the shell waits for a current `/auth/me` response before running route guards or rendering protected children; authorized users are not redirected based on old permission data. If revalidation fails, old permissions are not treated as fresh; the page presents a recoverable retry state. Backend authorization remains authoritative.
- Relevant files: `frontend/src/components/dashboard/DashboardShell.tsx`, `frontend/scripts/test-library-access.mjs`.
- Status: `IMPLEMENTED_UNVERIFIED`
- Root cause: the old shell initialized `routeAuthReady` to `Boolean(cachedUser)` and called `getCurrentUser({ background: true })`; the API helper explicitly returns a fresh cache immediately while revalidation runs in the background. The route guard could therefore run against stale RBAC and incorrectly redirect a user.
- Changes made: commit `c5d51a642ffb5ca6e7fc2182dcfe312974641744` starts authorization readiness as false, awaits `getCurrentUser({ force: true })`, keeps protected child rendering behind the readiness gate, and displays an accessible retry state when revalidation fails. Commit `e02303e5fff146312c94e5d6ee6e9849daab0de0` adds source-contract regression assertions to the existing Library-access validation script.
- Tests: not yet run for the latest source-fix commit. Frontend workflow run 1393, ERP verification run 2238, Native Mobile CI run 236, Production Gate run 1854 and Production Quality run 2909 are queued/pending for branch head `e02303e5fff146312c94e5d6ee6e9849daab0de0`.
- Commit SHA: `c5d51a642ffb5ca6e7fc2182dcfe312974641744` (implementation), `e02303e5fff146312c94e5d6ee6e9849daab0de0` (regression check).
- Remaining verification: CI must pass on the latest branch/PR merge candidate, and protected browser/API scenarios should verify stale permission refresh and transient auth-service failure. The current CI public/login browser smoke does not yet prove role-switch isolation end to end.
- Precise next action: poll all triggered CI and inspect the new source-check/build outcomes before marking verified.

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
- Evidence: for branch commit `c7698ff636e40f31c24d0714c9635b1ec67b9fcf`, PR merge-candidate ERP verification run 2235 passed in full (239/239); Frontend build run 1390 passed; Native Mobile CI run 233 passed. A subsequent documentation-only tracker commit `43827b02cb3f1afff60e46186f533bd3e8df93a6` also completed ERP verification run 2236, Frontend build run 1391, Native Mobile CI run 234 and Production Gate run 1852 successfully; Production Quality run 2907 was still completing browser smoke. After the RBAC fix and source test, branch head is `e02303e5fff146312c94e5d6ee6e9849daab0de0`, and the five required workflows were queued/pending as runs 1393, 2238, 236, 1854 and 2909 at last refresh. These are different commits and not yet a common green release-candidate set.
- Next action: poll current checks, record the exact merge SHA and per-job results, and do not infer readiness from mixed-commit green jobs.

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
| 2026-10-17 | `c7698ff636e40f31c24d0714c9635b1ec67b9fcf` (PR merge candidate `ef7d79870320b69f2e637272bbd48d6de5e69fcd`) | ERP verification run 2235 | SUCCESS | https://github.com/acadlyx/acadlyx/actions/runs/39060365657 — 239 passed, 0 failed; placement notification regression passes; no synthetic fixture FK violation found in inspected log. |
| 2026-10-17 | `c7698ff636e40f31c24d0714c9635b1ec67b9fcf` | Frontend build run 1390 | SUCCESS | https://github.com/acadlyx/acadlyx/actions/runs/39060365663. |
| 2026-10-17 | `c7698ff636e40f31c24d0714c9635b1ec67b9fcf` | Native Mobile CI run 233 | SUCCESS | https://github.com/acadlyx/acadlyx/actions/runs/39060365676 — dependency compatibility, typecheck/tests/Expo/JS bundle check per workflow; not signed native/device verification. |
| 2026-10-17 | `58b3999f9e47cdbe1307656173e891efcfd4f6cf` | Native Mobile CI run 230 | SUCCESS | https://github.com/acadlyx/acadlyx/actions/runs/39058172631 — does not imply mobile feature parity or signed device tests. |
| 2026-10-17 | `58b3999f9e47cdbe1307656173e891efcfd4f6cf` | Frontend build run 1387 | SUCCESS | https://github.com/acadlyx/acadlyx/actions/runs/39058172620. |
| 2026-10-17 | `58b3999f9e47cdbe1307656173e891efcfd4f6cf` | Production Gate run 1848 | SUCCESS | https://github.com/acadlyx/acadlyx/actions/runs/39058172744. |
| 2026-10-17 | `58b3999f9e47cdbe1307656173e891efcfd4f6cf` | Production Quality run 2903 | SUCCESS | https://github.com/acadlyx/acadlyx/actions/runs/39058172639. |

## Release decision

**NOT PRODUCTION READY.** The two P0 test/fixture issues are verified fixed on the tested PR merge candidate. The stale-RBAC shell fix is implemented but unverified. The high-severity `node-forge@1.4.0` advisory remains an external security blocker without a stable patched release listed; full role isolation, workflow parity, imports/exports, device verification and staging/release gates remain unverified. The production baseline remains protected.

# ACADLYX Production Readiness Execution Tracker

> This is the authoritative resumable queue for the `native-mobile-parity-2026-10-17` release candidate. Production, `main`, and the production baseline must remain unchanged. PR #77 stays draft and must not be merged or deployed without explicit authorization.

## Execution snapshot

- Repository: https://github.com/acadlyx/acadlyx
- Authorized branch: `native-mobile-parity-2026-10-17`
- Protected production baseline: `production-upgrade-2026-09-20`
- Latest exact-head fully green verification checkpoint: `8296efe58d0b6a217a3d1b938c8154c7002eeea1` on `native-mobile-parity-2026-10-17`. All five workflows passed on this SHA: ERP verification (`253 passed / 0 failed`), Frontend build, Production Gate, Production Quality (including six Playwright browser tests, migrations, populated legacy compatibility, backend tests, 10k-student finance workload, backup/restore), and Native Mobile CI. Production Quality's deployment-smoke job was skipped intentionally; no production deployment or merge was performed. P1-AUTH-001 has been verified on this checkpoint; later dashboard/navigation commits on the same branch are newer and have their own queued checks. Treat `8296efe58d0b6a217a3d1b938c8154c7002eeea1` as the last full five-workflow green checkpoint until every newer commit has its own exact-SHA results.
- PR: https://github.com/acadlyx/acadlyx/pull/77 (draft; not approved for merge)
- Baseline `58b3999f9e47cdbe1307656173e891efcfd4f6cf` failed ERP verification (238/239). The P0 event-test corrections later passed against disposable PostgreSQL with 239/239 tests. On the latest tested functional SHA `74da4d1f168d1c09341c689cd082b8310ac5f241`, all five workflows succeeded on the exact same SHA: ERP verification run `39067198692`; Production Quality run `39067198685`; Native Mobile CI run `39067198578`; Production Gate run `39067198580`; Frontend build run `39067198701`. Evidence: https://github.com/acadlyx/acadlyx/actions/runs/39067198692 ; https://github.com/acadlyx/acadlyx/actions/runs/39067198685 ; https://github.com/acadlyx/acadlyx/actions/runs/39067198578 ; https://github.com/acadlyx/acadlyx/actions/runs/39067198580 ; https://github.com/acadlyx/acadlyx/actions/runs/39067198701. The Quality browser job passed six Playwright tests. Production deployment smoke was skipped intentionally; no deployment is authorized. This confirms the tested commit only, not release readiness.
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
- Priority/module: P1 / global frontend authorization boundary and dashboard shell
- Acceptance: each protected destination is gated by fresh `/auth/me` for its route; stale cached roles/permissions cannot cause false denials or redirects; temporary identity-service failures fail closed and provide retry; protected page effects do not run before the destination is authorized; backend authorization remains authoritative.
- Relevant files: `frontend/src/components/auth/ProtectedRouteBoundary.tsx`, `frontend/src/components/dashboard/DashboardShell.tsx`, `frontend/e2e/leadership-authenticated-workspace.spec.mjs`, `frontend/scripts/test-library-access.mjs`.
- Status: `VERIFIED`
- Root cause: both `ProtectedRouteBoundary` and `DashboardShell` independently used cache-fast `getCurrentUser()`; the global boundary wraps the app and could redirect before the shell's fresh check. The shell's earlier effect also wasn't pathname-bound. The initial E2E mock also returned an invalid generic array for `/library/loans/mine` instead of its actual object contract, causing a client-side exception and obscuring the authorization scenario.
- Changes made: `098c154319532a0f7c1de422a44a955717930f56` binds dashboard readiness to the pathname and separates context/branding loading. `fbf9064807198902e62669aadc7a8a53d723c07f` forces fresh `/auth/me` in the global route boundary, binds decisions to authorization-relevant route/query state, and adds fail-closed retry on transient failures. `2e95e92fcd3808a0e09464dd8476844ea1d0c475` uses real browser history/navigation in the Student route regression. `74da4d1f168d1c09341c689cd082b8310ac5f241` corrects the Library mock response shape and captures page exceptions.
- Tests: Production Quality run https://github.com/acadlyx/acadlyx/actions/runs/39067198685 passed all six Playwright tests, including stale Student permission/revocation restoration and transient `/auth/me` outage/retry. The same exact SHA passed ERP verification https://github.com/acadlyx/acadlyx/actions/runs/39067198692, Production Gate https://github.com/acadlyx/acadlyx/actions/runs/39067198580, Native Mobile CI https://github.com/acadlyx/acadlyx/actions/runs/39067198578, and Frontend build https://github.com/acadlyx/acadlyx/actions/runs/39067198701. Production Quality also passed migration validation, backend tests/build, legacy refund compatibility, 10k-student finance performance, backup/restore, and frontend build. Deployment smoke was skipped intentionally.
- Commit SHA: `74da4d1f168d1c09341c689cd082b8310ac5f241` (exact tested functional SHA).
- Remaining dependencies: full server-side role/cross-tenant authorization and session isolation remain in `P1-AUTH-001`; this item verifies the frontend route-reconciliation race.
- Precise next action: continue `P1-AUTH-001`, adding real API/PostgreSQL coverage for authorization gaps not already exercised by the existing workspace-isolation integration suite.

### P1-AUTH-001 — Full backend authorization and workspace isolation
- Priority/module: P1 / authentication, RBAC, API scope
- Acceptance: real Express + disposable PostgreSQL tests verify canonical roles and multi-role precedence; institution/campus/department/programme/year/batch/semester/section/student/parent boundaries; revoked/deactivated access; record ownership; maker-checker; unauthorized direct REST calls; and cache/context transition safety.
- Relevant files: `backend/src/services/workspaceContext.service.ts`, `backend/src/services/accessScope.service.ts`, `backend/src/utils/workspaceScopeFilters.ts`, `backend/src/middleware/authenticate.ts`, `backend/src/services/userLifecycle.service.ts`, `backend/src/services/parentPortal.service.ts`, `backend/src/services/feeStructure.service.ts`, and PostgreSQL-backed authorization tests.
- Status: `VERIFIED`
- Acceptance coverage: `workspace-context-isolation.integration.test.ts` exercises all canonical tenant roles, Super Admin tenant isolation, multi-role precedence, the full workspace selector hierarchy, tenant-A/tenant-B boundaries, student self-enrollment context, role-change and CampusAccess/DepartmentAccess revocation, stale/deleted selections, and real REST scope denials/positive reads across courses, programmes, academic years, semesters, sections, course offerings, assignments, attendance sessions, internal marks, timetable, batches and student records. It also checks wrong-user session IDs, revoked/expired sessions, inactive/deactivated accounts, parent-child link presence/revocation, and fee-structure maker-checker through registered Express endpoints.
- Implemented checkpoints: `ccb1f79d4d8278859a2b72167a64053bfc88bd8a` added real API session binding/revocation/expiry checks; `37643897d0b360690ca2492852fa59f682386935` added deactivation/reactivation session invalidation; `96552a28b899d59f0678da7e9b6546c25adeada1` corrected the Parent Portal mount path and confirmed linked/unlinked/cross-tenant access; `8296efe58d0b6a217a3d1b938c8154c7002eeea1` added and passed live fee maker-checker API tests (draft-only creation, non-Chairman publish denied, creator self-approval denied, Student approver denied, separate Management approval succeeds).
- Exact-SHA verification on `8296efe58d0b6a217a3d1b938c8154c7002eeea1`: ERP verification run [39068891188](https://github.com/acadlyx/acadlyx/actions/runs/39068891188) SUCCESS, `253 passed / 0 failed`; Frontend build run [39068891196](https://github.com/acadlyx/acadlyx/actions/runs/39068891196) SUCCESS; Production Gate run [39068891333](https://github.com/acadlyx/acadlyx/actions/runs/39068891333) SUCCESS; Production Quality run [39068891235](https://github.com/acadlyx/acadlyx/actions/runs/39068891235) SUCCESS with desktop/mobile browser smoke, backend, migration, legacy, performance and backup/restore jobs green; Native Mobile CI run [39068891186](https://github.com/acadlyx/acadlyx/actions/runs/39068891186) SUCCESS. The Production Quality deployment-smoke step was skipped by design because no deployment is authorized.
- Result: the acceptance criteria for this authorization workstream are met with live API/PostgreSQL evidence; no production branch or deployment was touched.
- Next action: proceed to `P1-WEB-001` without reopening verified authorization work unless a new regression is reported.

### P1-WEB-001 — Web institutional/leadership workflows
- Priority/module: P1 / web ERP
- Acceptance: verify actual role routes, leadership data sources, campus/department scope, lifecycle operations, redirects, sidebar uniqueness, real quick actions and correct empty/error/loading states.
- Relevant files: `backend/src/routes/erp.routes.ts`, `backend/src/services/managementWorkspace.service.ts`, `backend/src/services/erp.service.ts`, `frontend/src/components/dashboard/DirectorDashboard.tsx`, `frontend/src/components/dashboard/ChairmanDashboard.tsx`, and `backend/src/__tests__/workspace-context-isolation.integration.test.ts`.
- Status: `IN_PROGRESS`
- Reproduced defect: Director/Chairman landing pages call `GET /api/v1/erp/me/summary`; the controller/service supplies a lightweight role/scope-validated KPI response and explicitly avoids waiting on the full workspace's notices query, but the route incorrectly gates the summary behind `requireFeature("notices")`. Tenants with Notices disabled therefore receive 403 on core dashboard KPIs unrelated to Notices. The live PostgreSQL fixture seeds academic/student/parent/fee features but intentionally does not seed Notices, so this is exercised through the real Express route instead of a source-only assertion.
- Current fix: remove only the unrelated Notices entitlement gate from `/me/summary`; retain authentication and `notifications.read` permission middleware, the service's effective-role allowlist, Director campus scope checks, Dean department scope checks, and institution-filtered queries. The full `/me/workspace` endpoint is unchanged because it returns actual notices data and should remain feature-gated.
- Regression cases added: Chairman summary is available with Notices disabled and has institution-wide KPI scope; Director summary is available with Notices disabled and is constrained to the assigned campus; Student is still denied the leadership-summary API with 403.
- Verification status: implementation and DB-backed regression are pending fresh exact-commit CI. Do not mark verified until ERP's disposable-PostgreSQL suite, Production Gate, Frontend build, Production Quality/browser smoke and Native Mobile CI pass on the same SHA.
- Next action: run all five workflows on the resulting checkpoint; fix any failing scope assertion or runtime result without weakening the role/scope boundary, then move to the next P1 queue item.

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

### P1-IMPORT-002 — Background import reports verified completion
- Priority/module: P1 / web data import
- Acceptance: enqueue receipt is distinct from job outcome; UI waits for COMPLETED/PARTIAL results, presents terminal errors and row-level failures, does not poll forever, allows status rechecks when bounded waiting expires, and never claims a queue ticket is a successful import.
- Relevant files: frontend/src/lib/dataTransferApi.ts, frontend/src/components/dashboard/DataTransferActions.tsx, frontend/scripts/test-import-workflow.mjs, frontend/package.json, backend import/job contracts.
- Status: IMPLEMENTED_UNVERIFIED
- Root cause: backend returns HTTP 202 with {jobId,status,type,mode}, but UI treated it as an ImportCommitResult and displayed imported row count before background processing completed; its existing poller was unused.
- Changes made: commit da38ea9fdd4844bef2fc844436c205e316f1f6db adds a runtime-validated enqueue receipt, bounded poller for COMPLETED/PARTIAL, retry/status CTA, row-error rendering, rollback messaging and a source-contract guard wired into validate:source. Commit b822b53de454badcef801da1b92c9f854f16a07e fixes the nested JSX expression found by the first CI typecheck.
- Tests: on b822b53de454badcef801da1b92c9f854f16a07e, test-import-workflow.mjs passed within frontend source validation; frontend TypeScript typecheck and production build passed; ERP tests 239/239; all five workflows listed in the execution snapshot passed. An earlier run on da38ea9... correctly failed typecheck (TS1005: } expected); this is recorded as a failed intermediate checkpoint, not hidden.
- Commit SHA: implementation da38ea9fdd4844bef2fc844436c205e316f1f6db; syntax fix b822b53de454badcef801da1b92c9f854f16a07e.
- Remaining verification: no browser/API test has yet exercised a real import job from upload through database mutations and terminal UI result, including PARTIAL, FAILED, atomic rollback, long-running timeout and a network interruption.
- Precise next action: add a disposable-tenant backend/browser integration test for upload → queued job → status/result, then rerun the full import path before marking verified.

### P1-XPORT-001 — Universal exports and imports
- Priority/module: P1 / web and mobile data handling
- Acceptance: applicable pages support authorized filtered/selected/page datasets; large exports are server-side; import preview/normalization/row errors/manual correction/commit semantics are behaviorally tested; student admission-number uniqueness remains enforced; mobile import/export workflows work where required.
- Relevant files: existing export/import services, routes, web pages and mobile flows.
- Status: IN_PROGRESS
- Changes made: background-import result reporting improved under P1-IMPORT-002; this narrow UI/API fix does not complete the broader workstream.
- Tests: web source guard, TypeScript build, ERP, Quality, Gate and Native Mobile CI passed at b822b53de454badcef801da1b92c9f854f16a07e; no full browser workflow for all import/export modes and no native file operations test.
- Commit SHA: see P1-IMPORT-002.
- Remaining defects: server-side selection/filter fidelity across actual pages, comprehensive import row-error and rollback behavior, mobile import/export, and end-to-end authorization/download scope tests.
- Precise next action: add real end-to-end tests for the student partial-import/manual-completion flow and one atomic generic import, then inventory applicable exports across pages.

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
- Status: `VERIFIED` (CI workflow set only; not product/release readiness)
- Evidence: all five required workflows passed on the same exact functional SHA `74da4d1f168d1c09341c689cd082b8310ac5f241`: ERP verification `39067198692`, Frontend build `39067198701`, Native Mobile CI `39067198578`, Production Gate `39067198580`, Production Quality `39067198685`.
- Gate scope: Quality passed all six public/login/authenticated Playwright tests, Prisma migrations, legacy refund migration compatibility, isolated PostgreSQL backup/restore, 10k-student finance performance, backend tests/typecheck/build, and frontend build. Production deployment smoke was `skipped` intentionally because deployment is not authorized; it is not claimed as passed. Mobile CI passed Expo Doctor, structural tests and Android/iOS JavaScript bundle exports, not signed artifacts or physical-device tests.
- Next action: rerun checks after every future code/tracker commit; do not merge/deploy and do not infer whole-product readiness from green CI.

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
| 2026-10-17 | b822b53de454badcef801da1b92c9f854f16a07e | ERP verification run 2241 | SUCCESS | https://github.com/acadlyx/acadlyx/actions/runs/39061361222 — disposable PostgreSQL, RUN_POSTGRES_INTEGRATION=1, 239 tests passed / 0 failed. |
| 2026-10-17 | b822b53de454badcef801da1b92c9f854f16a07e | Frontend build run 1396 | SUCCESS | https://github.com/acadlyx/acadlyx/actions/runs/39061361113 — source validation (442 frontend files), source guards including queued-import checks, TypeScript typecheck and production build passed. |
| 2026-10-17 | b822b53de454badcef801da1b92c9f854f16a07e | Native Mobile CI run 239 | SUCCESS | https://github.com/acadlyx/acadlyx/actions/runs/39061361162 — mobile typecheck, 24 structural tests, Expo Doctor 21/21, Android/iOS JavaScript bundle exports. Not signed APK/AAB/IPA or device validation. |
| 2026-10-17 | b822b53de454badcef801da1b92c9f854f16a07e | Production Gate run 1857 | SUCCESS | https://github.com/acadlyx/acadlyx/actions/runs/39061361158 — backend and frontend jobs succeeded. |
| 2026-10-17 | b822b53de454badcef801da1b92c9f854f16a07e | Production Quality run 2912 | SUCCESS | https://github.com/acadlyx/acadlyx/actions/runs/39061361209 — migration/legacy DB, backup/restore, 10k finance performance, backend tests, frontend build and public/login browser smoke passed; production deployment smoke was skipped by design. |
| 2026-10-17 | `74da4d1f168d1c09341c689cd082b8310ac5f241` | ERP verification | SUCCESS | https://github.com/acadlyx/acadlyx/actions/runs/39067198692 — backend/frontend checks passed on this exact SHA. |
| 2026-10-17 | `74da4d1f168d1c09341c689cd082b8310ac5f241` | Frontend build | SUCCESS | https://github.com/acadlyx/acadlyx/actions/runs/39067198701 — typecheck, source validation and production build passed. |
| 2026-10-17 | `74da4d1f168d1c09341c689cd082b8310ac5f241` | Native Mobile CI | SUCCESS | https://github.com/acadlyx/acadlyx/actions/runs/39067198578 — Expo/typecheck/structural tests and Android/iOS JS bundle exports passed; not signed device verification. |
| 2026-10-17 | `74da4d1f168d1c09341c689cd082b8310ac5f241` | Production Gate | SUCCESS | https://github.com/acadlyx/acadlyx/actions/runs/39067198580 — backend and frontend jobs passed. |
| 2026-10-17 | `74da4d1f168d1c09341c689cd082b8310ac5f241` | Production Quality | SUCCESS | https://github.com/acadlyx/acadlyx/actions/runs/39067198685 — six Playwright tests passed; database migration, legacy compatibility, backend tests, 10k-student workload, backup/restore and frontend build passed. Production deployment smoke was skipped intentionally. |
| 2026-10-17 | `8296efe58d0b6a217a3d1b938c8154c7002eeea1` | ERP verification | SUCCESS | https://github.com/acadlyx/acadlyx/actions/runs/39068891188 — real PostgreSQL-backed API suite: 253 passed / 0 failed, including session revocation, parent relationship checks and fee-structure maker-checker. |
| 2026-10-17 | `8296efe58d0b6a217a3d1b938c8154c7002eeea1` | Frontend build | SUCCESS | https://github.com/acadlyx/acadlyx/actions/runs/39068891196 — typecheck/source validation and production build passed. |
| 2026-10-17 | `8296efe58d0b6a217a3d1b938c8154c7002eeea1` | Production Gate | SUCCESS | https://github.com/acadlyx/acadlyx/actions/runs/39068891333 — backend and frontend gates passed. |
| 2026-10-17 | `8296efe58d0b6a217a3d1b938c8154c7002eeea1` | Native Mobile CI | SUCCESS | https://github.com/acadlyx/acadlyx/actions/runs/39068891186 — Expo/typecheck/structural tests and Android/iOS JS bundle exports passed; not signed device verification. |
| 2026-10-17 | `8296efe58d0b6a217a3d1b938c8154c7002eeea1` | Production Quality | SUCCESS | https://github.com/acadlyx/acadlyx/actions/runs/39068891235 — browser smoke, migration/legacy compatibility, backend tests, 10k finance workload, backup/restore and frontend production build passed. Production deployment smoke was skipped intentionally. |

## Release decision

**NOT PRODUCTION READY.** The placement outbox/test-fixture regressions are fixed and the real PostgreSQL ERP suite passed 239/239 on the earlier tested candidate. Fresh RBAC reconciliation is now verified by all six Playwright browser tests, and all five workflows passed on `74da4d1`. Remaining material blockers include the unresolved high-severity `node-forge@1.4.0` dependency advisory, full backend role/cross-tenant authorization acceptance, end-to-end import/export coverage, native feature parity and signed device builds/tests, and staging release acceptance. Production remains unchanged; no merge or deployment is authorized.

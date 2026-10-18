# ACADLYX Production Readiness Execution Tracker

> This is the authoritative resumable queue for the `native-mobile-parity-2026-10-17` release candidate. Production, `main`, and the production baseline must remain unchanged. PR #77 stays draft and must not be merged or deployed without explicit authorization.

## Execution snapshot

- Repository: https://github.com/acadlyx/acadlyx
- Authorized branch: `native-mobile-parity-2026-10-17`
- Protected production baseline: `production-upgrade-2026-09-20`
- Batch 01 source checkpoint: `d648d0c9b33f1316c68063a4dede76e17e747aa6`; browser-test assertion follow-up: `f24d0f3be73978b1775c4ded61aeed938f401de2`. The source changes cover session-scoped workspace caching, late-response/auth-token race protection, Institution Admin finance grants, role-bound Dean/HOD scopes, fee lifecycle/fee-head route ownership, Librarian-vs-borrower API boundaries, and tenant-entitlement API enforcement. On `d648d0c`, ERP verification, Frontend build, Production Gate, Native Mobile CI, and the non-browser Production Quality jobs passed; Production Quality's browser smoke was `FAILED (35 passed / 3 failed)`. The three remaining failures were stale E2E heading expectations: the shared shell renders `Children` for the Parent child-list destination and the actual student-profile heading is `Test Student` (shell label follows the current identity), not the old fixed titles. Those assertions were corrected in `f24d0f3`; the exact-head five-workflow rerun must pass before Batch 01 can be marked fully verified. Never use the older green checkpoint `8296efe58d0b6a217a3d1b938c8154c7002eeea1` as evidence that these newer source/test changes passed. Production deployment smoke is intentionally skipped; no merge or deployment was performed.
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
- Status: `IN_PROGRESS — IMPLEMENTED, CURRENT-HEAD VERIFICATION PENDING`
- Existing acceptance coverage: `workspace-context-isolation.integration.test.ts` has real PostgreSQL/Express coverage for canonical tenant roles, Super Admin tenant isolation, multi-role precedence, role-bound Dean/HOD rows, workspace selector boundaries, role/access revocation, stale/deleted selections, REST scope denials, student self-enrollment, parent-child links, fee-structure maker-checker, disabled Assignments read/write denial, and direct fee API access across the canonical role matrix. These tests are gated by `RUN_POSTGRES_INTEGRATION=1`; the newest exact-head backend test job passed on `d648d0c`. Current-head reruns after the browser assertion correction must finish before the entire batch is called verified.
- New independently confirmed defects and corrections:
  - The frontend workspace cache used only selector parameters as its key and allowed late responses to commit after a session/context transition. Commits `addcddc6e2ae6e65b5d0f3f5eea1df4aa9973ef2`, `433c58c579e36292b48df03ac3ae9a6c1cd23320`, `d07bfa44e564f5a6c5903337409f4be3d747d189`, `33ac9a9778503fb4c02d29b235bdb6bd7702d401`, `209dbdc5a1e4d9e8b55e9312aaa761ce4bf391af`, `0dcf537dbc797aaac405b2fa88067d05037527bf`, `d60f6fe08795bc0d1eb3e621b180d049bf6e89e4`, `43c8c7e7c17a617601661235418c47b052fb3ce7`, `d72222815b28b03e3860a9f3a2aa0dca4ff3e684`, `ffc36a63b14450f3ead3a2cef2b4b9e086026ea2`, and `012bd029ff95f8ad7438c1158c4fb8af229aa247` implement session-scoped keys, subscriber notification on credential changes, invalidation when fresh `/auth/me` authority changes, stale-response generation checks, and pure regression tests.
  - `INSTITUTION_ADMIN` was explicitly granted `fees.structure.read` and `fees.structure.manage` in the canonical RBAC map, contrary to the required specialist finance boundary and existing `isInstitutionWideForRole` policy. Commit `659f3dd04404204df2b75a5d151a3e1047adcf81` removes those grants; `26432228c0a4ed4b2f0d9bbf49cdfc0aaae98d3b` adds role and multi-role regressions.
  - Commit `d4dabbb2b54b9ea2fc58137e60d005f0ff94b283` and follow-up `b7119e61561304a01e7e88ab087e785d45981f4c` add real API checks that disabling the Assignments entitlement rejects reads and mutations while leaving unrelated Attendance access available.
  - Commit `4f98700f4ec9eb958d4528a2fdf0950df449889f` adds a browser regression ensuring an otherwise permitted Faculty route is blocked by a disabled tenant feature before protected API effects run.

- Implemented checkpoints: `ccb1f79d4d8278859a2b72167a64053bfc88bd8a` added real API session binding/revocation/expiry checks; `37643897d0b360690ca2492852fa59f682386935` added deactivation/reactivation session invalidation; `96552a28b899d59f0678da7e9b6546c25adeada1` corrected the Parent Portal mount path and confirmed linked/unlinked/cross-tenant access; `8296efe58d0b6a217a3d1b938c8154c7002eeea1` added and passed live fee maker-checker API tests (draft-only creation, non-Chairman publish denied, creator self-approval denied, Student approver denied, separate Management approval succeeds).
- Exact-SHA verification on `8296efe58d0b6a217a3d1b938c8154c7002eeea1`: ERP verification run [39068891188](https://github.com/acadlyx/acadlyx/actions/runs/39068891188) SUCCESS, `253 passed / 0 failed`; Frontend build run [39068891196](https://github.com/acadlyx/acadlyx/actions/runs/39068891196) SUCCESS; Production Gate run [39068891333](https://github.com/acadlyx/acadlyx/actions/runs/39068891333) SUCCESS; Production Quality run [39068891235](https://github.com/acadlyx/acadlyx/actions/runs/39068891235) SUCCESS with desktop/mobile browser smoke, backend, migration, legacy, performance and backup/restore jobs green; Native Mobile CI run [39068891186](https://github.com/acadlyx/acadlyx/actions/runs/39068891186) SUCCESS. The Production Quality deployment-smoke step was skipped by design because no deployment is authorized.
- Result: prior PostgreSQL/API evidence remains valid for its recorded exact SHA only. Independent source review found the RBAC grant and workspace-cache defects above, so full Batch 01 acceptance is not yet established.
- Verification state: no local shell/test runner is available in this session. The new frontend and backend tests are committed to the implementation branch, but they must pass on the current exact head. Never use the prior green checkpoint to claim these new tests passed.
- Precise next action: inspect the exact-head Frontend build, ERP verification, Production Gate, Production Quality and Native Mobile CI outcomes; fix any genuine regression. Then extend role/API mutation coverage where the current test matrix still only exercises representative actions. Production remains untouched and PR #77 stays draft.

### P1-WEB-001 — Web institutional/leadership workflows
- Priority/module: P1 / web ERP
- Acceptance: verify actual role routes, leadership data sources, campus/department scope, lifecycle operations, redirects, sidebar uniqueness, real quick actions and correct empty/error/loading states.
- Relevant files: `backend/src/routes/erp.routes.ts`, `backend/src/services/managementWorkspace.service.ts`, `backend/src/services/erp.service.ts`, `frontend/src/components/dashboard/DirectorDashboard.tsx`, `frontend/src/components/dashboard/ChairmanDashboard.tsx`, `frontend/src/app/director/fee-approvals/page.tsx`, and PostgreSQL/browser regressions.
- Status: `IN_PROGRESS`
- Implemented fix: the lightweight `GET /api/v1/erp/me/summary` endpoint no longer incorrectly depends on the optional Notices feature; it retains authentication, `notifications.read`, role validation, and server-enforced Chairman institution scope / Director campus scope / Dean department scope. The full `/me/workspace` response remains Notices-gated. Real PostgreSQL/API cases cover Chairman institution-wide counts, Director campus-only counts, and continued Student denial.
- Concurrent finance UI work preserved: Director approval uses `FeeStructureApprovalQueue role="DIRECTOR" scope="campus"`; Management approvals use the same shared queue with `role="MANAGEMENT" scope="institution"`. The queue checks the effective role and requires both `fees.structure.read` and `fees.structure.approve`; backend mutations enforce CampusAccess-derived program/semester scope and maker-checker. The earlier ERP run at `0f0f09293a9f00bfdcce48ce8de6ab49016af10f` exposed one stale source-contract test that still required a page-level `allowedRoles` prop on the old standalone page. This checkpoint updates the test to assert the new shared queue's actual role and permission guard, not to change authorization behavior.
- Verification status: the latest source validator and typecheck passed on `0f0f092`, and a later Frontend build also passed, but that SHA's ERP verification and Production Gate failed on the stale source-contract assertion; newer E2E/doc commits have superseded it. The updated contract test is pending exact-head CI. The current branch's five workflows must all pass on the same SHA before this item can be marked `VERIFIED`.
- Next action: finish exact-head ERP/Production Gate/Production Quality/Frontend/Mobile checks, fix genuine UI/API failures without weakening auth, then proceed to the next tracker item.

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
| 2026-10-18 | `d648d0c9b33f1316c68063a4dede76e17e747aa6` | Batch 01 source / backend / build / mobile gates | PARTIAL SUCCESS | Backend typecheck/build/lint/tests passed; frontend typecheck/lint/build passed; Production Gate and ERP verification passed; migration, legacy-refund, 10k-student, and backup/restore jobs passed; Android/iOS JavaScript bundle exports passed. Production Quality's browser job failed only 3 stale UI-heading assertions (35/38). Deployment smoke was skipped intentionally. |
| 2026-10-18 | `f24d0f3be73978b1775c4ded61aeed938f401de2` | Batch 01 browser assertion correction | PENDING | Updated Parent page assertions to verify the rendered `Children` heading plus no-linked-child state; updated student-profile deep-link assertion to check the actual `Test Student` heading and admission number. Current-head CI must be observed passing before Batch 01 is marked complete. |
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


## Batch 01 — Independent role, permission and workspace-isolation verification (2026-10-18)

**Status: PARTIAL — do not interpret as complete authorization acceptance.** Verified against source and the exact current branch HEAD `ece48b9cb71b6c95555cbb7102c7e22077bc0f83`; no production branch writes or deployments were made.

### Changes present on the implementation branch
- Fee-structure service now checks the effective workspace role in addition to granular permissions: management is limited to Chairman/Management/Accounts, read listing to Chairman/Management/Accounts/Director, submission to the finance roles, approval/rejection to Chairman/Management/Director, and fee assignment to Accounts. Institution Admin is removed from fee-structure role grants and the RBAC regression asserts no `fees.structure.read` or `fees.structure.manage` grant.
- Library circulation now uses the effective Librarian workspace for management operations, with explicit route-level role gates; fine lists are limited to a Student's own borrower rows or institution-scoped Librarian rows, and waiver actions have explicit role gates.
- Added/adjusted regression coverage for multi-role Student+Librarian denial, non-Librarian Director workspace denial, role/permission checks and the library circulation detail gate. Adjusted concurrency fixture to use an actual Librarian actor for a library return.
- Workspace context integration fixtures include the Exams feature when testing Institution Admin's role boundary, so the denial is not accidentally caused only by feature entitlement. Existing workspace integration tests exercise cross-campus department context rejection and multi-role effective-role selection.

### Independent CI evidence on exact HEAD
- ERP verification run [39111427604](https://github.com/acadlyx/acadlyx/actions/runs/39111427604): **SUCCESS** (backend and frontend jobs).
- Production Quality run [39111427608](https://github.com/acadlyx/acadlyx/actions/runs/39111427608): **SUCCESS** — backend tests/typecheck, frontend typecheck/build, browser public/login smoke, migration validation, legacy refund compatibility, backup/restore rehearsal and 10k-student database workload all succeeded. Production deployment smoke was skipped by workflow design.
- Frontend build run [39111427713](https://github.com/acadlyx/acadlyx/actions/runs/39111427713): **SUCCESS**.
- Production Gate run [39111427606](https://github.com/acadlyx/acadlyx/actions/runs/39111427606): **SUCCESS**.
- Native Mobile CI run [39111427609](https://github.com/acadlyx/acadlyx/actions/runs/39111427609): **SUCCESS** for typecheck, structural tests, Expo checks and Android/iOS JS bundle exports; this is not signed native/device validation.

### Acceptance gaps still open
- The 20-role × direct URL/navigation/API read/API mutation matrix has **not** been demonstrated end-to-end. Passing general CI is not proof that every endpoint/resource query is correctly scoped.
- Need dedicated integration assertions for Director campus boundaries across every campus-scoped resource; Dean/HOD department boundaries across reads and mutations; Faculty teaching assignment boundaries; Student own-record boundaries; Parent linked-child boundaries; Super Admin platform-only behavior against tenant endpoints; foreign institution IDs across all services; revoked permissions/stale sessions; and disabled feature API access.
- Need targeted frontend tests proving workspace change invalidates each relevant query family and that old-scope records cannot flash while requests race. The existing workspace transition implementation resets queries, but a full resource-family matrix has not been independently run in this batch.
- Continue to treat production readiness as **NOT READY** until these gaps have endpoint-level test evidence and are reviewed. No full-isolation claim is made.


### Batch 01 continuation — exact-head verification (2026-10-18)

The earlier Batch 01 entry above refers to a prior candidate and is superseded for CI evidence by this exact-head check. The current PR #77 source branch is `native-mobile-parity-2026-10-17`, HEAD `11c0f4c5a0451f2f5a9509eaa3829dd32bf571b4`. The PR remains open against `production-upgrade-2026-09-20`; this batch made no writes to that protected base and triggered no production deployment.

Exact-head GitHub Actions evidence:
- [Frontend build — run 39112230979](https://github.com/acadlyx/acadlyx/actions/runs/39112230979): **SUCCESS**, including frontend typecheck and production build.
- [Native Mobile CI — run 39112230975](https://github.com/acadlyx/acadlyx/actions/runs/39112230975): **SUCCESS**, including typecheck, structural tests, Android and iOS JavaScript bundle exports. This is not signed-device verification.
- [Production Gate — run 39112230968](https://github.com/acadlyx/acadlyx/actions/runs/39112230968): **SUCCESS**, backend tests plus frontend lint/build.
- [ERP verification — run 39112230973](https://github.com/acadlyx/acadlyx/actions/runs/39112230973): **SUCCESS**, backend tests plus frontend build and Chairman/Director route smoke.
- [Production Quality — run 39112230972](https://github.com/acadlyx/acadlyx/actions/runs/39112230972): **SUCCESS** for backend tests/typecheck, frontend lint/typecheck/build, public/login browser smoke, migration validation, legacy refund compatibility, isolated PostgreSQL backup/restore rehearsal, and the 10k-student finance database workload. The production deployment smoke job was **SKIPPED**, so this is not evidence of a live production deployment.

Batch 01 disposition remains **PARTIAL / NOT AUTHORIZATION-ACCEPTED**. These workflows establish that the committed code passes the configured CI suites, not that every endpoint in the requested 20-role × URL/navigation/API read/API mutation matrix has been exercised. Specifically, the repository evidence inspected in this batch does not establish exhaustive per-resource campus/department/teaching/linked-child/own-record scoping, every foreign-tenant identifier path, revoked-permission and stale-session behavior, or complete workspace-cache race coverage. Do not claim full isolation or production readiness from the green workflows alone. The concrete service-level role gates and regression tests listed in the Batch 01 entry above are verified changes; the remaining matrix must be completed before this batch can honestly be marked fully complete.


### Batch 01 continuation — latest source check (2026-10-18, current checkpoint)

The latest implementation-branch HEAD before this tracker update was `1f1dea8ac5624fb3d4101c9afe766f7f4a0eece3`. This branch is the only write target; `production-upgrade-2026-09-20` remains protected/read-only. GitHub API commits are already pushed to the remote branch; no local git runtime is available in this session to run commands against a checkout.

#### Additional concrete fix
- The exact-head ERP verification run `39112667524` failed one PostgreSQL integration test: `placement-audience.integration.test.ts`, where cancellation outbox processing was asserted immediately after a fire-and-forget outbox insert. The assertion showed the cancellation row had not yet been persisted when the drain ran; the test did not report a handler error.
- Added a bounded poll for the specific cancellation event (`eventId` + `version: cancelled`) before invoking the real outbox consumer, then retained assertions for processedAt, null lastError, and exactly-once notification delivery. Commits: `a2f9d9b3945965548b621fabacd34c6ecc446663` and cleanup `1f1dea8ac5624fb3d4101c9afe766f7f4a0eece3`.
- On the previous exact head, backend typecheck/tests, frontend typecheck/build, mobile CI, Production Gate, backup/restore rehearsal, migration validation, legacy refund compatibility, and 10k-student profile passed. ERP verification was red only for the placement cancellation race above. Production Quality's browser smoke was still in progress at last inspection; production deployment smoke was skipped.

#### Current disposition
**PARTIAL — NOT AUTHORIZATION-ACCEPTED.** The placement test fix has not yet received exact-HEAD CI confirmation. The broad 20-role × direct URL/navigation/API read/API mutation matrix, exhaustive foreign-tenant and foreign-academic-workspace identifier coverage, revoked-permission/stale-session tests, and complete workspace-cache race matrix remain unproven. Do not treat green generic CI or this test fix as proof of full tenant isolation. Continue after the next exact-HEAD CI run and only close this batch when those specific gaps have endpoint-level evidence.


### Batch 01 continuation — direct URL boundary regression added (2026-10-18)

- Added `frontend/e2e/role-boundary-matrix.spec.mjs` in commit `6aff2d4b4fc907e6df281d0644a8bbec44182cca`.
- The Playwright suite attempts direct navigation to the Super Admin workspace as each of the 19 tenant roles and verifies the tenant user is redirected away; it also attempts to open the Director workspace as Super Admin and expects a redirect to the platform workspace.
- This is a regression test for direct URL role boundaries, not proof of the entire requested matrix. It does not by itself establish role-owned navigation correctness or real API read/mutation authorization. Those must be backed by backend integration tests and browser assertions.
- Current branch HEAD at time of writing: `6aff2d4b4fc907e6df281d0644a8bbec44182cca`. Exact-HEAD CI results for this new test are not yet available. Do not mark the full six-item request complete until CI executes the test and all required endpoint-level role/scope/cache cases are verified.
- Protected production branch remains unchanged; no merge or deployment.


### Batch 01 continuation — tenant/cache regressions (2026-10-18)

- Added frontend cache regression cases in `frontend/scripts/test-workspace-context-cache.mjs` (commit `7e13d3ba81d9be023307aad28c5021809502c796`):
  - same selectors under different session/tenant scopes produce distinct cache keys;
  - authority signatures change when institution, role, permission, or tenant feature availability changes;
  - a delayed result from a previous academic workspace cannot replace the current workspace;
  - a pending result cannot publish after logout/session-scope rotation.
- Source inspection confirms `backend/src/middleware/authenticate.ts` reloads the user, live refresh session, role bindings, institution status and effective tenant scope for protected requests, rejects revoked/expired sessions and rejects SUPER_ADMIN accounts mixed with institution-scoped role bindings. This is implementation evidence, not a substitute for endpoint-level adversarial integration tests proving platform actions cannot access tenant data without institutional authorization.
- Existing `backend/src/__tests__/workspace-context-isolation.integration.test.ts` already contains tests for A1/A2 academic workspace isolation, foreign tenant IDs, Faculty campus filters, HOD department scope, revoked CampusAccess/DepartmentAccess, mismatched/revoked/expired sessions, and deactivation. The complete request still requires explicit assertions for disabled tenant features and Super Admin platform-vs-institution authorization, plus an auditable full endpoint read/mutation matrix.
- Exact-head CI was queued for commit `7e13d3ba81d9be023307aad28c5021809502c796` at the time of inspection. The cache script and all CI suites have not been locally executed in this session; results must be checked against the final commit after all edits.
- Disposition remains **PARTIAL / NOT AUTHORIZATION-ACCEPTED** until the required endpoint-level adversarial tests and final exact-HEAD CI are green. Protected production branch remains unchanged; no merge or deployment.

## Batch 02 — Dashboard ownership, route navigation and feature leakage

- Status: `IMPLEMENTED_UNVERIFIED`. The latest Batch 02 application-source checkpoint is `e405c6dd8459aa13443b5980090ddc3d79a59602`. Do not mark this batch `VERIFIED` until the exact-source Production Quality browser smoke completes and its result is inspected.
- Scope kept on `native-mobile-parity-2026-10-17`. No changes were made to `production-upgrade-2026-09-20`; PR #77 remains open and must not be merged or deployed without authorization.
- Centralized the canonical role-owned destination table in `frontend/src/lib/navigation.ts` so the sidebar and authorization guard resolve the same role-specific destination. Direct-route matching now treats exact links and query-backed links as exact-only, preventing a dashboard landing item from implicitly authorizing arbitrary descendants.
- Kept Super Admin Website CMS (`/site-content`, `site.manage`) separate from tenant Institutional CMS (`/admin/institutional-cms`, `institutional-cms.read/manage/approve`). Tenant API routes enforce the `cms` feature entitlement and the new permission checks; the service enforces institution matching and rejects Super Admin access to tenant drafts. The legacy `/institutionalcms` route redirects into the governed draft/submission/approval workflow.
- Added regression checks for all 20 canonical dashboard identities/owners, role-specific navigation and route override targets, disabled CMS tenant entitlements, platform-vs-tenant CMS access, notices read visibility and Student read-only behavior, duplicate navigation destinations, and the Dean/Club President destinations.
- Added backend service authorization tests for cross-institution reads/writes/submission, Student or unrelated-role access, role-name-only CMS read access, approver-role/permission separation, and the prohibition on granting tenant roles the platform `site.manage` permission.
- Corrected the Dean dashboard's mislabelled/global student destination to its scoped Dean student records page and replaced the Club President's unsupported generic calendar link with the authorized shared Events & Gallery workspace.
- Exact-source evidence for checkpoint `e405c6dd8459aa13443b5980090ddc3d79a59602`: [Frontend build run 39148495419](https://github.com/acadlyx/acadlyx/actions/runs/39148495419) succeeded; logs report source validation scanning 450 frontend files, route/notice regression suites passed, TypeScript checking completed and Next.js production build compiled successfully. [ERP verification run 39148495454](https://github.com/acadlyx/acadlyx/actions/runs/39148495454) succeeded, with backend tests `263 passed / 0 failed` and frontend build/typecheck successful. [Production Gate run 39148495465](https://github.com/acadlyx/acadlyx/actions/runs/39148495465) succeeded. [Native Mobile CI run 39148495424](https://github.com/acadlyx/acadlyx/actions/runs/39148495424) succeeded; its job log reports `24 passed / 0 failed` mobile tests and `21/21` Expo Doctor checks. [Production Quality run 39148495441](https://github.com/acadlyx/acadlyx/actions/runs/39148495441) was still queued when this evidence was recorded, including the desktop/mobile browser smoke job; browser behaviour is therefore **not yet verified** and this batch must stay `IMPLEMENTED_UNVERIFIED`.
- Required before status can become `VERIFIED`: complete the new exact-head Frontend build, ERP verification (including backend tests), Production Gate, Production Quality browser smoke and Native Mobile CI runs. Confirm all of them point to the same final source SHA; inspect any failures and rerun after fixes. Do not use green runs from an older SHA as final acceptance evidence.


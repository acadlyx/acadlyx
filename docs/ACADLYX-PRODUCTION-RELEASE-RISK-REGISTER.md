# ACADLYX Production Release Risk Register — Milestones 8–9

Audit updated: 2026-10-10  
Application-source snapshot reviewed: ab4dfdec3aec12e086b0b9738d28a1056e670128  
Working branch: stabilization-platform-2026-10-09  
Baseline: production-upgrade-2026-09-20 / 6ddcc30697071b6e55505caaf68337f704bdc7cd  
Overall release recommendation: **NO-GO pending release-critical verification**. Standard exact-SHA hosted CI passed on `c10ec08489756ba770467fff7b81e7f992b2d0f0`; critical adversarial, financial, existing-data migration and recovery gates remain open.

Severity reflects potential impact and release gating, not a claim that each risk has been reproduced.

## Risk register

| ID | Module | Severity | Finding / root cause | Supporting evidence | Impact | Required remediation / verification | Status |
|---|---|---|---|---|---|---|---|
| R-01 | Candidate CI | Critical release gate | Original branch filters excluded stabilization; corrected in Milestone 9 | Four hosted GitHub Actions runs completed successfully on exact SHA `c10ec08489756ba770467fff7b81e7f992b2d0f0`; workflows now include stabilization push/PR triggers and read-only contents permission | Standard package/build/test/migration evidence now exists for the tested SHA | Preserve exact-SHA checks and ensure required checks are enforced before any release PR; rerun after source changes | VERIFIED |
| R-02 | Authentication/RBAC/isolation | Critical release gate | Adversarial cross-tenant and role-scope tests not run; route-by-route middleware coverage not proven | authenticate.ts reloads DB role/permission/tenant context; no adversarial request evidence | Potential sensitive disclosure if any route misses scope checks; no bypass reproduced | Run tenant/campus/department/student/parent/file/entitlement negative tests across sensitive APIs | UNVERIFIED |
| R-03 | Finance/payments/refunds | Critical release gate | No candidate DB-backed reconciliation or provider sandbox run | Finance schema/services and contract tests exist; no payment/refund execution | Duplicate/missing payment, receipt or incorrect balance | Test provider-confirmed payments, retries, refunds/reversals, invoice balances, receipts and canonical invariants | BLOCKED |
| R-04 | Migration/recovery | Critical release gate | Clean-database migration passes, but representative existing-data rehearsal and backup restore remain absent | Hosted run `38031718249` applied all migrations successfully to empty disposable PostgreSQL 16; no sanitized prior-state fixture or restore test | Upgrade failure, lock contention, data loss or unsafe rollback remain possible in an existing database | Rehearse from representative sanitized existing schema/data; test backup restore and rollback/forward-fix | PARTIALLY VERIFIED |
| R-05 | Examination/admit cards/results | High | No eligibility-to-generation-to-file-to-publication E2E run; new refund regression test not executed | Examination/job/PDF code exists; source test added | Incorrect blocks, duplicate/missing cards, invalid files or premature result publication | Test eligibility matrix, counts, retries, PDF/ZIP readability, marks approval and student/parent visibility | BLOCKED |
| R-06 | Library to finance | High | Exactly-once canonical charge and inventory/loan consistency under retry/concurrency not tested | Copy/loan models, policy snapshots, linked invoice path and unit tests exist | Duplicate fines or inventory/balance mismatch | Test concurrent issue/return/loss/damage and repeated requests; verify one linked invoice and reconciled balance | BLOCKED |
| R-07 | Admission/enrollment | High | Student creation and admission status transition are separate writes; partial completion/retry risk | admission.service.ts flow described in Milestone 7 report | Duplicate student or application stuck selected after failure | Design idempotent transaction/recovery with unique business key; inject failure between writes | PARTIALLY VERIFIED |
| R-08 | Placement | High | Application transition and audit write may be separate; concurrent transitions untested | placement.service.ts source flow and placement RBAC tests | Lost/contradictory history or offer outcome | Conditional transition/transaction and durable history tests; concurrency/duplicate tests | PARTIALLY VERIFIED |
| R-09 | Deployment source alignment | High | render.yaml pins web and worker to production branch, not stabilization branch | Branch-specific render.yaml read | Operators could release a different revision than audited if source is misunderstood; current config may be intentional | Release owner confirms intended source, artifact identity and promotion process | UNVERIFIED |
| R-10 | Build/type safety | High | Standard exact-SHA checks pass; frontend unit/runtime tests are not configured and integration behavior remains unverified | Hosted CI on `c10ec08489756ba770467fff7b81e7f992b2d0f0`: Node 24 frontend source validation/typecheck/lint/build passed; Node 20 backend Prisma validate/generate/typecheck/build/lint/tests passed | Compile-time/build regressions were checked; runtime and integration regressions can remain | Preserve CI results; add meaningful frontend tests only where testable behavior and suitable harness exist; run E2E integration tests | PARTIALLY VERIFIED |
| R-11 | Session revocation | High | Refresh-session unit/contract checks passed, but login/refresh/logout behavior is not end-to-end verified | Backend suite on `c10ec08489756ba770467fff7b81e7f992b2d0f0`: 114 tests passed, including active/missing/wrong-user/revoked/expired session checks; no live HTTP session flow run | Logout/revocation or concurrent refresh may diverge in integrated runtime | Add/run HTTP-level login, refresh rotation/reuse, logout, disabled-user and permission-change tests | PARTIALLY VERIFIED |
| R-12 | Jobs/outbox | High | Retry, duplicate delivery, stale recovery and notification failure not run | Durable job/event services and migrations/tests exist | Lost/duplicated notifications or invisible partial completion | Inject worker crashes/timeouts; retry same key; verify terminal state, replay and recovery | BLOCKED |
| R-13 | Performance/capacity | Medium | No representative p50/p95, query plans, queue throughput or load results | Milestone 6 records unmeasured baseline | Latency, capacity and pool exhaustion unknown | Instrument and load-test nonproduction against agreed workload/SLO | UNVERIFIED |
| R-14 | Accessibility/responsive | Medium | Focus trap/return-focus and browser checks remain unverified | Milestone 5 report/source changes | Keyboard/mobile usability failures | Test mobile widths, keyboard, focus trap/restore, screen reader and role-specific states | PARTIALLY VERIFIED |
| R-15 | Observability | Medium | Hosted logs, alerts, correlation IDs, provider failures and readiness not validated | Deployment config has health path; no live traces | Incident detection/recovery may be inadequate | Alert on API errors, failed payments, stuck jobs, storage errors and DB saturation; test readiness/shutdown | UNVERIFIED |
| R-16 | Backup/DR | High | No restore rehearsal or measured RPO/RTO evidence | No database/backup access available | Critical incident may be unrecoverable within institutional needs | Identify owner/retention/PITR; timed isolated restore and integrity checks | BLOCKED |
| R-17 | Environment/integrations | High | Variable names configured but hosted values/provider integrations unknown | render.yaml and manifests; no secret values accessed | Startup/auth/database/storage/payment failure | Validate required values in secret manager without logging values; smoke-test TLS/CORS/storage/sandbox | UNVERIFIED |
| R-18 | Approval governance | High | Cross-domain self-approval, revoked permission, rejection and audit atomicity not comprehensively tested | Workflow authority/state services and governance matrix exist | Unauthorized or unaudited high-impact actions if checks are missing | Resolve policy with institution owner and test initiator/reviewer separation and transitions | PARTIALLY VERIFIED |

## Ownership / workstreams

- Release engineering/repository owner: R-01, R-09, R-10.
- Security/backend: R-02, R-11, R-17.
- Finance and library: R-03, R-06.
- Academic/examination: R-05, R-07.
- Placement: R-08.
- Database/operations: R-04, R-12, R-13, R-15, R-16.
- Institution governance and UX: R-14, R-18.

Named individuals were not assigned because repository evidence did not establish ownership.

## Release gate policy

Do not release while any Critical gate (R-01 through R-04) is BLOCKED or UNVERIFIED. High-risk items must be fixed and retested, or only when demonstrably noncritical to scoped release, accepted in writing by the responsible owner and release approver. R-02, R-03 and R-04 cannot be waived by treating missing evidence as success. No such approvals are recorded.

Status meanings:
- FIXED: source change made; separate verification still required.
- VERIFIED: concrete passing evidence exists for stated scope.
- PARTIALLY VERIFIED: some source/test evidence exists, coverage incomplete.
- UNVERIFIED: evidence absent or insufficient.
- BLOCKED: required execution/environment gate could not be completed.


## Milestone 9 evidence update — 2026-10-10

Tested SHA: `c10ec08489756ba770467fff7b81e7f992b2d0f0`, branch `stabilization-platform-2026-10-09`. Evidence source: hosted GitHub Actions. Four workflows completed successfully:

- [ACADLYX Production Quality](https://github.com/acadlyx/acadlyx/actions/runs/38031718249) — backend install, Prisma validate/generate, typecheck, build, lint, tests; frontend install, typecheck, lint, production build; empty PostgreSQL 16 migration job. Production live smoke job skipped on stabilization branch.
- [ACADLYX Production Gate](https://github.com/acadlyx/acadlyx/actions/runs/38031718250) — backend/frontend jobs passed.
- [ACADLYX ERP verification](https://github.com/acadlyx/acadlyx/actions/runs/38031718247) — backend/frontend jobs passed.
- [Frontend build](https://github.com/acadlyx/acadlyx/actions/runs/38031718309) — source validation, typecheck and build passed.

Backend test log: 114 tests, 114 passed, 0 failed, 0 skipped. The production-quality migration job applied all migrations to an empty disposable PostgreSQL 16 database. This is not an existing-data migration rehearsal. Frontend package has no unit/integration test script, so frontend runtime tests remain UNVERIFIED.

The four workflows now trigger on the stabilization branch for pushes and pull requests and declare `permissions: contents: read`. The live smoke job in production-quality is gated to the production branch only. GitHub branch metadata reports `protected: false` for both stabilization and production baseline, with no required-check enforcement observed; repository-admin action is still needed to make checks mandatory. No deployment or production database operation occurred.

### Remaining release blockers

R-02 cross-scope adversarial access, R-03 provider-backed finance reconciliation, R-04 existing-data migration and restore (partially verified only), R-05 actual admit-card artifacts/counts, R-06 library exactly-once financial integration, R-09 deployment-source approval, R-12 job/outbox recovery, R-16 disaster recovery and R-17 hosted integration configuration remain open. **Overall status stays NO-GO.**


## Milestone 10 update — adversarial authorization (2026-10-10)

Starting candidate SHA: `ff14eae53eca1e16b62b1ecff69429f8e0c20e6c`. Prior tested SHA: `c10ec08489756ba770467fff7b81e7f992b2d0f0`. Initial diff check confirmed the six commits between them changed only the three Milestone 9 readiness documents. Milestone 10 added `backend/src/__tests__/authorization-adversarial.test.ts` with 12 pure authorization contract tests. Current hosted CI for the commit containing this test must be observed before marking these tests VERIFIED.

| ID | Module | Severity | Finding / root cause | Supporting evidence | Impact | Required remediation / verification | Status |
|---|---|---|---|---|---|---|---|
| R-19 | Tenant/cross-user authorization | Critical | Existing pure authorization helpers have basic permission, institution, self-user and owner checks; route/service enforcement has not been tested against HTTP + DB adversarial fixtures | New `authorization-adversarial.test.ts` adds 12 pure tests; test execution pending exact-SHA CI; no DB/API fixture was run | Cross-tenant or cross-user leaks remain unexcluded at runtime | Run isolated integration suite covering path/query/body/nested ID substitution and assert response plus persisted state/side effects | BLOCKED |
| R-20 | Campus/department/faculty scope | Critical | Database-backed scope helpers exist but MCA HOD, Director CampusAccess, Dean and Faculty assignment boundaries were not adversarially exercised | Source review of `accessScope.service.ts`; no disposable DB fixture run | Unauthorized records or actions could cross organizational boundaries if any route bypasses the helpers | Build synthetic two-institution, multi-campus, multi-department fixtures; exercise read and mutation routes; verify no persisted side effects | BLOCKED |
| R-21 | Parent-child isolation | Critical | Parent portal checks ParentStudentLink per service call in source; no integration tests prove all endpoints and nested references retain that constraint | `parentPortal.service.ts` and `parentPortal.routes.ts` inspected; pure helper tests only | Unlinked child data exposure remains unexcluded in running API | Test linked and unlinked parent against overview, attendance, results, fees, coursework, calendar, notices and alert routes | PARTIALLY VERIFIED |
| R-22 | File/download authorization | High | File reads allow owner fallback as an alternative to module permission after tenant-scoped lookup; expected behavior after permission revocation is not documented | `fileStorage.controller.ts` inspected; no revocation integration test | A user may retain access to an owned file after module read permission changes; whether this is intended is a policy question | Decide ownership-vs-current-permission policy; add tests for module, owner, tenant and revocation combinations before changing behavior | BLOCKED |
| R-23 | Export/report isolation | Critical | Known export types map to permissions, but unknown type proceeds to service validation and every query's resource scoping is not proven | `export.routes.ts` inspected; no HTTP/export integration tests | Export may expose records if a service query omits scope | Test unknown export types, all supported export types, role/scope filters and output rows against synthetic tenants | UNVERIFIED |
| R-24 | Module entitlement + permission conjunction | Critical | Sampled routes apply both `requireFeature` and permission middleware; full endpoint-wide conjunction is not established | Inspected `requireFeature.ts`, `entitlement.service.ts`, and selected route modules | Enabled UI or role permission may not prove backend feature entitlement is enforced on every alternate route | Build negative integration matrix: permission-only, entitlement-only, both, neither; cover alternate/secondary routes | PARTIALLY VERIFIED |
| R-25 | Workflow/bulk side effects | Critical | Approval and bulk endpoints were not tested for mixed-scope IDs, self-approval, partial writes or audit side effects | `workflowAuthority.service.ts` source inspection; no isolated transaction tests | Partial unauthorized writes or privilege escalation remain unexcluded | Exercise bulk operations and approvals with mixed in-scope/out-of-scope IDs; assert rollback and no unauthorized audit/outbox side effects | BLOCKED |
| R-26 | Candidate security CI | Critical release gate | New adversarial pure-unit tests passed; database-backed adversarial HTTP coverage remains absent | Hosted [Production Quality run](https://github.com/acadlyx/acadlyx/actions/runs/38032585164) on exact source SHA `d6e78f156ae20b837dff16d3cbc0e2ff13fc022a`: backend suite 126 passed, 0 failed, 0 skipped; all four standard workflows passed | Pure authorization decision regressions are verified, but live route + database isolation is not | Add/run the isolated API + disposable PostgreSQL matrix and verify persisted state/side effects for all critical boundaries | PARTIALLY VERIFIED |

No finding above asserts a reproduced exploit. These are release gates based on absent runtime evidence or a policy question. Overall release decision remains **NO-GO**.


### Milestone 10 CI evidence update

Exact tested source SHA: `d6e78f156ae20b837dff16d3cbc0e2ff13fc022a` on `stabilization-platform-2026-10-09`.

- [ACADLYX Production Quality](https://github.com/acadlyx/acadlyx/actions/runs/38032585164) — SUCCESS; backend suite 126 passed, 0 failed, 0 skipped; frontend checks/build and empty disposable PostgreSQL 16 migration validation passed; live production smoke skipped.
- [ACADLYX Production Gate](https://github.com/acadlyx/acadlyx/actions/runs/38032585202) — SUCCESS.
- [ACADLYX ERP verification](https://github.com/acadlyx/acadlyx/actions/runs/38032585201) — SUCCESS.
- [Frontend build](https://github.com/acadlyx/acadlyx/actions/runs/38032585149) — SUCCESS.

No local execution or database-backed adversarial API testing occurred. R-19 through R-25 remain open as described; the pure tests do not establish denial behavior, persisted-state invariants or absence of side effects. Overall decision remains NO-GO.


## Remediation status update — 2026-10-10

| Risk | Status | Required next action |
|---|---|---|
| Director Finance scope derived from DepartmentAccess rather than CampusAccess | FIXED IN SOURCE; integration verification pending | Confirm exact final SHA CI; run PostgreSQL/API tests across multiple campuses and institutions |
| Broad Finance permission may bypass resource scope for scoped roles | FIXED IN SOURCE for Director and HOD/Dean branch ordering; broader role matrix unverified | Exercise mixed-role actors and all permission combinations in API/database tests |
| Concurrent payment / idempotency behavior across Finance endpoints | PARTIALLY VERIFIED in canonical fee-billing source; separate Finance workspace path UNVERIFIED | Add concurrent PostgreSQL tests for both API paths, including duplicate key collision and interrupted retries |
| Concurrent refund request/processing | HIGH RISK / UNVERIFIED in separate Finance workspace path | Atomically reserve refund capacity and claim processing state; test competing requests and duplicate processing in PostgreSQL |
| Library charge exactly-once integration | UNVERIFIED | Concurrent return/lost/damaged/waiver tests and ledger reconciliation |
| Existing-data migration compatibility | BLOCKED | Upgrade synthetic prior-schema data and compare relationships/constraints |
| Backup/restore and RPO/RTO | BLOCKED | Restore synthetic backup to separate disposable database, measure duration/data-loss window; obtain approved targets |
| Connected institutional workflows | BLOCKED | Execute API/DB/browser scenarios and verify persisted artifacts |
| Branch protection | HIGH RISK / ADMIN ACTION REQUIRED | Repository administrator must enable required checks and protect production/stabilization branches |
| Live deployment configuration | UNVERIFIED | Release operator must independently verify provider settings, source SHA, health, secrets and rollback behavior |

Supporting evidence matrices: `docs/ACADLYX-FINANCIAL-LIBRARY-INTEGRITY-AUDIT.md`, `docs/ACADLYX-MIGRATION-BACKUP-DISASTER-RECOVERY-AUDIT.md`, `docs/ACADLYX-END-TO-END-WORKFLOW-VERIFICATION.md`.

No production setting, branch protection, deployment, or database was changed by this remediation. Release remains **NO-GO**.
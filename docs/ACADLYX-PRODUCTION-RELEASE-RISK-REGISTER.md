# ACADLYX Production Release Risk Register — Milestone 8

Audit date: 2026-10-09  
Application-source snapshot reviewed: ab4dfdec3aec12e086b0b9738d28a1056e670128  
Working branch: stabilization-platform-2026-10-09  
Baseline: production-upgrade-2026-09-20 / 6ddcc30697071b6e55505caaf68337f704bdc7cd  
Overall release recommendation: **NO-GO pending release-critical verification**.

Severity reflects potential impact and release gating, not a claim that each risk has been reproduced.

## Risk register

| ID | Module | Severity | Finding / root cause | Supporting evidence | Impact | Required remediation / verification | Status |
|---|---|---|---|---|---|---|---|
| R-01 | Candidate CI | Critical release gate | No workflow run exists for stabilization branch; inspected workflow triggers target production branch | GitHub Actions query returned zero stabilization runs; workflow YAML branch filters | No reproducible build/test/migration proof for candidate | Run existing gates against exact candidate SHA in isolated CI; publish results and require success | BLOCKED |
| R-02 | Authentication/RBAC/isolation | Critical release gate | Adversarial cross-tenant and role-scope tests not run; route-by-route middleware coverage not proven | authenticate.ts reloads DB role/permission/tenant context; no adversarial request evidence | Potential sensitive disclosure if any route misses scope checks; no bypass reproduced | Run tenant/campus/department/student/parent/file/entitlement negative tests across sensitive APIs | UNVERIFIED |
| R-03 | Finance/payments/refunds | Critical release gate | No candidate DB-backed reconciliation or provider sandbox run | Finance schema/services and contract tests exist; no payment/refund execution | Duplicate/missing payment, receipt or incorrect balance | Test provider-confirmed payments, retries, refunds/reversals, invoice balances, receipts and canonical invariants | BLOCKED |
| R-04 | Migration/recovery | Critical release gate | No migration run against representative existing data, backup restore or schema-drift validation | Prisma schema/migration history exist; no candidate CI run | Upgrade failure, lock contention, data loss or unsafe rollback | Run clean PostgreSQL migration job and sanitized existing-data rehearsal; test backup restore and rollback/forward-fix | BLOCKED |
| R-05 | Examination/admit cards/results | High | No eligibility-to-generation-to-file-to-publication E2E run; new refund regression test not executed | Examination/job/PDF code exists; source test added | Incorrect blocks, duplicate/missing cards, invalid files or premature result publication | Test eligibility matrix, counts, retries, PDF/ZIP readability, marks approval and student/parent visibility | BLOCKED |
| R-06 | Library to finance | High | Exactly-once canonical charge and inventory/loan consistency under retry/concurrency not tested | Copy/loan models, policy snapshots, linked invoice path and unit tests exist | Duplicate fines or inventory/balance mismatch | Test concurrent issue/return/loss/damage and repeated requests; verify one linked invoice and reconciled balance | BLOCKED |
| R-07 | Admission/enrollment | High | Student creation and admission status transition are separate writes; partial completion/retry risk | admission.service.ts flow described in Milestone 7 report | Duplicate student or application stuck selected after failure | Design idempotent transaction/recovery with unique business key; inject failure between writes | PARTIALLY VERIFIED |
| R-08 | Placement | High | Application transition and audit write may be separate; concurrent transitions untested | placement.service.ts source flow and placement RBAC tests | Lost/contradictory history or offer outcome | Conditional transition/transaction and durable history tests; concurrency/duplicate tests | PARTIALLY VERIFIED |
| R-09 | Deployment source alignment | High | render.yaml pins web and worker to production branch, not stabilization branch | Branch-specific render.yaml read | Operators could release a different revision than audited if source is misunderstood; current config may be intentional | Release owner confirms intended source, artifact identity and promotion process | UNVERIFIED |
| R-10 | Build/type safety | High | No exact-SHA build/typecheck/lint/test output | Package scripts and lockfiles inspected; no candidate checks | Compile/runtime regressions remain undiscovered | Run package scripts with frontend Node 24/backend Node 20 and retain logs/exit codes | BLOCKED |
| R-11 | Session revocation | High | Source binds requests to active refresh session, but token rotation/revocation not E2E-tested | authenticate.ts, refreshSession.ts and tests exist | Logout/revocation or concurrent refresh may diverge | Test login, refresh rotation/reuse, logout, expiry, disabled user and permission changes | PARTIALLY VERIFIED |
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

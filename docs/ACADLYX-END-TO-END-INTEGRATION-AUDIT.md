# ACADLYX End-to-End Institutional Workflow, Cross-Module Integration & Business Integrity Audit — Milestone 7

Date: 2026-10-09  
Repository: `acadlyx/acadlyx`  
Working branch: `stabilization-platform-2026-10-09`  
Baseline branch: `production-upgrade-2026-09-20`  
Source revision reviewed after Milestone 7 fixes and before this report update: `c07fbf80b6a984fe6a303a407e77fa8d7d8dd0d8`  
Scope: branch-specific source inspection of schema, migrations, routes, services and existing tests; targeted source fix and regression guard. No deployment, merge, production database access, infrastructure mutation or secret access was performed.

## Executive status

**Overall: PARTIALLY VERIFIED at source level; end-to-end runtime verification remains BLOCKED.**

A cross-module inconsistency was confirmed and corrected: examination fee eligibility calculated overdue dues without subtracting `FeeInvoice.refundedAmount`, while finance reporting and student invoice views subtract refunds when computing outstanding balance. This could incorrectly block an otherwise eligible student after a refund. The examination query now subtracts refunds and floors each invoice's outstanding contribution at zero. A source-contract regression test was added.

This is not a claim that all institutional workflows are end-to-end verified. The available GitHub connector can read and commit branch source but does not provide an ACADLYX checkout, command execution, a nonproduction database, authenticated runtime, browser automation or provider sandbox. No TypeScript build, lint, test command, migration check, integration test or E2E test was executed in this milestone. Existing test files were inspected as source only.

## Branch and safety verification

- The branch API reported `stabilization-platform-2026-10-09` at `377d9b49ac3daf010bfcf04b3811259e8dc35f94` at the beginning of this audit.
- The baseline comparison reported 43 commits ahead, 0 behind, with merge base `6ddcc30697071b6e55505caaf68337f704bdc7cd`.
- Milestone 7 source commits on the working branch: `5be8e1085e70c22d08da48b04465696d18f86126` (exam balance correction), `56cae36c6e66181f22048f3bcf24aa2007e0dc27` (initial regression test), `65ed8317636d4cc951d288567ad072b772343783` (first test assertion correction), and `c07fbf80b6a984fe6a303a407e77fa8d7d8dd0d8` (align regression assertion with the null-safe refund expression).
- No production branch write, merge, deployment, database mutation or infrastructure change was performed.
- A remote GitHub branch ref is not a local working tree; local uncommitted changes cannot be inspected from this environment. Therefore local working-tree cleanliness is **UNVERIFIED**, not reported as clean.

## Repository evidence inspected

- Prisma schema: `backend/prisma/schema.prisma`.
- Domain routes: `backend/src/routes/`, including admission, enrollment, registration, attendance, examination, finance/fee billing, library, placement, parent portal, workflow, student, course offering, and user routes.
- Domain services: `backend/src/services/`, including admission, enrollment request, registration, attendance session/policy, examination, admit-card generation/PDF/template, fee billing/structure, finance, library, placement, workflow authority/state, audit, background jobs, domain events, parent portal and access-scope services.
- Existing tests inspected: `enrollment-registration-workflow.test.ts`, `student-enrollment-state.test.ts`, `finance-contract.test.ts`, `library.service.test.ts`, `admitCardPdf.service.test.ts`, `placement-rbac.test.ts`, `domain-event.test.ts`, plus the new `examination-finance-integrity.test.ts`.
- Migration inventory includes student master, fee structures, registration capacity, examination lifecycle, admit-card templates/jobs, fee payment idempotency, money precision, finance/library integrity, durable background jobs, durable domain events, attendance reporting, fee constraints, placement ecosystem/snapshots, and library circulation migrations. Migration presence does not prove they have been applied successfully to any database.

## Workflow inventory and integration matrix

Statuses describe evidence available in this audit, not feature marketing or route existence alone.

| Workflow | Starting event / canonical record | Downstream integration | Authority, scope and approval evidence | Idempotency / consistency evidence | Status |
|---|---|---|---|---|---|
| Admission → student creation | Admission application; `admission.service.ts` | Student account/profile and student enrollment | Admission workflow authority is checked; selected applicants only | Student creation and admission-application status update are separate service operations in the inspected implementation. A failure between them can leave a created student while the application remains SELECTED; retry/race behavior needs a transactional or recoverable design | PARTIALLY VERIFIED |
| Enrollment request → active enrollment | `StudentEnrollmentRequest` / `StudentEnrollment`; `enrollmentRequest.service.ts` | Academic context for registration, attendance, examinations and dashboards | Student self-submit; `enrollment.approve`; HOD department-scope check; approval transaction checks current state and active enrollment | Upsert keyed by student/year and approval transaction are present. Concurrency and database-constraint behavior were not executed | PARTIALLY VERIFIED |
| Course registration | `CourseRegistration` for a `CourseOffering`; `registration.service.ts` | Offering roster, attendance and academic results | Registration permissions and approval authority helpers; validates semester, section and department against active enrollment | Transaction and unique student/offering key usage were observed; complete concurrent retry behavior untested | PARTIALLY VERIFIED |
| Timetable / course allocation | Course offering and timetable-related records | Faculty/student schedule views | Course and offering routes/services exist; exact scope behavior varies by operation and requires runtime tests | No complete timetable-to-attendance E2E evidence was executed | UNVERIFIED |
| Attendance | `AttendanceSession` / `AttendanceRecord`; `attendanceSession.service.ts` | Attendance reports and exam eligibility | Offering roster, faculty ownership checks, department scope; finalized sessions are locked with a correction-request path | Attendance records use upsert keys and a transaction; duplicate student entries in one submission are rejected | PARTIALLY VERIFIED |
| Attendance → exam eligibility | Submitted attendance policy/records; `attendancePolicy.service.ts` + `examination.service.ts` | Eligibility reasons and hall-ticket decision | Exam session attendance requirement can override the attendance policy threshold; absent attendance records produce a warning | Source path exists; calculations were not executed against fixtures. Warning-vs-block policy needs explicit institutional decision when threshold exists but no attendance data exists | PARTIALLY VERIFIED |
| Exam registration → eligibility | Exam session, exam registration and eligibility records | Hall ticket/admit card | Configured target scope, active student profile, registration requirement, exam fee status, attendance, fee-clearance rules and active holds are inspected in eligibility code | Eligibility query is institution/student scoped. Duplicate generation and real record counts need worker/database tests | PARTIALLY VERIFIED |
| Exam fee eligibility → finance | `FeeInvoice` outstanding values read by exam eligibility | Student eligibility result | Fee clearance is conditional on explicit session rules | **FIXED in source:** exam outstanding query now subtracts `refundedAmount`, adds late fees and floors each invoice's contribution at zero, matching the finance dashboard's refund-aware outstanding semantics. Regression guard added; not executed | FIXED |
| Admit-card generation | Durable background job keyed by exam session; `admitCardGeneration.service.ts` | Generated files, storage records and audit log | Generation job checks job type; eligibility implementation lives in examination service | Job idempotency key `ADMIT_CARD_ZIP:<examSessionId>` is present. Worker, PDF/ZIP readability, counts, partial failures and retry behavior remain unexecuted | PARTIALLY VERIFIED |
| Marks → approval → publication | Examination schedules/marks and session/schedule states; `examination.service.ts` | Published student results and marksheets | Source defines lifecycle states and access-scope helpers | Publication gates and result visibility require service-level integration tests; no full marks-to-result flow was executed | PARTIALLY VERIFIED |
| Fee structure → invoices | `FeeStructure` / `FeeInvoice`; `feeBilling.service.ts` | Student obligations, Accounts and finance reporting | Fee structure authorization service and finance permissions are present; invoice generation requires ACTIVE structure and matching students | Source describes one invoice per structure/installment and uses a transaction/sequence. Existing invoice generation idempotency was not database-tested | PARTIALLY VERIFIED |
| Payment → receipt / reconciliation | `FeePayment`, `FeeReceipt`, `FeeInvoice`; `feeBilling.service.ts` | Student balance, finance dashboard and provider reconciliation | Payment gateway adapter and fee authorization are present | Payment idempotency migrations and finance contract tests exist. No sandbox/provider payment, retry, refund, receipt or reconciliation test ran | PARTIALLY VERIFIED |
| Refund / concession / waiver | `FeeRefund`, `FeeConcession`, invoice adjustment fields | Invoice balance and management approvals | Approval-related service functions and fields exist; exact self-approval and policy boundaries require runtime tests | Finance dashboard subtracts refunds in displayed outstanding calculation. No financial ledger reconciliation fixture was executed | PARTIALLY VERIFIED |
| Library circulation | `LibraryBook`, `LibraryBookCopy`, `LibraryIssue`; `library.service.ts` | Inventory, overdue fines and return/loss/damage state | Institution-scoped borrower/copy lookups; per-loan snapshot of fine rate/cap/grace/renewal limits; audit log calls | Issue uses a transaction and conditional copy status update; fine/charge helpers have unit tests. Parallel issue/return and rollback cases not executed | PARTIALLY VERIFIED |
| Library charge → finance | Library fine/charge and linked financial invoice relation | Canonical student invoice and balance | Finance integration migrations and `financialInvoice` relation are present; library balance view reads linked invoice values | No second ledger was identified in inspected library service excerpt. Exactly-once creation, return retry and payment reconciliation require database integration tests | PARTIALLY VERIFIED |
| Placement drive → application → outcome | Company/opening/drive, `Application`, `PlacementOffer`; `placement.service.ts` | Selection/offer and placement reporting | Placement manager permission, student apply permission, student data scope, explicit application transition map | Duplicate application P2002 is converted to conflict; application transition updates and audit logging are separate operations, and concurrent transitions were not tested | PARTIALLY VERIFIED |
| Parent portal | Parent-student link and student-owned records; `parentPortal.service.ts` | Linked student academic/financial/placement views | Parent portal service and `assertCanViewStudent` usage are present in related services | Parent-to-multiple-student semantics and every route's link filtering need adversarial integration tests | PARTIALLY VERIFIED |
| Approval/governance framework | Domain-specific requests plus workflow authority/state services | Approve/reject/execute and audit | Enrollment and registration use explicit authority checks; fee authorization service and user lifecycle/deletion workflow exist | No single cross-domain approval engine was assumed. Per-workflow self-approval, rejection, permission-revocation and retry behavior remain incomplete to verify | PARTIALLY VERIFIED |
| Domain events / background jobs | Domain event outbox and durable job records | Notifications and async tasks | Services and migrations exist; worker entry point is configured in package scripts | Existing unit tests cover event/job contracts, but delivery retries, duplicate delivery, and notification failure after business commit were not executed | PARTIALLY VERIFIED |
| Role dashboards / canonical state | Dashboard-specific API routes and workspace services | Student, parent, faculty, HOD, director, finance, placement and management views | RBAC, scope and workspace tests exist; services call access-scope helpers | A dashboard/API presence is not proof of canonical state propagation; no role-by-role live API/browser E2E test was run | UNVERIFIED |

## Canonical data ownership map

| Entity / record | Canonical owner observed in source | Consumers / integrations | Key integrity requirement |
|---|---|---|---|
| User identity and role assignments | User/auth/RBAC services and Prisma `User` relations | All role workspaces, student/parent, faculty and approval actors | One user identity per institution policy; server-side permissions and tenant boundary |
| Student master/profile | Student profile/admin and admission services | Enrollment, directory, attendance, examination, finance, placement, parent portal | Do not treat dashboard payload as identity; historical enrollment must remain separate from current assignment |
| Academic enrollment | `StudentEnrollment` with academic-year/program/semester/section relations | Registration, roster, attendance, exam target/eligibility, placement snapshots | Active enrollment and relationship consistency; current assignment changes must not rewrite history |
| Course delivery | `CourseOffering` and registration records | Faculty roster, timetable, attendance and examination schedules | Offering must match enrollment semester/section/department |
| Attendance | `AttendanceSession`, `AttendanceRecord`, attendance policy | Reports and exam eligibility | Finalized attendance is evidence; corrections should be auditable |
| Examination lifecycle | Exam session, registration, eligibility, schedule, marks, hall-ticket/admit-card records | Student result view, marksheet generation, eligibility and readiness reports | Explicit rules, auditable block reasons, publication gates and duplicate-safe generation |
| Fee obligation | `FeeInvoice` and invoice items/structure links | Finance, student/parent balance, exam fee-clearance and library charges | Invoice amount, paid amount, refunds, late fees, status and audit trail must reconcile |
| Payment / receipt / refund | `FeePayment`, `FeeReceipt`, `FeeRefund` | Invoice balance and finance reports | Provider-confirmed payment only; retry-safe references; no double counting |
| Library inventory / loan | Book catalog, physical copy, `LibraryIssue`, loan snapshot fields | Library dashboard and linked financial invoice | Copy status and loan state update atomically; policy snapshot survives later policy edits |
| Placement opportunity / application / offer | Placement company, opening/drive, application, offer | Student portal and placement reporting | One valid application per actual unique business key; valid transitions and history |
| Approval / audit evidence | Domain-specific request state plus audit service; workflow authority/state helpers | Enrollment, fees, registration, account lifecycle and other workflows | Permission checks at execution time; reviewer/decision/reason and audit write consistency |
| Asynchronous work | Durable background job and domain-event/outbox records | Admit-card generation, notifications and other background processing | Idempotency key, retry state, recoverable failures and observable terminal status |

## Defect fixed in this milestone

### Examination fee eligibility used a different balance formula from finance

**Finding: FIXED in source; runtime verification BLOCKED.**

Before the change, `getOutstandingStudentDues()` summed:

`amount - paidAmount + lateFeeAmount`

It did not subtract `refundedAmount`. Finance reporting computes outstanding as billed amount minus successful collections minus refunded amount, and invoice summaries also subtract refunds. Consequently a refunded invoice could still inflate the examination eligibility balance and incorrectly block a hall ticket when fee clearance is enabled.

The query now sums, for overdue non-cancelled invoices:

`GREATEST(0, amount - paidAmount - refundedAmount + lateFeeAmount)`

with null-safe fields. This prevents a single over-refunded/overpaid invoice from contributing a negative balance that offsets another invoice's dues. The existing policy gates remain in place; no eligibility check was removed and no payment/receipt was fabricated.

Changed files:
- `backend/src/services/examination.service.ts`
- `backend/src/__tests__/examination-finance-integrity.test.ts`

The regression test asserts that the exam balance query includes refund subtraction, late-fee inclusion, nonnegative per-invoice flooring, cancellation exclusion and overdue-date filtering. It is a source-contract test, not a live SQL or end-to-end test, and was **not executed** in this environment.

## Other source-confirmed risks requiring follow-up

1. **Admission enrollment is not atomic across student creation and application transition.** `enrollApplicant()` verifies SELECTED, calls `createStudent()`, then separately updates the admission application to ENROLLED and records an audit event. If student creation succeeds but the status update fails, the system can leave a student account while the application remains SELECTED. Concurrent calls may race. Root-cause fix should make the operation transactional/idempotent within the existing student-creation architecture or introduce an explicit recoverable state; do not blindly retry student creation.
2. **Enrollment request notification/audit happen after the enrollment transaction commits.** A notification/audit failure can make the API request fail after enrollment has committed. Business state remains committed, but callers need a durable/recoverable notification path and retry-safe API semantics. Existing outbox infrastructure should be evaluated before adding another mechanism.
3. **Placement application transition and audit are separate writes.** The source checks an allowed transition then updates the application and records an audit log. Concurrent transitions may both read the same prior state. A conditional state update/transaction and persisted transition history should be considered after confirming schema capabilities.
4. **Exam attendance with no submitted records is a warning, not a hard block.** When an attendance threshold applies but percentage is null, the source adds a warning while eligibility status is based on blocking reasons. This may be intentional, but institution governance must decide whether missing attendance data is pending/manual-review or eligible-with-warning; do not guess a policy.
5. **Readiness percentages can be optimistic for empty populations.** `getExaminationReadiness()` returns 100% for several measures when no sessions exist. This may be a neutral empty-state convention or a misleading performance metric; confirm desired reporting semantics.
6. **Finance totals have several definitions.** The dashboard's headline outstanding uses billed minus collected minus refunded; invoice-level summaries use invoice amount minus paid amount minus refunds; the billing service's `outstandingOf()` helper uses amount plus late fee minus paid amount. Confirm that refund processing updates `paidAmount` exactly as expected and centralize the balance contract to avoid drift.
7. **Library issue and placement application rely partly on database constraints for concurrency safety.** Conditional copy updates and P2002 handling are useful defenses, but unique constraints and concurrent retries were not verified against an applied database schema.
8. **Audit trail completeness is not proven.** Many services write audit records after business changes. Where business mutation commits but audit write fails, the resulting record may be operationally valid but missing audit evidence. Evaluate transactional audit writes or durable outbox patterns for high-risk operations.

These are source-level risks, not reproduced production incidents. No unrelated fixes were applied without confirming transaction boundaries, schema constraints and service contracts.

## Existing test coverage found (source inventory only)

- Student/enrollment state classification: `student-enrollment-state.test.ts`.
- Enrollment/registration permissions and input contracts: `enrollment-registration-workflow.test.ts`.
- Finance schema and contract checks: `finance-contract.test.ts`.
- Library fine, replacement/damage charge calculations: `library.service.test.ts`.
- Admit-card PDF service: `admitCardPdf.service.test.ts`.
- Placement role matrix: `placement-rbac.test.ts`.
- Domain event contracts: `domain-event.test.ts`.
- New exam/finance balance source regression: `examination-finance-integrity.test.ts`.

Most inspected tests are unit, permission-matrix or source-contract tests. They do not establish that student creation, fees, library charges, admit-card generation, provider callbacks or dashboards work together in a running application.

## Commands and verification ledger

| Check | Outcome | Evidence / reason |
|---|---|---|
| Branch ref read | EXECUTED | GitHub API reported working branch head at audit start |
| Compare working branch with baseline | EXECUTED | 43 ahead / 0 behind at audit start; merge base recorded above |
| Branch-specific source reads | EXECUTED | Schema, route/service directories, selected services and tests fetched from the working branch |
| Source diff review for this fix | PARTIALLY VERIFIED | Patch was made against the fetched source and expected query text; no executable compiler or SQL engine available |
| Backend unit tests | NOT RUN / BLOCKED | No checkout or command runner against the repository |
| Frontend tests/build/typecheck/lint | NOT RUN / BLOCKED | Not part of executable capabilities in this environment |
| Prisma validate / migration status | NOT RUN / BLOCKED | No Prisma CLI execution or database connection |
| Student-to-result end-to-end test | NOT RUN / BLOCKED | No authenticated application or isolated test database |
| Fee payment/refund reconciliation | NOT RUN / BLOCKED | No payment sandbox, DB fixtures or runtime |
| Library issue/return/fine-to-invoice flow | NOT RUN / BLOCKED | No isolated DB/runtime to exercise transactions and retries |
| Admit-card generation/PDF/ZIP verification | NOT RUN / BLOCKED | No background worker, storage service or readable generated artifact available |
| Placement drive-to-offer flow | NOT RUN / BLOCKED | No running API/database/browser |
| Tenant, campus, department and parent isolation | NOT RUN / BLOCKED | No adversarial authenticated integration fixtures |
| Failure/retry/concurrency scenarios | NOT RUN / BLOCKED | No nonproduction environment to safely inject failures |

## Required next steps

1. Run backend `npm test`, TypeScript build and lint from a clean checkout of this exact branch; first fix any failures in isolation.
2. Run the new `examination-finance-integrity.test.ts` and add a database-backed fixture proving refund-aware eligibility matches the canonical invoice balance for fully refunded, partially refunded, overpaid, late-fee and cancelled invoices.
3. Design and test a recoverable atomic/idempotent admission enrollment operation before changing its transaction boundaries.
4. Add database-backed end-to-end scenarios for:
   - student creation → enrollment → course registration → attendance;
   - attendance/fee rules → eligibility → duplicate-safe admit-card generation;
   - marks → approval → publication → student/parent result visibility;
   - fee structure → invoice → confirmed payment → receipt → refund → reconciled balance;
   - library issue → overdue/return/loss/damage → one canonical invoice → payment;
   - placement drive → duplicate-safe application → screening/interview transitions → offer/outcome;
   - approval rejection, self-approval denial, revoked permissions, concurrent updates and recovery after notification failure.
5. Use only isolated fixtures and clean up only test-created rows. Never reset a shared or production database.
6. Confirm governance for missing attendance data, fee-clearance policy, self-approval, admission retry behavior and empty-population readiness percentages.
7. Centralize the invoice outstanding-balance contract only after tracing refund mutations and confirming the semantics of `paidAmount` and `refundedAmount`.
8. Repeat branch comparison and inspect final diff after executable tests; do not merge or deploy as part of this milestone.

## Final status

Milestone 7 is **PARTIALLY VERIFIED**, not complete against the full Definition of Done. One cross-module fee-eligibility inconsistency is fixed in source with a regression guard. End-to-end flows, database reconciliation, concurrent retries, approval governance, generated-file validation and role-isolation behavior remain unverified or blocked until the branch can be executed in a controlled nonproduction environment.

No production branch changes, merges, deployments, database operations or infrastructure changes were made.

# ACADLYX End-to-End Workflow Verification

**Review date:** 2026-10-10  
**Status:** UNVERIFIED / BLOCKED — release gate remains NO-GO

## Scope

The current environment did not provide a writable local checkout, a running isolated API connected to a disposable PostgreSQL database, browser automation, or synthetic test credentials. No browser-driven workflow was run and no generated PDF artifact was inspected. Existing unit/contract tests and hosted builds are not counted as end-to-end verification.

## Workflow matrix

| Workflow | API + DB exercised | Persisted-state verification | UI/artifact verification | Status |
|---|---|---|---|---|
| Enrollment → fee assignment → invoice → student visibility | No | No | No | BLOCKED |
| Payment → receipt → outstanding balance → refund | No | No | No | BLOCKED |
| Library issue/return or lost/damaged → charge → finance posting | No | No | No | BLOCKED |
| Attendance/debarment → exam eligibility → admit card → readable PDF | No | No | No | BLOCKED |
| Placement opportunity → application → authorized status transitions | No | No | No | BLOCKED |

## Required isolated test setup

- Pin the candidate SHA and install dependencies from lockfiles.
- Use a new disposable PostgreSQL database with migrations applied by the tested candidate.
- Seed synthetic data for at least two institutions and, within one institution, two campuses, departments, programs, classes and students.
- Create actors for Institution Admin, Director, Dean/HOD, Faculty, Accounts, Examination Cell, Student, Parent with one linked child, and Parent with no link.
- Run the real Express API and background worker against that database.
- Use browser automation only if it is available; record browser/version, exact routes, API response status, screenshots/artifact paths, and console/network errors.
- Never bypass eligibility or permission gates to make a scenario pass.

## Required assertions by workflow

### 1. Enrollment and invoicing
- Enrollment, active status, programme/semester/class relationships and fee assignment persist.
- Invoice links to the correct institution/student/academic year.
- Student sees only their own invoice; another student and another institution are denied.
- Duplicate requests and partial failures do not create duplicate invoices or assignments.

### 2. Payment, receipt and refund
- Payment is committed once; receipt is readable and references the same payment/invoice/student.
- Invoice balance and status reconcile with canonical payment/refund records.
- Duplicate idempotency keys, concurrent payments, repeated provider callbacks and retries do not duplicate financial effects.
- Failed/pending payments do not reduce the balance.
- Refund limits, approvals, state transitions and audit trail remain consistent under concurrent requests.

### 3. Library and finance
- Issue/return, overdue fine, lost/damaged replacement and waiver flows are authorized and auditable.
- Concurrent or repeated requests create exactly one canonical charge/posting.
- Student balance, fine record and financial transaction reconcile.
- Unauthorized override and cross-tenant identifier substitution produce no writes.

### 4. Attendance and examination
- Attendance/debarment inputs affect eligibility only through the existing rule engine.
- Ineligible students cannot receive an eligible admit card.
- Eligible admit-card job persists correct student, exam, institution, counts and status.
- Download the actual generated PDF; parse or render it to confirm it is non-empty and readable, has the expected page count and contains correct synthetic student/exam identifiers.
- Job retries do not duplicate or corrupt artifacts.

### 5. Placement
- Authorized staff create/publish an opportunity; student can see and apply within their eligibility/scope.
- Cross-student and cross-institution application ID substitutions are denied.
- Status transitions follow the workflow state machine and permissions.
- Duplicate submissions/retries do not duplicate applications, notifications or audit events.

## Evidence recording template

For each workflow, preserve:
1. Candidate SHA, migration version and test fixture identifier.
2. Actor role/permissions/tenant/scope and request method/path.
3. Request/response status and redacted payload.
4. Before/after database rows or invariant query output.
5. Retry/concurrency/failure-injection results.
6. Browser trace and generated artifact metadata if UI automation was performed.
7. Test exit code and CI run URL.

## Release decision

**NO-GO.** No connected API/database/browser workflow was executed in this environment. Do not describe any workflow as integrated or verified until its persisted state, failure paths and user-visible output are captured.

## PR #29 evidence update — 2026-10-10

**Evidence snapshot candidate:** `c7dc0b31a2355364b5342636307578aac4109ab9`.

- **CI:** [run 38040500919](https://github.com/acadlyx/acadlyx/actions/runs/38040500919) passed its reported backend/frontend checks and configured Prisma migration job on earlier SHA `275280390500b214dce754e12740e2599c545f32`. Production smoke checks were skipped. Latest run [38040759171](https://github.com/acadlyx/acadlyx/actions/runs/38040759171) was in progress at capture time.
- **Source inspection:** library fine-to-invoice code uses a deterministic `sourceEventKey`; Finance payment writes include invoice locking and idempotency replay checks on this candidate.
- **Not executed:** enrollment-to-fee workflow; payment/receipt/refund persisted reconciliation; issue/overdue/loss/waiver library flow; attendance-to-exam eligibility/admit-card PDF validation; placement application transitions; cross-role and cross-department workflow isolation; browser-level tests.
- **Release gate:** OPEN / NO-GO until each required workflow is exercised through real API/application paths against a disposable database and persisted results are checked.

# ACADLYX System Interaction Audit — 2026-11-22

## Scope and baseline

- Repository: `acadlyx/acadlyx`
- Read-only inspection target: `production-upgrade-2026-09-20`
- Inspected production baseline: `fefe3a53a58bf073c1fd0c7f1619d45982415858`
- Implementation branch: `system-interaction-audit-2026-11-22`
- Draft verification PR: #78 (open, draft, not merged)
- No deployment was performed.

The GitHub repository tree inventory at the inspected baseline contained 299 frontend App Router `page.tsx` files, 388 frontend TSX files, 57 backend route files, 33 controllers, 85 services, 49 backend test files, and 69 Prisma migration SQL files. These are inventory counts, not counts of controls fully tested.

## Issue register

| ID | Module / role | Source | Root cause / risk | Correction made | Test / verification | Status |
|---|---|---|---|---|---|---|
| REG-001 | Student course registration | `backend/src/services/registration.service.ts`; `frontend/src/components/student/StudentSelfServiceModule.tsx` | Student could directly drop both REQUESTED and APPROVED registrations | Student direct cancellation restricted to own REQUESTED item; approved course requires formal withdrawal request; add/drop deadline checked on server | Policy unit tests added; full CI on latest head pending | Fixed in source; CI pending |
| REG-002 | Student / HOD course registration | `backend/src/services/registration.service.ts` | DROPPED / REJECTED historical registration could be reset to REQUESTED or APPROVED | In-place resubmission restricted to NEEDS_CORRECTION; HOD bulk action rejects other historical states; transition matrix added | State-policy unit tests added; full API regression set not yet implemented | Guard fixed; authorized historical reopening workflow remains open |
| REG-003 | Student catalogue | `backend/src/services/registration.service.ts` | Course text search replaced the department filter | Course name/code OR is composed inside the department-constrained relation filter | Source re-audit of query shape; automated search integration coverage remains open | Fixed in source |
| REG-004 | Catalogue / registration / HOD | `backend/src/services/registration.service.ts`; `backend/src/utils/registrationPolicy.ts` | Capacity read and write paths counted different statuses | Shared REQUESTED + APPROVED seat-reservation definition used across catalogue counts, credits, submission, approval and bulk assignment | Unit tests for reservation helper; concurrency database test remains open | Fixed in source; CI pending |
| REG-005 | Course/section administration | `backend/src/services/courseOffering.service.ts`; `backend/src/services/section.service.ts` | Offering editor counted an obsolete ACTIVE status; section capacity could be reduced below reservations | Transactional row locks and checks against pending + approved reservations; offering creation serialized with section capacity edits | Prisma/CI validation pending; dedicated concurrent DB test remains open | Fixed in source; CI pending |
| REG-006 | Student academic enrollment | `backend/src/services/enrollmentRequest.service.ts` | Upsert could overwrite an existing request and clear decision metadata | Pending/rejected/approved requests cannot be silently overwritten; NEEDS_CORRECTION uses conditional update and preserves prior reviewer metadata | Source review; API tests for all 20 scenarios remain open | Fixed in source; partial verification |
| REG-007 | Student / approver enrollment | `backend/src/services/registration.service.ts`; `backend/src/services/enrollmentRequest.service.ts` | Stale or prior-year enrollment context could authorize current registration | Current-year ACTIVE enrollment re-read inside locked registration, approval and HOD bulk transactions | Source re-audit; cross-session race tests remain open | Fixed in source; CI pending |
| REG-008 | Concurrent registration decisions | `backend/src/services/registration.service.ts`; `backend/src/services/enrollmentRequest.service.ts` | Concurrent decisions could overwrite a committed decision | Conditional updateMany state claims and row locks added for critical paths | Concurrency stress tests remain open | Fixed in source; not fully concurrency-verified |
| REG-009 | Institution academic calendar | `backend/prisma/schema.prisma`; `backend/prisma/migrations/20261122010000_academic_registration_policy/migration.sql`; `backend/src/services/academicYear.service.ts`; `frontend/src/components/dashboard/AdminAcademicDataPage.tsx` | Registration and add/drop/withdrawal date policies were not configurable | Academic-year date fields and admin UI added; server time enforces registration, add/drop and withdrawal windows | Migration validation in CI; date helper unit tests added; full UI/API tests remain open | Implemented; latest CI pending |
| REG-010 | Student / HOD withdrawal | `backend/src/services/registration.service.ts`; `backend/src/routes/registration.routes.ts`; `frontend/src/lib/registrationApi.ts`; student/HOD UI files | Approved course could be dropped without review or there was no auditable withdrawal workflow | Separate attempt-numbered withdrawal request; pending request keeps registration APPROVED; scoped reviewer can approve/reject; approval transitions to WITHDRAWN; audit and notifications added | Policy unit tests added; end-to-end role/API tests remain open | Implemented; latest CI pending |
| AUTH-001 | Multi-role workspace scope | `backend/src/services/accessScope.service.ts`; `frontend/src/lib/authority.ts` | Role priority could select Registrar over Accounts or let secondary specialist role widen Institution Admin scope | Frontend/backend priority lists aligned; Institution Admin specialist secondary binding guard added | Existing workspace scope tests in ERP suite | Source corrected; ERP workflow passed on prior head |
| PAY-001 | Payment webhook contract test | `backend/src/__tests__/payment-webhook-settlement.contract.test.ts` | Test inspected the ManualGateway no-op parser rather than HmacGateway implementation | Contract test now inspects the provider parser that handles captured-payment validation | ERP workflow passed on prior head | Test corrected |
| CI-001 | Backup/restore CI | `.github/workflows/production-quality.yml`; `backend/scripts/recovery/backup-restore.ts` | Runner package mismatch: versioned client unavailable, then newer client produced SQL incompatible with PostgreSQL 16 | Backup/restore uses the matching postgres:16 service-container tools; dump is copied to runner and restore artifact copied into service container | Latest recovery job is running on current head | Fixed in source; CI verification pending |

## Phase 2 — Changes made

- Registration state and seat reservation policies centralized.
- Registration, approval, bulk assignment, offering capacity and section capacity use row locks / conditional state changes.
- Course offering search scope and prior-registration visibility corrected.
- Enrollment request upsert replaced by explicit state-aware submit/correction paths.
- Institution-configured registration/add-drop/withdrawal calendar fields and admin controls added.
- Formal course-withdrawal request entity, API, student action and HOD review panel added.
- Workspace authority precedence and webhook contract test corrected.
- Recovery CI changed to match the PostgreSQL 16 service client.

## Phase 3 — Verification status and remaining work

### Inspected / re-audited

- Exact protected branch name and requested baseline SHA.
- Implementation branch baseline and divergence of the alternate mobile parity branch.
- All 20 role landing-route files were located; role shells were sampled for event handlers and API wiring.
- Targeted source audit of registration, enrollment, capacity, course offering, academic-year policy, notification, role-scope and backup/restore paths.
- Prisma schema and migration shape for the new academic policy and withdrawal records.

### Not yet completed

- Full source and click-handler audit of all 388 TSX files and every module route.
- Browser exercise of every action for all 20 role workspaces.
- Full negative API test matrix for registration, withdrawal and enrollment resubmission.
- Two-student final-seat contention test and two-approver race test against PostgreSQL.
- Full cross-module reconciliation of attendance, LMS, timetable, examinations, marks, credits and reporting after WITHDRAWN.
- An explicit staff-authorized reopening/reinstatement workflow for DROPPED, REJECTED and WITHDRAWN historical attempts. These states are currently blocked from student/HOD silent reactivation; no new attempt/reinstatement UI has yet been delivered.
- Full positive/negative CRUD, upload/download, export, notification and responsive browser audit across all modules.
- Production-like migration/restore rehearsal on the latest commit.

### Verification caution

A successful typecheck, build, migration validation or partial CI workflow does not establish complete platform readiness. Do not merge PR #78 or deploy this branch without explicit authorization and resolution of the remaining high-risk items.

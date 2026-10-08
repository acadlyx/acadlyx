# ACADLYX — Examination Management Audit & Reconstruction

Date: 2026-10-09
Branch: `production-upgrade-2026-09-20`

## Status legend

- **FIXED** — source change applied for the identified defect.
- **VERIFIED** — directly verified from repository/runtime evidence.
- **PARTIALLY VERIFIED** — implementation exists and some behavior/data is verified, but the complete runtime path is not yet proven.
- **UNVERIFIED** — not proven against a live end-to-end execution.
- **BLOCKED** — verification requires unavailable runtime/browser/credential access.

## 1. Initial architecture and defect inventory

The repository already contains a canonical Examination lifecycle under:

- `backend/src/services/examination.service.ts`
- `backend/src/routes/examination.routes.ts`
- `frontend/src/app/examination/page.tsx`
- `frontend/src/app/student/examinations/page.tsx`
- `frontend/src/lib/examinationsApi.ts`

The newer lifecycle uses `exam_sessions`, `exam_schedules`, `exam_eligibilities`, `exam_registrations`, `hall_tickets`, examination rooms, seating, invigilation, marks, result publications, incidents and revaluation. The legacy Prisma `Exam`/`ExamResult` models remain as compatibility projections for transcript/result consumers; legacy ERP write endpoints are explicitly retired with HTTP 410 and do not form a second write lifecycle.

### Defects found

1. **Fee clearance was hardcoded into hall-ticket generation.**
   The hall-ticket service previously blocked any student with overdue fee invoices, even when the examination did not require fee clearance.

2. **Eligibility and hall-ticket rules could disagree.**
   Eligibility persisted an `ELIGIBLE` record while hall-ticket generation independently re-evaluated registration/fee/attendance conditions. This produced misleading states such as an eligibility row saying ELIGIBLE while a hall ticket remained BLOCKED.

3. **The UI reduced all blockers to a generic message.**
   The Examination Cell displayed:
   `Generated 0 admit cards; 1 blocked by eligibility rules.`
   without exposing the backend's actual blocking reasons.

4. **Eligibility policy input was an unrestricted JSON record.**
   The field was not constrained to an explicit supported policy vocabulary.

5. **Admit-card generation did not expose a structured per-candidate result.**
   It returned only aggregate issued/blocked counts.

## 2. Canonical architecture

The canonical lifecycle is:

**Exam Session → Exam Schedule → Registration/Eligibility → Seating → Hall Ticket → Exam Attendance → Marks → Verification/Lock → Result Publication → Student/authorized dashboards**

Legacy `Exam` and `ExamResult` records remain compatibility projections. Legacy ERP examination writes are retired; the canonical Examination routes own mutations.

No new parallel examination model was introduced by this pass.

## 3. Configurable eligibility policy

### FIXED

Examination session eligibility rules are now validated against supported configuration:

- `requireFeeClearance`
- `maxOutstandingDues`

The service resolves fee-clearance behavior from the examination's persisted policy rather than unconditionally treating every overdue fee invoice as an examination blocker.

Attendance remains server-side and uses the examination session's explicit attendance requirement when configured; otherwise the existing attendance policy is used when that policy explicitly blocks hall-ticket issuance.

Registration remains governed by the session's `registrationRequired` flag and registration state.

Unknown rule keys are rejected by the validator rather than interpreted as executable expressions.

### PARTIALLY VERIFIED

A full policy-builder screen for every requested rule category (documents, special accommodations, historical versioning, formal exception approval, etc.) is not yet proven in this pass. The persisted session rule structure is now constrained for the supported fee-clearance controls, but a complete policy-version subsystem has not been added.

## 4. Zero-admit-card investigation

### VERIFIED — production database evidence

The live database contained two scheduled test sessions:

- `TEST-EXAM01`: 1 eligibility row marked ELIGIBLE, 1 registered candidate, exam fee ₹1200, 1 blocked hall ticket.
- `S2`: registration not required, 1 eligibility row marked ELIGIBLE, 1 blocked hall ticket.

The actual blocked reasons were:

- `TEST-EXAM01`: **Examination fee is pending; Outstanding fees of 500.00**
- `S2`: **Examination eligibility has not been finalized; Outstanding fees of 500.00**

The S2 case demonstrated the root defect: the candidate was eligible, registration was not required, and the session did not configure fee clearance, yet the old hall-ticket path still blocked the candidate solely because an overdue fee invoice existed.

### FIXED

The canonical eligibility evaluator now owns the decision used by hall-ticket generation.

For each candidate it evaluates and persists:

- academic target scope
- active student status
- examination registration
- examination registration fee
- attendance requirement
- configured fee-clearance policy
- configured outstanding-dues threshold
- active examination holds
- evaluation timestamp
- context/policy snapshot

Hall-ticket generation now re-evaluates the same decision and returns structured blocked-candidate reasons.

### IMPORTANT

The TEST-EXAM01 candidate remains legitimately blocked because the examination itself has a ₹1200 registration/examination fee and the registration is PENDING. This is not a defect to be bypassed.

The S2 candidate should no longer be blocked solely by the unrelated ₹500 overdue institutional fee after the new code is deployed and the generation action is rerun.

## 5. Admit-card generation

### FIXED

The generation response now distinguishes:

- eligible
- issued
- blocked
- skipped because a valid issued ticket already exists
- blocked candidate reasons
- warnings

Existing blocked tickets are upgraded to ISSUED when a fresh authoritative eligibility evaluation passes. Existing issued tickets are skipped rather than duplicated.

### PARTIALLY VERIFIED

The PDF renderer and private storage pipeline already exist and perform non-empty PDF checks in the student download client. The bulk ZIP worker already records per-item failures and stores the resulting private file.

A fresh live execution of the revised bulk ZIP worker and external PDF parser has not been performed in this pass, so final PDF/ZIP integrity remains **UNVERIFIED** for the revised code state.

## 6. Cross-dashboard integration

| Integration | Source of truth | Status |
|---|---|---|
| Examination sessions/schedules | canonical Examination lifecycle | VERIFIED |
| Registration | `exam_registrations` | VERIFIED |
| Eligibility | `exam_eligibilities` + session policy | FIXED / PARTIALLY VERIFIED |
| Attendance | Attendance service/persisted attendance | VERIFIED |
| Fee clearance | canonical Fees invoices | FIXED / PARTIALLY VERIFIED |
| Hall tickets | `hall_tickets` | FIXED |
| Marks | `exam_marks` | VERIFIED |
| Result publication | `exam_result_publications` | VERIFIED |
| Legacy result compatibility | `ExamResult` projection | PARTIALLY VERIFIED |
| Student examination dashboard | canonical Examination APIs | PARTIALLY VERIFIED |
| Parent examination display | linked-student authorization | PARTIALLY VERIFIED |
| Faculty examination scope | assigned course offerings | VERIFIED at service level |
| HOD/Dean scope | managed departments | VERIFIED at service level |
| Director scope | delegated department/campus scope | VERIFIED at service level |

## 7. Authorization and isolation

### VERIFIED at source level

Examination routes require authentication, the `exams` feature entitlement, and operation-specific permissions. Services re-check:

- institution ownership
- course-offering ownership
- faculty assignment
- HOD/Dean department scope
- Director scope
- student visibility
- examination controller authority
- approval authority
- invigilation assignment

Student-specific examination endpoints use the shared student-visibility service.

### UNVERIFIED

A complete adversarial live API matrix using separate credentials for every role and cross-tenant identifiers has not been executed against the deployed service in this pass.

## 8. Files changed

- `backend/src/validators/coreErp.validators.ts`
  - constrained supported examination eligibility policy keys.
- `backend/src/services/examination.service.ts`
  - unified eligibility and hall-ticket blocking decisions.
  - removed unconditional overdue-fee blocking.
  - added structured candidate-level generation results.
  - made regeneration idempotent for already-issued tickets.
- `frontend/src/lib/examinationsApi.ts`
  - typed the richer generation response and session lifecycle fields.
- `frontend/src/app/examination/page.tsx`
  - replaced the misleading generic generation message with lifecycle-aware feedback.
  - admit-card workspace now communicates that generation re-evaluates eligibility.
- No examination database migration was required for this correction.

## 9. Verification performed

### Live database verification

Performed against the ACADLYX production database:

- inspected scheduled examination sessions
- compared eligibility rows with registrations
- inspected blocked hall-ticket reasons
- inspected examination fees
- inspected overdue canonical fee balances

The live records reproduced the inconsistency described above.

### Repository verification

The canonical Examination route/service architecture was inspected, including:

- sessions
- schedules
- rooms
- seating
- invigilation
- attendance
- marks
- result publication
- hall tickets
- bulk generation jobs
- revaluation
- incidents
- student eligibility
- student examination views
- legacy ERP examination endpoints

### CI

The latest source commits automatically triggered GitHub Actions on the production branch. At the time of this audit snapshot, the newest run for the final frontend typing commit was still **QUEUED**, so no passing build/test result is claimed here.

## 10. Performance findings

The canonical service uses institution predicates on raw SQL queries and has examination-specific indexes from the existing lifecycle migrations.

A remaining concern is candidate-by-candidate eligibility evaluation during hall-ticket generation. It is intentionally correctness-first, but large institutions should use a batched eligibility evaluation/background workflow rather than loading all students into memory.

Bulk ZIP generation already uses the background-job infrastructure.

## 11. Remaining UNVERIFIED / BLOCKED items

### UNVERIFIED

- Fresh live generation of the affected S2 session after deployment of the new code.
- Fresh live generation of TEST-EXAM01 proving the pending examination fee remains a legitimate blocker.
- External PDF parser validation of a newly generated admit card.
- ZIP content/count verification from the revised generation run.
- Full multi-role API penetration matrix.
- Browser console/network inspection.
- Full mobile examination workflow.
- Complete marks → result → transcript lifecycle execution on fresh test data.
- Complete examination policy-builder UI for all requested policy categories.
- Full exception/approval workflow for eligibility overrides.

### BLOCKED

No repository-level blocker prevented the source reconstruction. Runtime/browser proof for the final code state remains dependent on the deployment/worker environment and authenticated role credentials.

## 12. Final verification posture

**PARTIALLY VERIFIED — not 100% production verified.**

The immediate zero-admit-card root cause has been identified from real production data and the hardcoded fee-clearance behavior has been removed from the canonical hall-ticket path. Eligibility and hall-ticket issuance now use the same server-side decision model.

The remaining work is primarily fresh runtime verification and completion of the broader configurable-policy/operator UI surface described in the reconstruction specification. No authorization weakening or fee/attendance bypass was introduced.

# ACADLYX Governance Matrix

Status: policy baseline to reconcile with existing role identifiers, permission seeds, entitlement registry and business requirements before enforcement changes. This document does not create a parallel authorization system.

## Invariants

1. Backend authentication, action authorization, entitlement checks and database scope are authoritative; frontend navigation is not a security boundary.
2. Every record is institution-scoped. Campus, department, program, semester, section, assigned-class and linked-student scope applies where relevant.
3. Client-supplied IDs are selectors, never proof of access. Validate relationships server-side.
4. Each entity has one canonical owner. Consumer modules must not create competing ledgers or duplicate source records.
5. Sensitive mutations and approvals must be auditable. Never log tokens, secrets, payment credentials or unnecessary student details.
6. Never grant broad permissions to suppress errors. A 403 is correct when policy denies access.
7. Feature entitlement and action permission are separate controls; satisfy both when the route requires both.
8. Preserve posted financial and published examination history; use audited reversals/corrections rather than destructive rewrites.

## Operation matrix

| Domain / operation | Canonical owner | Access and approval | Scope / controls |
|---|---|---|---|
| Institution and campus settings | Institution Admin; platform Super Admin for platform policy | Explicit configuration permissions; sensitive changes follow existing approval policy | Institution/campus scope; audit changes |
| Users and roles | Institution Admin for institution users; Super Admin for platform identity | Explicit user/role permissions; privilege escalation controlled | Institution scope; audit role/account changes; permanent deletion guarded |
| Admissions/enrollment | Admissions / Registrar | Explicit create/edit permissions and existing approval steps | Institution and academic context; preserve lifecycle history |
| Academic structure | Registrar / authorized academic admin | Explicit permissions | Validate institution, academic year, program, semester and section relationships |
| Attendance/timetable | Faculty for assigned activities; authorized schedulers for schedules | Assigned-class actions; approvals only where existing policy requires | Scope to assigned class/subject and academic context; audit corrections |
| Course registration | Registrar / academic operations; student self-service only if enabled | Eligibility and configured approval | Own student or authorized academic scope |
| Examinations/results | Examination Cell; faculty assessment entry only within assignment | Eligibility exceptions, result corrections and publication require designated authority | Exam/institution scope; audit marks, eligibility and publication |
| Fee heads/structures | Accounts | Dedicated structure read/manage permissions; dedicated approval permission for activation | Institution and academic context; audit amounts, items and status |
| Invoices/payments/refunds | Accounts | Separate view, issue, payment, reconciliation and adjustment permissions | Institution/student scope; idempotency; compensating reversal transactions |
| Library circulation/charges | Librarian | Library permissions and policy-controlled charges | Institution/library and patron scope; preserve loan/charge provenance |
| Placement workflows | Placement team | Placement-specific permissions; student self-service limited to own records | Institution, eligibility and student scope; preserve application/offer history |
| HR | HR | HR-specific permissions and existing approval policy | Institution and authorized HR scope; protect sensitive data |
| Parent links | Registrar / authorized student administration | Authorized operator; validate both users and relationship | Parent only sees currently linked, authorized student records |
| Documents/exports | Owning module | Source permission plus document-specific scope; recheck at download | Audit sensitive exports; prevent public/orphaned URL exposure |
| CMS/branding | CMS Manager / institution admin | CMS/settings permissions | Institution-specific; personal appearance is not institution branding |
| Reports/intelligence | Management and configured data owners | Report permission plus each source-domain scope | Scope every source query; audit sensitive exports; derived reports are not canonical write surfaces |
| Entitlements | Platform governance / authorized Super Admin | Explicit platform permission and current policy | Institution/module key; invalidate relevant caches |
| Audit records | Governance / authorized auditor | Tightly scoped read-only access | Actor, entity, timestamp, outcome and request correlation ID |

## Role boundaries to validate against actual seeds

- Super Admin: platform administration under explicit policy; no accidental bypass of business invariants or tenant scope.
- Institution Admin: institutional configuration and user administration by explicit permissions; not an automatic replacement for Accounts or Examination Cell.
- Chairman/Management: strategic oversight and designated approvals, not unrestricted operational mutation.
- Director: assigned campus/institution scope; do not infer campus from department.
- Registrar: authorized academic and student administration.
- Dean: configured academic scope.
- HOD: authorized department scope only.
- Faculty: assigned classes, subjects, attendance and assessment entry only.
- Examination Cell: examination lifecycle within explicit permissions.
- Accounts: financial operations, reconciliation and reporting within scope.
- Librarian: inventory, circulation and policy-controlled charges.
- Placement: companies, drives, applications, interviews, offers and eligible-student scope.
- HR: employee records within HR scope; IT: only explicitly assigned technical operations.
- CMS Manager: content and branding, not unrelated student/finance mutation.
- Student: own records and enabled self-service.
- Parent: linked-student records only, checked server-side on every request.

## Approval policy

Reuse existing approval entities, permissions and audit services. Fee structure activation must require the existing dedicated approval permission. Fee waivers, high-impact adjustments/refunds, eligibility exceptions, result corrections/republication, sensitive configuration and permanent deletion must use designated existing approval workflows where policy requires. Capture requester, approver, decision, timestamp, reason and affected entity. Do not add approval steps to routine low-risk operations. If approval infrastructure is missing for a high-risk operation, document the gap before implementing a new model.

## Failure behavior

Validation errors use the established client-error contract. Missing/inaccessible entities follow non-disclosure policy. Unauthorized actions return 403. Unexpected exceptions return the standard error envelope and log a correlation ID server-side. Partial integration failure must not report success; use transactions or durable idempotent processing where warranted.

## Verification checklist

- [ ] Reconcile role IDs and permission seeds with this matrix.
- [ ] Verify authentication, entitlement and action permission on each route.
- [ ] Verify service invariants and institution/relationship scoping.
- [ ] Verify permission-cache keying and invalidation.
- [ ] Test allowed and denied reads and mutations.
- [ ] Verify approval audit includes actor, decision, reason, time and entity.
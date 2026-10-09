# ACADLYX Platform Inventory

Baseline branch: production-upgrade-2026-09-20. Working branch: stabilization-platform-2026-10-09. Date: 2026-10-09.

Status is conservative: PARTIAL means source exists but full workflows are not proven; UNVERIFIED means runtime evidence is missing; BLOCKED means required environment or credentials were unavailable. A page or route alone does not prove a module works.

## Architecture observed

- Frontend: Next.js, React, TypeScript; shared ERP API client at frontend/src/lib/erpApi.ts and shared dashboard shell.
- Backend: Node.js, Express, TypeScript, route middleware, controllers, services and validators.
- Persistence: PostgreSQL and Prisma, with parameterized raw SQL in some services.
- Security: authentication, action permissions, feature entitlements, service checks, institution-scoped queries and audit logging are present in inspected paths.

## Module inventory (initial, not exhaustive)

| Module | Provisional owner | Evidence / canonical data | Dependencies | Status |
|---|---|---|---|---|
| Authentication and sessions | Platform security | frontend auth library and backend authenticate middleware | All protected modules | PARTIAL |
| Role dashboards/navigation | Each role; shared shell owned by platform | dashboard routes and DashboardShell | Auth, RBAC, entitlements | PARTIAL |
| ERP operations | Institution operations | frontend/src/app/erp/page.tsx; erpApi.ts | Academic, fees, notices, documents | PARTIAL |
| Academic structure and enrollment | Registrar / academic operations | Program, semester and enrollment references in fee service | Institution, academic year, program, semester | UNVERIFIED end-to-end |
| Timetable and offerings | Academic operations | ERP routes and timetable/offerings API | Courses, faculty, rooms, sections | PARTIAL |
| Notices and notifications | Authorized communications owner | ERP routes and notification actions | Users, departments, producing modules | PARTIAL |
| Examinations and results | Examination Cell | Canonical examination lifecycle; legacy ERP writes return 410 | Enrollment, eligibility, marks, publication | PARTIAL |
| Fee heads and structures | Accounts; dedicated approver for activation | erp.routes.ts, feeStructure.service.ts; fee_heads, fee_structures, fee_structure_items | Academic context, audit, approvals | PARTIAL; UI permission mismatch identified |
| Invoices and payments | Accounts | fee-invoice/payment routes and canonical transactions | Students, fee structures, reconciliation | PARTIAL |
| Fee assignment | Accounts | fee-structure assignment service and invoice/transaction records | Active structures, enrollments, idempotency | PARTIAL |
| Student/parent links | Registrar / student administration | ERP parent-link routes | User identity and linked-student relationship | PARTIAL |
| Documents and exports | Owning module | ERP document workflows; storage/runtime not verified | Source permissions, file storage | UNVERIFIED end-to-end |
| Library | Librarian | Library inventory, loan and charge work exists in repository | Students, policy-based charges, financial obligations | PARTIAL |
| Placement | Placement team | Placement source and recent authentication audit | Student eligibility, drives, applications, offers | PARTIAL |
| Attendance | Faculty / academic operations | Full route/model map not yet extracted | Timetable, assigned classes, enrollment | UNVERIFIED |
| HR | HR | Full route/model map not yet extracted | Institution, employee records, audit | UNVERIFIED |
| Accounts/reporting | Accounts | Fee transactions and report permissions referenced | Fees, payments, refunds, reconciliation | PARTIAL |
| CMS/branding | CMS Manager / institution | Full route/model map not yet extracted | Institution settings, design system | UNVERIFIED |
| Audit and approvals | Governance and designated approvers | recordAuditLog calls; fee-structure approval route | Actor, entity, decision, timestamp | PARTIAL |
| Entitlements | Platform governance | requireFeature middleware in ERP routes | Institution/module key and permission | PARTIAL |
| Institutional intelligence | Management within configured scope | Full aggregation/source lineage not yet mapped | Academic, finance, placement, attendance | UNVERIFIED |
| Native mobile | Mobile product owner | mobile/ exists in recent repository history | Auth, role navigation, API parity | UNVERIFIED; device tests required |

## Role coverage to enumerate

Super Admin, Institution Admin, Chairman/Management, Director, Registrar, Dean, HOD, Faculty/Staff, Examination Cell, Accounts, Librarian, HR, Placement, IT, CMS Manager, Student, Parent and every additional role identifier actually present in enums/seeds. Display labels must not be assumed to equal backend role identifiers.

## Follow-up required

1. Extract every frontend route, backend route/method, permission, entitlement, controller, service and Prisma model from a full checkout.
2. Compare permission and role seeds with UI guards and backend middleware.
3. Map migrations and canonical foreign-key/data ownership.
4. Run existing build, lint, unit and integration tests to establish baseline failures.
5. Run authenticated API and browser workflows using non-production test data.
6. Upgrade statuses only when evidence demonstrates data, actions, authorization and persistence work together.
# ACADLYX Mobile Feature Parity

## Status semantics

- FOUNDATION: a route mapping or generic read-only surface exists; CRUD is not implied.
- PARTIAL: some functional workflow is wired, but native actions, edge cases, scope selection or test evidence are missing.
- NOT IMPLEMENTED: no usable native workflow is implemented.
- SERVER ONLY: a backend endpoint is not a user-facing app action.

Source reviewed: `backend/src/app.ts`, `backend/src/config/rbac.ts`, and the route/controller/validator/service files referenced in this matrix on protected base commit `2dc568ec4416a295028cf64eaa7ee659b9258d89`. The backend mount table contains 56 mount calls across 55 unique API prefixes because two routers share `/lms`. This matrix is an implementation inventory, not a claim of total parity.

| API surface | Native screen/action in this increment | Status and explicit gap |
|---|---|---|
| `/health` | No screen; service-level API | SERVER ONLY |
| `/auth` | Login, MFA, SecureStore token persistence, refresh, logout, password change, account roles | PARTIAL; profile editing/photo and password recovery not wired. The inspected auth router exposes a recovery-institution list, but no password-reset workflow. |
| `/workspace/context` | Native Workspace & context screen for campus, department, programme, academic year, batch, semester and section; canonical context is activated only after the server accepts it; query state is reset and invalidated on changes | PARTIAL; context filters are currently forwarded only to known list contracts that accept them, while remaining module-specific filters and live/device verification are still required |
| `/my-work` | Live home screen reads work summary/items | PARTIAL; work-item actions and safe native deep links are missing |
| `/search` | Native Search tab queries the existing `/search?q=` endpoint after a short input debounce; displays only server-returned person/course/notice results | PARTIAL; result-to-record deep links are not wired and live API/device verification remains |
| `/workflow` | No complete native approval queue | NOT IMPLEMENTED |
| `/placements` | Placement opportunity list mapping | PARTIAL; drives, applications, eligibility, interviews, offers and state transitions remain |
| `/institutions` | Generic read-only surface | FOUNDATION; administration forms are missing |
| `/users` | Generic read-only surface | FOUNDATION; account lifecycle, role/permission edit, deletion approvals and audit UI are missing |
| `/campuses` | Generic read-only surface | FOUNDATION; dedicated detail/edit and campus access management are missing |
| `/departments` | Generic read-only surface | FOUNDATION; dedicated structure management is missing |
| `/programs` | Generic read-only surface | FOUNDATION; lifecycle and curriculum management are missing |
| `/academic-years` | Generic read-only surface | FOUNDATION; create/update/current-year lifecycle is missing |
| `/batches` | Generic read-only surface | FOUNDATION; dedicated CRUD is missing |
| `/semesters` | Generic read-only surface | FOUNDATION; dedicated CRUD is missing |
| `/sections` | Generic read-only surface | FOUNDATION; roster and section management are missing |
| `/courses` | Generic read-only surface | FOUNDATION; course authoring is missing |
| `/course-offerings` | Generic read-only surface and selection source for assignment/timetable forms | PARTIAL; offering assignment/workload management is missing |
| `/obe` | Course-offering list surface | PARTIAL; outcomes, mapping, assessment scores, submission/approval and attainment workflows remain |
| `/students` | Generic student list and mapped `/students/me/*` routes | PARTIAL; student lifecycle, enrolment, document and student-detail workflows are incomplete |
| `/faculty` | Read surface for `/faculty/me/dashboard` | PARTIAL; dedicated teaching/workload screens and dashboard verification are missing |
| `/admissions` | Generic read-only application surface | PARTIAL; application status transitions, enrolment and document workflows remain |
| `/hr` | Employee read surface | PARTIAL; employee lifecycle, attendance and supported payroll workflows remain |
| `/leave` | Read surface mapped to `/leave/requests/mine` | PARTIAL; apply/cancel/approve/reject and balance/leave-type administration are missing |
| `/portal` | Notifications list, individual mark-read, mark-all-read, document list mapping | PARTIAL; push registration/delivery, preferences, authorized deep links, document lifecycle and notification create/bulk actions remain |
| `/library` | Dedicated catalogue/search, available-only filter, self-reservations, my loans, staff circulation, renew/return conditions, fines, and book create/edit; borrower/book are selected from API results rather than raw IDs | PARTIAL; copy-level inventory management, reservation cancel/queue, issue lookup when `/students` is denied, fine waiver approvals, richer policy screens and device/API test evidence remain |
| `/calendar` | Dedicated event list/search/create/edit/delete at `/calendar/events` using server-scoped handlers | PARTIAL; academic-year picker, recurring/timezone-specific UX and integration/device test evidence remain |
| `/registrations` | Generic read-only registration surface | PARTIAL; individual/bulk submit, decision, drop and offering update workflows remain |
| `/enrollment-requests` | Generic read-only request surface | PARTIAL; individual/bulk decision workflow is missing |
| `/movements` | No dedicated workflow | NOT IMPLEMENTED |
| `/certificates` | Generic read-only surface | PARTIAL; request, issue and rejection actions are missing |
| `/attendance-sessions` | Native session list/detail, create from selected course offering, roster PRESENT/ABSENT/LATE marking, draft save, submit only with complete roster, and locked-session guard | PARTIAL; correction-request creation/approval, richer filters and isolated integration/device test evidence remain |
| `/assignments` | Dedicated list/detail, create draft, DRAFT/PUBLISHED toggle, student submit, review roster, grade/feedback and explicit reopen | PARTIAL; attachments, robust pagination/filtering, comprehensive edge-case/device tests and service-level test evidence remain |
| `/internal-marks` | Generic read-only marks surface | PARTIAL; mark entry, validation and approval are missing |
| `/grades` | Grade-scale read surface mapped to `/grades/scale` | PARTIAL; complete grade/result publishing and history UX is missing |
| `/directory` | Generic read-only surface where permitted | FOUNDATION; typed directory/search UX remains |
| `/examinations` | Session read surface | PARTIAL; schedules, rooms, seating, invigilators, hall tickets, mark entry/approval, revaluation and publication remain |
| `/attendance` | No governance/correction workflows | NOT IMPLEMENTED |
| `/lms` (two routers) | Catalog read surface mapped to `/lms/catalog` | PARTIAL; modules, lessons, resources, quizzes/attempts, grading, announcements and live-class workflows remain |
| `/billing` | No complete billing workflow | NOT IMPLEMENTED |
| `/finance` | Overview, invoices and payments read surfaces; Finance Command Center route mapping | PARTIAL; invoice/payment/refund/concession/reconciliation approvals, receipts, fee-structure workflow and audit/export remain |
| `/parent` | Children list endpoint mapped to `/parent/children` | PARTIAL; child-specific attendance, results, fees, coursework, notices and calendar require a full scope-aware parent experience |
| `/operations` | Summary read surface mapped to `/operations/summary` | PARTIAL; assets, maintenance and facilities CRUD/workflows remain |
| `/security` | No audit/security administration screen | NOT IMPLEMENTED |
| `/subscriptions` | No native subscription administration | NOT IMPLEMENTED |
| `/intelligence` | Command-center read surface | PARTIAL; student risk/recommendations/career/report filtering and export are missing |
| `/ask-acadlyx` | No native assistant integration | NOT IMPLEMENTED |
| `/erp` | Dedicated notice create/edit/delete and timetable create/edit/delete; actual course offerings are chosen via API | PARTIAL; department-targeted notice picker and device/API test evidence remain. Legacy ERP exam writes return 410 and must not be revived. |
| `/imports` | No native picker/preview/commit workflow | NOT IMPLEMENTED |
| `/people-imports` | No native picker/preview/commit workflow | NOT IMPLEMENTED |
| `/exports` | No format selection, file download or export-audit UI | NOT IMPLEMENTED |
| `/site-content` | No native CMS authoring/publishing | NOT IMPLEMENTED |
| `/events` | Generic event read surface | PARTIAL; event create/edit/delete, media upload/reorder and categories are missing |
| `/institutional-cms` | No native authoring/publish workflow | NOT IMPLEMENTED |
| `/files` | No upload/download/binary-preview workflow | NOT IMPLEMENTED |
| `/payment-webhooks` | Server-to-server route; not exposed as an interactive mobile action | SERVER ONLY |

## Role inventory

The backend RBAC catalog has 20 role identifiers: `SUPER_ADMIN`, `INSTITUTION_ADMIN`, `CHAIRMAN`, `MANAGEMENT`, `DIRECTOR`, `DEAN`, `REGISTRAR`, `HOD`, `FACULTY`, `ACCOUNTS`, `HR`, `ADMISSIONS`, `EXAMINATION`, `LIBRARIAN`, `PLACEMENT`, `IT`, `CMS`, `STUDENT`, `PARENT`, and `CLUB_PRESIDENT`. All can reach the authenticated shell where the backend grants a session, but this does **not** mean all 20 dedicated dashboards or role workflows are implemented. See `MOBILE_ROLE_PERMISSION_MATRIX.md`.

## Completion evidence

The implemented source currently includes sign-in/MFA, native tabs, My Work, permission-filtered module discovery, generic read-only detail rendering, dedicated assignment/notices/timetable/library workflows, notifications read actions, account roles and password change. The exact original logo is used on sign-in. Student self-service routes are mapped but not smoke-tested.

A screen/route is not evidence of complete feature parity. Each feature needs a dedicated API contract, validation, permission and scope checks, loading/empty/error/success states, idempotent mutations where relevant, query invalidation and automated tests against an isolated institution. TypeScript, native builds, live integration tests, scope-isolation tests and web/mobile data-consistency tests have **not** been run in this environment. No 100% parity claim is made.

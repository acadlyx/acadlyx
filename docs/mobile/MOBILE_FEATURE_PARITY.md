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
| `/workspace/context` | Native Workspace & context screen for all seven dimensions; selection is activated only after server validation; saved values are bound to account/role/permission shape; stale query values are reset before the active context changes | PARTIAL; current role/access is resolved on every request, curriculum lists enforce server scope, and an opt-in real-API/PostgreSQL isolation suite covers all 20 roles, multi-role precedence, revocation, deleted/foreign selections and student/tenant isolation; latest CI must pass and module-specific filters/live device verification remain required |
| `/my-work` | Live home screen reads work summary/items | PARTIAL; work-item actions and safe native deep links are missing |
| `/search` | Native Search tab queries the existing `/search?q=` endpoint after a short input debounce; displays only server-returned person/course/notice results | PARTIAL; result-to-record deep links are not wired and live API/device verification remains |
| `/workflow` | No complete native approval queue | NOT IMPLEMENTED |
| `/placements` | Dedicated placement workspace: drives, opportunities, server eligibility explanation, student registration/application, offers and placement calendar | PARTIAL; coordinator create/edit, interview/test and offer administration, cohort targeting UI, documents and live/device verification remain |
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
| `/portal/documents/me` | Dedicated native Documents reader using authenticated owner-scoped records, safe HTTP(S) open handling, refresh/retry and empty states | PARTIAL; native file upload, in-app binary download and management actions remain intentionally unavailable in this read-only slice |\n| `/students/me/marks`, `/examinations/my/performance`, `/examinations/my/results`, `/examinations/sessions/:id/marksheet.pdf` | Student Performance merges approved exam marks with separate internal assessment marks; Published Results shows official publication rows and authenticated PDF marksheet preview/share | PARTIAL; grade/semester aggregation, live API-role scenarios and physical-device download verification remain |
| `/internal-marks`, `/faculty/me/course-offerings`, `/course-offerings/:id/roster` | Dedicated native internal-mark workspace: assigned faculty courses, live roster, saved component marks, validated partial save, and scoped read-only lists for authorized academic/examination roles | PARTIAL; approval is not part of the existing internal-marks API; mark corrections, bulk import/export, marksheet downloads, complete pagination and live API/device evidence remain |
| `/grades` | Grade-scale read surface mapped to `/grades/scale` | PARTIAL; complete grade/result publishing and history UX is missing |
| `/directory` | Generic read-only surface where permitted | FOUNDATION; typed directory/search UX remains |
| `/examinations` | Dedicated native sessions/schedules plus staff marksheet read, draft save, submit, approve, lock and queued results publication; Student/Parent roles do not open the whole-roster marksheet | PARTIAL; room/seating/invigilation, exam attendance, hall tickets and file downloads, correction/revaluation, complete publication-job UX and API/device tests remain |
| `/attendance` | No governance/correction workflows | NOT IMPLEMENTED |
| `/lms` (two routers) | Catalog read surface mapped to `/lms/catalog` | PARTIAL; modules, lessons, resources, quizzes/attempts, grading, announcements and live-class workflows remain |
| `/billing` | No complete billing workflow | NOT IMPLEMENTED |
| `/finance`, `/erp/fee-structures` | Dedicated native Finance Workspace for scoped invoice/payment status, refund request/approval/processing, and fee-structure submit/publish/approve/reject transitions | PARTIAL; invoice creation/cancellation, payment recording/checkout/confirmation, fee assignment, concessions, reconciliation, receipts, exports/audit and server pagination remain; API/device verification required |
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

The backend RBAC catalog has 20 role identifiers: `SUPER_ADMIN`, `INSTITUTION_ADMIN`, `CHAIRMAN`, `MANAGEMENT`, `DIRECTOR`, `DEAN`, `REGISTRAR`, `HOD`, `FACULTY`, `ACCOUNTS`, `HR`, `ADMISSIONS`, `EXAMINATION`, `LIBRARIAN`, `PLACEMENT`, `IT`, `CMS`, `STUDENT`, `PARENT`, and `CLUB_PRESIDENT`. Each now has a separate native dashboard composition in `mobile/src/screens/RoleDashboardScreen.tsx`, using the same effective-role priority as the backend. These dashboards are `IMPLEMENTED_UNVERIFIED`: live authorized API and device verification is still required, and dashboard availability does **not** imply workflow parity. See `MOBILE_IMPLEMENTATION_TRACKER.md` and `MOBILE_ROLE_PERMISSION_MATRIX.md`.

## Completion evidence

The implemented source currently includes sign-in/MFA, native tabs, My Work, permission-filtered module discovery, generic read-only detail rendering, dedicated assignment/notices/timetable/library workflows, notifications read actions, account roles and password change. The exact original logo is used on sign-in. Student self-service routes are mapped but not smoke-tested.

A screen/route is not evidence of complete feature parity. Each feature needs a dedicated API contract, validation, permission and scope checks, loading/empty/error/success states, idempotent mutations where relevant, query invalidation and automated tests against an isolated institution. Workspace query-transition unit coverage and the real API/PostgreSQL isolation suite are now present in source; treat them as verified only when the current CI run has completed successfully. These suites do not substitute for signed Android/iOS builds, device coverage, or complete module-by-module web/mobile data-consistency testing. No 100% parity claim is made.

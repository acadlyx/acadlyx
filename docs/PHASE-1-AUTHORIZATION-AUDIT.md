# ACADLYX Phase 1 — Authorization Foundation Audit

Generated against the uploaded `production-upgrade-2026-09-20` source tree.

## Current architecture

The repository already has a meaningful RBAC foundation:

- canonical roles in `backend/src/config/rbac.ts`
- permission catalogue and role grants
- backend `authorize()` middleware
- tenant-aware authorization helpers
- permission-aware frontend navigation
- dedicated dashboard/workspace components
- institution-scoped profile-photo endpoints
- institution-admin workspace service that already avoids fees, exams, assignments, marks and attendance queries

This batch tightens the foundation without replacing unrelated application modules.

## Role map

| Role | Intended workspace |
|---|---|
| SUPER_ADMIN | Platform / tenants / subscription / platform audit |
| INSTITUTION_ADMIN | People / students / academic structure / institutional administration |
| CHAIRMAN | Institutional oversight / intelligence / reports / strategic visibility |
| DIRECTOR | Institutional leadership / approvals / oversight |
| DEAN | School-level academic leadership |
| REGISTRAR | Official academic/student lifecycle |
| HOD | Department academic oversight |
| FACULTY | Assigned teaching, attendance, assignments, marks |
| ACCOUNTS | Fees, payments, refunds, reconciliation |
| HR | Employees, HR lifecycle, leave |
| ADMISSIONS | Applicants and admissions workflow |
| EXAMINATION | Examination scheduling, marks and results |
| LIBRARIAN | Library operations |
| PLACEMENT | Placement operations |
| IT | Technical administration |
| CMS | Public website content |
| STUDENT | Own academic/service workspace |
| PARENT | Linked-student workspace |
| CLUB_PRESIDENT | Assigned club workspace |

## Phase-1 corrections in this batch

### 1. Institution Admin permission boundary

Institution Admin no longer receives:

- `timetable.*`
- `admissions.read`
- `reports.read`
- `intelligence.read`
- `registration.read`
- `promotions.read`
- `certificates.read`
- fees permissions
- assignments/marks permissions
- attendance permissions
- examination/result permissions
- HR permissions
- library permissions
- placement permissions

The role remains responsible for:

- users
- students
- departments
- programs
- academic years
- semesters
- sections
- courses
- course offerings
- campuses
- notices
- notifications
- documents
- calendar
- parent-student links
- institution administration/operations

The exact backend permissions remain the authoritative list.

### 2. Backend role normalization

`authorizeRoles()` now normalizes legacy aliases such as:

- `MANAGEMENT` → `CHAIRMAN`
- `STAFF` → `ACCOUNTS`

before comparing workspace roles.

### 3. Tenant boundary

Permission and workspace middleware now require an institution context for non-platform users.

`SUPER_ADMIN` remains the only platform role allowed to operate without an institution context at this middleware boundary.

Resource-level department/program/course/student checks remain service responsibilities.

### 4. Institution Admin navigation

The Institution Admin sidebar no longer exposes:

- Timetable
- Admissions
- Reports
- Intelligence
- Course registration
- Student movement
- Certificates

Students now have their own explicit navigation entry.

Admissions is no longer considered an Institution Admin-owned route namespace.

## Important existing safeguards confirmed

### Profile photos

The current source already provides:

- authenticated user photo retrieval
- authenticated self photo upload
- Institution Admin / Super Admin user-photo updates
- institution boundary before another user's photo is returned
- institution boundary before an admin edits another user's photo

### Institution Admin dashboard API

`managementWorkspace.service.ts` already contains a dedicated Institution Admin workspace and deliberately avoids querying:

- fee invoices
- fee payments
- exams
- exam results
- assignments
- internal marks
- attendance sessions

It additionally gates its remaining metrics by the actor's permissions.

This is preserved rather than replaced.

## Remaining Phase-1 work

The following must still be audited in subsequent batches before calling Phase 1 complete:

1. every dashboard API response against the role's permission set
2. management/leadership dashboard data scope
3. department/program/course/section resource scope
4. route-level namespace versus read-only oversight routes
5. directory endpoints
6. export/import authorization
7. intelligence endpoints
8. parent/student relationship enforcement
9. custom/stale permission rows versus canonical RBAC
10. frontend route protection versus actual API capability
11. dashboard preloading and unnecessary queries
12. tenant isolation tests across every specialist module

## Route inventory

The backend currently mounts the following route families:

| `/academic-years` | `academicYear.routes.ts` | 4 | `"academic-years.read"`, `"academic-years.create"`, `"academic-years.update"` |
| `/admissions` | `admission.routes.ts` | 6 | `"admissions.read"`, `"admissions.manage"`, `"admissions.manage", "students.create"` |
| `/assignments` | `assignment.routes.ts` | 7 | `"assignments.read"`, `"assignments.create"`, `"assignments.update"`, `"assignments.review"`, `"assignments.submit"` |
| `/attendance` | `attendanceGovernance.routes.ts` | 11 | `"attendance.read"`, `"attendance.policy"`, `"attendance.read", "reports.read"`, `"attendance.correct"`, `"attendance.approve"`, `"attendance.lock"` |
| `/attendance-sessions` | `attendanceSession.routes.ts` | 4 | `"attendance.read"`, `"attendance.mark"` |
| `/auth` | `auth.routes.ts` | 11 | middleware/service-specific |
| `/calendar` | `calendar.routes.ts` | 5 | `"calendar.read"`, `"calendar.manage"` |
| `/campuses` | `campus.routes.ts` | 5 | `"campuses.read"`, `"campuses.create"`, `"campuses.update"`, `"campuses.delete"` |
| `/certificates` | `certificate.routes.ts` | 7 | `"certificates.request"`, `"certificates.read"`, `"certificates.issue"` |
| `/courses` | `course.routes.ts` | 5 | `"courses.read"`, `"courses.create"`, `"courses.update"`, `"courses.delete"` |
| `/course-offerings` | `courseOffering.routes.ts` | 6 | `"course-offerings.read"`, `"course-offerings.create"`, `"course-offerings.update"`, `"course-offerings.delete"`, `"students.read"` |
| `/departments` | `department.routes.ts` | 5 | `"departments.read"`, `"departments.create"`, `"departments.update"`, `"departments.delete"` |
| `/directory` | `directory.routes.ts` | 3 | middleware/service-specific |
| `/erp` | `erp.routes.ts` | 30 | `"notifications.read"`, `"timetable.read"`, `"timetable.manage"`, `"notices.read"`, `"notices.manage"`, `"exams.read"`, `"exams.manage"`, `"fees.read"` |
| `/examinations` | `examination.routes.ts` | 31 | `"exams.read"`, `"exams.manage"`, `"exams.approve"`, `"exams.invigilate"`, `"marks.read"`, `"marks.enter"`, `"exams.revaluate"` |
| `/exports` | `export.routes.ts` | 1 | `"reports.read"` |
| `/faculty` | `faculty.routes.ts` | 2 | `"FACULTY"`, `"course-offerings.read"`, `"attendance.read"` |
| `/billing` | `feeBilling.routes.ts` | 21 | `"fees.read"`, `"fees.manage"`, `"fees.approve"`, `"fees.pay"`, `"fees.refund"`, `"fees.reconcile"` |
| `/grades` | `grading.routes.ts` | 4 | `"results.read"` |
| `/health` | `health.routes.ts` | 2 | middleware/service-specific |
| `/hr` | `hr.routes.ts` | 6 | `"hr.manage"`, `"hr.read"` |
| `/imports` | `import.routes.ts` | 2 | `"imports.manage"` |
| `/institutions` | `institution.routes.ts` | 9 | `"institutions.manage"` |
| `/intelligence` | `intelligence.routes.ts` | 5 | middleware/service-specific |
| `/internal-marks` | `internalMark.routes.ts` | 2 | `"marks.read"`, `"marks.enter"` |
| `/leave` | `leave.routes.ts` | 11 | `"leave.apply"`, `"leave.manage"`, `"leave.approve"`, `"leave.read"` |
| `/library` | `library.routes.ts` | 11 | `"library.read"`, `"library.manage"`, `"library.borrow"` |
| `/lms` | `lms.routes.ts` | 25 | `"lms.read"`, `"lms.manage"`, `"lms.attempt"`, `"lms.grade"` |
| `/movements` | `movement.routes.ts` | 6 | `"promotions.read"`, `"promotions.manage"`, `"promotions.approve"` |
| `/operations` | `operations.routes.ts` | 12 | `"operations.read"`, `"operations.manage"`, `"maintenance.raise"` |
| `/parent` | `parentPortal.routes.ts` | 9 | `"parent-portal.read"` |
| `/portal` | `portal.routes.ts` | 13 | `"PARENT", "SUPER_ADMIN", "INSTITUTION_ADMIN", "DIRECTOR", "MANAGEMENT", "HOD", "STAFF"`, `"students.read"`, `"STUDENT"`, `"attendance.read"`, `"notices.manage"`, `"students.update"` |
| `/programs` | `program.routes.ts` | 5 | `"programs.read"`, `"programs.create"`, `"programs.update"`, `"programs.delete"` |
| `/registrations` | `registration.routes.ts` | 7 | `"registration.submit"`, `"registration.read"`, `"registration.approve"` |
| `/sections` | `section.routes.ts` | 5 | `"sections.read"`, `"sections.create"`, `"sections.update"`, `"sections.delete"` |
| `/security` | `security.routes.ts` | 9 | `"users.update"` |
| `/semesters` | `semester.routes.ts` | 5 | `"semesters.read"`, `"semesters.create"`, `"semesters.update"`, `"semesters.delete"` |
| `/site-content` | `siteContent.routes.ts` | 4 | `"site.manage"` |
| `/students` | `student.routes.ts` | 12 | `"STUDENT"`, `"students.read"`, `"students.create"`, `"students.update"`, `"students.create", "students.update"` |
| `/subscriptions` | `subscriptionPlan.routes.ts` | 6 | `"plans.manage"` |
| `/users` | `user.routes.ts` | 8 | `"users.read"`, `"users.create"`, `"users.update"`, `"users.delete"` |
| `/ask-acadlyx` | `ask.routes.ts` | 1 | middleware/service-specific |

## Frontend API/dashboard references discovered

The frontend currently references these API families:

- `${path}${query}`
- `/academic-years`
- `/ask-acadlyx`
- `/assignments`
- `/assignments/${assignmentId}/submissions`
- `/assignments/${assignmentId}/submissions/${studentId}`
- `/assignments/${assignmentId}/submit`
- `/assignments/${id}`
- `/attendance-sessions`
- `/attendance-sessions/${sessionId}`
- `/attendance-sessions/${sessionId}/records`
- `/auth/account`
- `/auth/account/photo`
- `/auth/change-password`
- `/auth/me`
- `/billing/concessions`
- `/billing/concessions${buildQuery(params)}`
- `/billing/concessions/${id}`
- `/billing/invoices${buildQuery(params)}`
- `/billing/invoices/${id}`
- `/billing/invoices/${id}/cancel`
- `/billing/invoices/${invoiceId}/checkout`
- `/billing/invoices/generate`
- `/billing/late-fee-rules`
- `/billing/late-fees/apply`
- `/billing/payments/${paymentId}/receipt`
- `/billing/payments/confirm`
- `/billing/payments/offline`
- `/billing/reconciliations`
- `/billing/reconciliations${buildQuery(params)}`
- `/billing/refunds`
- `/billing/refunds${buildQuery(params)}`
- `/billing/refunds/${id}`
- `/billing/students/${studentId}`
- `/calendar/events`
- `/calendar/events${buildQuery(params)}`
- `/calendar/events/${id}`
- `/calendar/events/upcoming`
- `/certificates`
- `/certificates${buildQuery(params as Record<string, string | number | undefined>)}`
- `/certificates/${id}`
- `/certificates/${id}/issue`
- `/certificates/${id}/reject`
- `/certificates/mine`
- `/course-offerings`
- `/course-offerings/${courseOfferingId}/roster`
- `/departments`
- `/directory/course-offerings${buildQuery({ search })}`
- `/directory/students${buildQuery({ search })}`
- `/directory/users${buildQuery({
      search,
      roles: roles && roles.length `
- `/erp/exam-results`
- `/erp/exams`
- `/erp/fee-heads`
- `/erp/fee-heads/${id}`
- `/erp/fee-invoices`
- `/erp/fee-invoices/${invoiceId}/payments`
- `/erp/fee-structures`
- `/erp/fee-structures/${id}`
- `/erp/me/workspace`
- `/erp/notices`
- `/erp/parent-links`
- `/erp/timetable`
- `/examinations/incidents`
- `/examinations/incidents${buildQuery(params)}`
- `/examinations/incidents/${id}`
- `/examinations/my/invigilation`
- `/examinations/revaluations`
- `/examinations/revaluations${buildQuery(params)}`
- `/examinations/revaluations/${id}`
- `/examinations/rooms`
- `/examinations/schedules`
- `/examinations/schedules/${scheduleId}/attendance`
- `/examinations/schedules/${scheduleId}/invigilators`
- `/examinations/schedules/${scheduleId}/lock`
- `/examinations/schedules/${scheduleId}/marks`
- `/examinations/schedules/${scheduleId}/marks/approve`
- `/examinations/schedules/${scheduleId}/publish`
- `/examinations/schedules/${scheduleId}/seating`
- `/examinations/sessions`
- `/examinations/sessions${buildQuery(params)}`
- `/examinations/sessions/${id}`
- `/examinations/sessions/${id}/status`
- `/examinations/sessions/${sessionId}/hall-ticket${buildQuery({ studentId })}`
- `/examinations/sessions/${sessionId}/hall-tickets`
- `/examinations/students/${studentId}`
- `/faculty/me/course-offerings`
- `/faculty/me/dashboard`
- `/grades/course-offerings/${courseOfferingId}`
- `/grades/me`
- `/grades/scale`
- `/grades/students/${studentId}`
- `/hr/eligible-users`
- `/hr/employees`
- `/hr/employees${query}`
- `/hr/employees/${id}`
- `/institutions`
- `/institutions/${institution.id}/entitlements`
- `/institutions/${institution.id}/status`
- `/institutions/${selectedTenant.id}/entitlements`
- `/institutions/stats`
- `/intelligence/command-center`
- `/internal-marks`
- `/leave/balances`
- `/leave/requests`
- `/leave/requests/${id}/cancel`
- `/leave/requests/${id}/decision`
- `/leave/types`
- `/library/books`
- `/library/books${buildQuery({
      page: params.page,
      search: params.search,
      category: params.category,
      availableOnly: params.availableOnly `
- `/library/books/${id}`
- `/library/loans`
- `/library/loans${buildQuery(params as Record<string, string | number | undefined>)}`
- `/library/loans/${id}/return`
- `/library/loans/mine`
- `/library/reservations`
- `/library/reservations/${id}/cancel`
- `/library/summary`
- `/lms/attempts/${attemptId}`
- `/lms/attempts/${attemptId}/grade`
- `/lms/attempts/${attemptId}/submit`
- `/lms/lessons`
- `/lms/lessons/${id}`
- `/lms/lessons/${lessonId}/progress`
- `/lms/lessons/${lessonId}/resources`
- `/lms/modules`
- `/lms/modules${buildQuery({ courseOfferingId })}`
- `/lms/modules/${id}`
- `/lms/progress/offering${buildQuery({ courseOfferingId })}`
- `/lms/questions`
- `/lms/questions${buildQuery(params)}`
- `/lms/quizzes`
- `/lms/quizzes${buildQuery({ courseOfferingId })}`
- `/lms/quizzes/${quizId}/attempts`
- `/lms/quizzes/${quizId}/questions`
- `/lms/quizzes/${quizId}/status`
- `/movements/candidates${buildQuery(params)}`
- `/movements/requests`
- `/movements/requests${buildQuery(params as Record<string, string | number | undefined>)}`
- `/movements/requests/${id}/decision`
- `/movements/requests/bulk-promotion`
- `/movements/students/${studentId}/history`
- `/operations/asset-categories`
- `/operations/assets`
- `/operations/assets${buildQuery(params)}`
- `/operations/assets/${id}`
- `/operations/facilities`
- `/operations/facilities${buildQuery(params)}`
- `/operations/facilities/${id}`
- `/operations/maintenance`
- `/operations/maintenance${buildQuery(params)}`
- `/operations/maintenance/${id}`
- `/operations/summary`
- `/parent/alerts/${alertId}/acknowledge`
- `/parent/children`
- `/parent/children/${studentId}`
- `/parent/children/${studentId}/attendance`
- `/parent/children/${studentId}/calendar`
- `/parent/children/${studentId}/coursework`
- `/parent/children/${studentId}/fees`
- `/parent/children/${studentId}/notices`
- `/parent/children/${studentId}/results`
- `/portal/documents`
- `/portal/documents/${id}`
- `/portal/documents/me`
- `/portal/documents/students/${studentId}`
- `/portal/me`
- `/portal/notifications`
- `/portal/notifications/${id}`
- `/portal/notifications/${notificationId}`
- `/portal/notifications/read-all`
- `/portal/parent/children`
- `/portal/parent/dashboard`
- `/portal/students/${studentId}`
- `/programs`
- `/registrations`
- `/registrations${buildQuery(params as Record<string, string | number | undefined>)}`
- `/registrations/${id}/decision`
- `/registrations/${id}/drop`
- `/registrations/mine`
- `/registrations/offerings/${courseOfferingId}`
- `/registrations/offerings/available${buildQuery({
      page: params.page,
      semesterId: params.semesterId,
      electivesOnly: params.electivesOnly `
- `/sections`
- `/security/mfa`
- `/security/mfa/confirm`
- `/security/mfa/disable`
- `/security/mfa/enroll`
- `/security/sessions/revoke-all`
- `/semesters`
- `/site-content`
- `/students`
- `/students/${editing.id}`
- `/students/${editing.id}/enrollments`
- `/students/${id}`
- `/students/${id}/enrollments`
- `/students/${selected.id}`
- `/students/${selected.id}/enrollments`
- `/students/${student.id}`
- `/students/me/assignments`
- `/students/me/attendance`
- `/students/me/dashboard`
- `/students/me/marks`
- `/students/me/timetable`
- `/users`
- `/users/${id}`
- `/users/${id}/status`
- `/users/${userId}/photo`
- `/users/${userId}/status`
- `/users/photos`

## Phase-1 acceptance rule

Phase 1 is complete only when every protected operation can be traced as:

**Role → Permission → Module → Route → API → Action → Data Scope**

and a user who lacks that chain:

- does not see the module,
- cannot open the direct route,
- does not preload the API,
- receives a backend authorization failure if they call the API directly,
- cannot cross the authenticated institution boundary.

This document is an audit baseline, not a claim that all ten phases are complete.

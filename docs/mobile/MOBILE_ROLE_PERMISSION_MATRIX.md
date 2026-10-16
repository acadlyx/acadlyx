# ACADLYX Mobile Role Permission Matrix

## Canonical backend role inventory

The following 20 role identifiers were read from backend/src/config/rbac.ts on base commit 2dc568ec4416a295028cf64eaa7ee659b9258d89. These are role names from code, not a claim that every role-specific mobile dashboard is complete.

| Backend role | Current native entry experience | Status |
|---|---|---|
| SUPER_ADMIN | Authenticated shell; only modules with returned matching permissions are shown | PARTIAL; dedicated platform dashboard/workflows missing |
| INSTITUTION_ADMIN | Authenticated shell; permission-filtered modules | PARTIAL; institution administration workflows missing |
| CHAIRMAN | Authenticated shell; permission-filtered modules | PARTIAL; management dashboard and approval queue missing |
| MANAGEMENT | Authenticated shell; permission-filtered modules | PARTIAL; management dashboard and approvals missing |
| DIRECTOR | Authenticated shell; permission-filtered modules | PARTIAL; campus-scoped dashboard/context selector missing |
| DEAN | Authenticated shell; permission-filtered modules | PARTIAL; dedicated dean dashboard missing |
| REGISTRAR | Authenticated shell; permission-filtered modules | PARTIAL; registrar workflows missing |
| HOD | Authenticated shell; permission-filtered modules | PARTIAL; department dashboard/context selector missing |
| FACULTY | Authenticated shell; permission-filtered modules | PARTIAL; workload/teaching workflow screens missing |
| ACCOUNTS | Authenticated shell; permission-filtered finance entries | PARTIAL; complete financial operations and approvals missing |
| HR | Authenticated shell; permission-filtered modules | PARTIAL; employee/leave lifecycle missing |
| ADMISSIONS | Authenticated shell; permission-filtered modules | PARTIAL; applicant lifecycle missing |
| EXAMINATION | Authenticated shell; permission-filtered modules | PARTIAL; end-to-end examination/result workflow missing |
| LIBRARIAN | Authenticated shell; permission-filtered modules | PARTIAL; circulation/inventory/fines workflows missing |
| PLACEMENT | Authenticated shell; permission-filtered placement entry | PARTIAL; drive/application/offer lifecycle missing |
| IT | Authenticated shell; permission-filtered modules | PARTIAL; IT/maintenance workflows missing |
| CMS | Authenticated shell; permission-filtered modules | PARTIAL; CMS authoring and publishing missing |
| STUDENT | Authenticated shell plus STUDENT-gated self-service endpoint mapping | PARTIAL; full learning, payment, files and timetable workflows need verification |
| PARENT | Authenticated shell; no complete dedicated parent workspace yet | NOT IMPLEMENTED |
| CLUB_PRESIDENT | Authenticated shell; permission-filtered modules | PARTIAL; club/event workflows missing |

## Enforcement contract

1. Roles and permissions originate from the authenticated backend response, not client-maintained lists of assumed grants.
2. Menu filtering is a usability aid only. The backend must enforce every protected endpoint and record scope.
3. The role identifier STUDENT gates the current self-service route cards because the corresponding backend route explicitly uses STUDENT role authorization.
4. An Institution Admin must not implicitly receive fees, exams, assignments or any other permission absent from the returned session permissions.
5. A Director's actual campus scope and an HOD's actual department scope must be enforced by backend services, not by a client-supplied institution/campus/department ID.
6. Before a user can switch workspace/context, the app must request GET /api/v1/workspace/context and refresh all scope-dependent requests. That selector is not implemented in this increment.
7. On a 403 response, the app reports the denial and does not work around it. A menu item being visible does not imply the API will allow access.

## Known permission keys used by the native catalog

The catalogue currently consults known keys: students.read, users.read, campuses.read, departments.read, programs.read, academic-years.read, batches.read, semesters.read, sections.read, courses.read, course-offerings.read, attendance.read, assignments.read, marks.read, exams.read, results.read, timetable.read, calendar.read, registration.read, enrollment.read, admissions.read, placements.read, hr.read, leave.read, fees.read, fees.collection.read, fees.invoice.read, fees.payment.read, notices.read, notifications.read, documents.read, library.read, events.read, certificates.read, operations.read, obe.read, lms.read, intelligence.read, reports.read and institutions.manage.

This list is not a substitute for inspecting every endpoint's actual middleware. Several module routes and endpoint aliases still need permission/schema verification. Dedicated role dashboards and a complete route-permission-scope test matrix remain release blockers.
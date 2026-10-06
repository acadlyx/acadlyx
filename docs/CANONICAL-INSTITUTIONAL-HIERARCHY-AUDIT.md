# ACADLYX — Canonical Institutional Hierarchy Audit

Branch: canonical-institutional-hierarchy

## Executive finding

The repository already has a substantial canonical academic backbone. The authoritative chain is currently:

Institution -> Campus -> Department -> Program -> AcademicYear -> Semester -> Section -> StudentEnrollment -> CourseOffering.

There is no second academic hierarchy model that should replace it. The correct strategy is normalization and propagation, not a V2 model.

## Existing authoritative models

- Institution: tenant boundary.
- Campus: optional physical/administrative scope.
- Department: institution + optional campus.
- Program: institution + department.
- AcademicYear: institution-scoped operating year.
- Semester: program + academic year; unique by program/year/number.
- Section: semester-owned student group.
- Course: reusable department-owned course definition.
- CourseOffering: concrete course/semester/section teaching instance.
- StudentEnrollment: student + program + academic year + semester + section.
- CourseRegistration: student + course offering workflow.
- AttendanceSession, Assignment, InternalMark, Exam, OBE assessment/attainment records and timetable entries consume CourseOffering.

## Important architectural gaps found

1. CourseOffering previously accepted only course/semester/section and therefore did not make the complete context explicit at its API boundary.
2. Frontend academic administration still loads broad lookup lists and performs part of dependency filtering client-side.
3. Course, Program, Semester and Section integrity is primarily enforced in services, not through a single reusable context resolver.
4. Faculty eligibility was previously only institution + FACULTY-role based for offering creation; department eligibility needs to be part of the same context check.
5. Several downstream models store only institutionId + a local foreign key. Their academic context is therefore derived through the parent relationship and must never be accepted from client-supplied parallel IDs.
6. FeeStructure already supports academicYear/program/semester, while invoices can retain academic year/semester and derive the student's program/department from canonical enrollment.
7. Library fines are already linked to FeeInvoice; this should remain the single financial liability path.
8. OBE is already offering/course/program based and should continue consuming the same course universe.
9. Student roster logic already resolves active enrollment + approved course registration through CourseOffering.
10. HOD/Director scope infrastructure already exists through DepartmentAccess and CampusAccess; the canonical hierarchy must sit underneath that existing RBAC rather than introducing a new permission system.

## Implemented on this branch

### Canonical context resolver

Added backend/src/services/academicContext.service.ts.

It provides:

- complete academic context resolution;
- tenant ownership checks;
- Department -> Program validation;
- Program -> Semester validation;
- AcademicYear -> Semester validation;
- Semester -> Section validation;
- Course -> Department validation;
- Faculty -> institution/role validation;
- Faculty -> department eligibility validation;
- server-side authorized department filtering;
- dependent academic option retrieval.

### Canonical options API

Added GET /api/v1/academic-context/options.

This is mounted from backend/src/app.ts.

It is intended to replace broad browser-side lookup loading with server-filtered academic options.

### Course Offering API boundary

Course Offering creation now requires:

- departmentId
- programId
- academicYearId
- semesterId
- sectionId
- courseId

The service resolves and validates the complete context before creating the actual CourseOffering row. The contextual IDs are not duplicated into CourseOffering because its existing semester/section/course relationships are authoritative.

This preserves the existing data model while making the API contract explicit.

## What should NOT be introduced

- AcademicStructureV2
- CourseOfferingV2
- duplicate Enrollment model
- duplicate Faculty model
- global semester universe
- client-authoritative institutionId
- client-authoritative department scope
- UUID-entry workflows for normal administrators

## Module dependency matrix

| Module | Canonical source |
|---|---|
| Students | StudentEnrollment |
| Admissions | Program + AcademicYear, then Enrollment |
| Enrollment | Program + AcademicYear + Semester + Section |
| Course | Department-owned Course |
| Curriculum | Program + Course |
| Course Offering | Course + Semester + Section + Faculty |
| Faculty Assignment | CourseOffering |
| Timetable | CourseOffering |
| Attendance | CourseOffering + eligible roster |
| Assignments | CourseOffering |
| Internal Assessment | CourseOffering |
| Examination | CourseOffering + eligible students |
| Admit Cards | Examination + CourseOffering + registration |
| Results | Exam + CourseOffering + Student |
| Fees | StudentEnrollment + FeeStructure |
| Library | Student/User + StudentEnrollment; financial fines -> FeeInvoice |
| OBE | Program + Course + CourseOffering |
| Placement | Student + StudentEnrollment |
| Reports | Canonical context filters |
| Dashboards | Role-scoped canonical queries |
| Imports | Human-readable references resolved to canonical IDs |
| Exports | Server-side canonical scope |

## Remaining migration work

The branch is intentionally not merged into production yet. The remaining work is propagation:

1. Refactor every academic lookup UI to use /academic-context/options.
2. Make Course Offering UI explicitly select Academic Year -> Department -> Program -> Semester -> Section -> Course -> Faculty.
3. Route enrollment validation through the shared resolver.
4. Route registration eligibility through enrollment + offering context.
5. Apply the resolver/scope pattern to admission, fee, exam, timetable, OBE and report entry points.
6. Add safe database-level tenant/context constraints only after inspecting live data for violations.
7. Add reconciliation/backfill reporting before any non-null constraint migration.
8. Add automated cross-department, cross-institution and stale-selection tests.
9. Run backend typecheck/tests and a full Vercel build before production merge.

## Production safety

No database reset/drop was performed. No production branch was modified by this redesign. Work is isolated on the dedicated architecture branch so the current production deployment budget is not consumed by speculative architecture changes.

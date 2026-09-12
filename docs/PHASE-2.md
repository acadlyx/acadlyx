# Phase 2 — Academic Structure

## Scope
The academic domain model and its REST APIs: Department, Program,
AcademicYear, Semester, Section, Course, CourseOffering, plus the
(schema-only, not yet exposed via API) Campus model.

## Hierarchy implemented
```
Institution → Department → Program → Semester (Program × AcademicYear)
            → Section (within a Semester)
Course (owned by a Department, not tied to a semester)
CourseOffering = Course × Semester × Section (+ optional faculty User)
```
- A **Course** is a catalog entry (e.g. "CS301 — Database Management
  Systems"), independent of when it's taught.
- A **CourseOffering** is the concrete scheduling of that course into
  one Semester+Section, optionally assigned to a faculty `User`. The
  same course taught across multiple semesters produces multiple
  `CourseOffering` rows — nothing is overwritten.
- There is no separate Faculty model — a faculty member is a `User`
  holding the `FACULTY` role (Phase 1 RBAC). `CourseOffering.facultyId`
  references `User` directly, and one faculty user can appear on any
  number of `CourseOffering` rows (teaching multiple courses/sections).
- **Academic history** is preserved by never deleting `AcademicYear`
  or `Semester` rows — they're only marked inactive/not-current.
  Every academic model has `isActive` (or, for `AcademicYear`,
  `isCurrent`) instead of a hard delete.

## What's intentionally NOT here
- A `Campus` **model** exists (institutions can optionally attach a
  `Department` to a `Campus`), but no `/campuses` REST API — not in
  this phase's requested endpoint list.
- No `Student` model and no student-to-program/section enrollment
  table yet. That arrives with the Student model in Phase 3 so it
  isn't half-built here — building it now would mean guessing at
  fields the student portal phase should actually decide.
- No `/institutions` CRUD API (institution management is a SUPER_ADMIN
  concern for a later phase).

## Endpoints
All are institution-scoped, authenticated, and permission-checked.
Standard shape: `GET /` (paginated + filterable), `GET /:id`,
`POST /`, `PATCH /:id`, `DELETE /:id` (soft-delete via `isActive`,
except `academic-years` which has no delete — years are never
retired, only superseded as "current").

| Resource | Base path | Permission prefix |
|---|---|---|
| Departments | `/api/v1/departments` | `departments.*` |
| Programs | `/api/v1/programs` | `programs.*` |
| Academic Years | `/api/v1/academic-years` | `academic-years.*` (no `.delete`) |
| Semesters | `/api/v1/semesters` | `semesters.*` |
| Sections | `/api/v1/sections` | `sections.*` |
| Courses | `/api/v1/courses` | `courses.*` |
| Course Offerings | `/api/v1/course-offerings` | `course-offerings.*` |

List endpoints accept `page`, `pageSize` (max 100), `search` (name/code,
case-insensitive), `isActive`, and resource-specific filters
(`departmentId`, `programId`, `academicYearId`, `semesterId`,
`courseId`, `sectionId`, `facultyId` where relevant).

## Validation beyond shape
Every create/update cross-checks foreign keys against the caller's
institution (e.g. a `departmentId` from another institution is
rejected with 400, not silently accepted) — this is on top of Zod's
shape validation, since Zod alone can't know what belongs to which
tenant. `CourseOffering` additionally verifies the given `sectionId`
actually belongs to the given `semesterId`, and that `facultyId` (if
provided) is an active user of the same institution holding the
`FACULTY` role.

## Permissions added
`departments.*`, `programs.*`, `academic-years.read/create/update`,
`semesters.*`, `sections.*`, `courses.*`, `course-offerings.*`
(`.read/.create/.update/.delete` each unless noted). Read access is
granted broadly (management, HOD, faculty, staff, student, parent);
write access is limited to `SUPER_ADMIN`/`INSTITUTION_ADMIN`, with
`HOD` additionally able to update `sections` and `course-offerings`
(e.g. reassigning faculty) — a coarse approximation of "HOD manages
their department's offerings" until Phase 2+ adds department-level
scoping to RBAC.

## Demo data
Seeded for AIMT: CSE and ECE departments; a B.Tech CSE program;
academic year 2025-2026 (marked current); CSE Semester 3 with Sections
A and B; three CSE courses (DBMS, OS, Computer Networks); two course
offerings (DBMS and OS, Semester 3 / Section A) assigned to the
existing demo faculty user. Re-running `npm run prisma:seed` is safe —
every row is upserted.

## Decisions that affect future phases
- Every academic table carries its own `institutionId` column
  (denormalized, not just reachable via joins) so tenant-scoped
  queries are a flat `WHERE institutionId = ...` — this is the same
  pattern Phase 3+ should follow for `Student`/`StudentEnrollment`.
- `requireInstitution()` (`src/utils/requireInstitution.ts`) is a new
  shared helper — new controllers should use it instead of
  redefining the same institution guard locally (the three Phase 1/2a
  controllers that predate it keep their local copies untouched).
- Route/permission naming uses the URL's kebab-case segment
  (`academic-years.read`, `course-offerings.create`, etc.) — keep
  that convention for any new resource.

# Phase 5 — Core Academic Operations

## Scope
Three feature sets, all real and database-backed: Attendance
(completing what Phase 4 started), Assignments (new, end-to-end),
and Internal Marks (new). This phase also replaces most of the Phase
3/4 dashboard demo data with real computations now that the
underlying modules exist.

## New models
- `Assignment` — belongs to a `CourseOffering`. `DRAFT` until a
  faculty member publishes it; only `PUBLISHED` assignments are
  visible to students.
- `AssignmentSubmission` — one row per (assignment, student), unique.
  Resubmitting **updates** the same row (and clears any prior
  review) rather than stacking history.
- `InternalMark` — one row per (courseOffering, student, component).
  Multiple components ("Internal 1", "Quiz 2", ...) accumulate as
  separate rows, so a course's full internal-assessment history is
  preserved rather than overwritten.

## Attendance — completing Phase 4
Phase 4 already built session creation, marking, bulk "Present All",
individual correction, and duplicate-session prevention
(`@@unique([courseOfferingId, sessionDate])` + get-or-create). This
phase adds:
- **Dynamic calculation** — `attendanceStatsService.getStudentAttendanceSummary()`
  computes overall and per-subject percentages live from
  `AttendanceRecord` rows; nothing is stored or cached.
- `GET /api/v1/students/me/attendance` — a student's own overall +
  subject-wise attendance.
- Faculty's existing `GET /api/v1/attendance-sessions` (list,
  filterable by course/date range) already serves as attendance
  history — no new endpoint needed there.

## Assignments (new)
| Method | Path | Permission | Who / What |
|---|---|---|---|
| GET | `/api/v1/assignments` | `assignments.read` | Role-scoped: admins see all, faculty see their own (any status), students see only `PUBLISHED` ones in their enrolled section(s) |
| GET | `/api/v1/assignments/:id` | `assignments.read` | Same scoping; students also get their own `mySubmission` attached |
| POST | `/api/v1/assignments` | `assignments.create` | Faculty (own course offerings only) / admin |
| PATCH | `/api/v1/assignments/:id` | `assignments.update` | Edit fields **and** publish/unpublish (`status` in the body) |
| GET | `/api/v1/assignments/:id/submissions` | `assignments.review` | Full section roster joined with each student's submission (or `null` — "hasn't submitted" is visible, not silently absent) |
| POST | `/api/v1/assignments/:id/submit` | `assignments.submit` | Student's own submission; auto-flags `LATE` if past `dueDate`; enrollment-in-section is checked |
| PATCH | `/api/v1/assignments/:id/submissions/:studentId` | `assignments.review` | Faculty grades: `marksAwarded` (validated ≤ `maxMarks`) + optional `feedback`, sets status `REVIEWED` |

New permissions added to the Phase 1 catalog: `assignments.update`,
`assignments.submit` (granted to `FACULTY`/`STUDENT` respectively;
`assignments.create`/`.review` already existed).

## Internal Marks (new)
| Method | Path | Permission | Notes |
|---|---|---|---|
| POST | `/api/v1/internal-marks` | `marks.enter` | Bulk upsert (same "send only what changed" shape as attendance records and this phase's marking patterns); every `studentId` checked against the real section roster, every mark checked against the component's own `maxMarks` |
| GET | `/api/v1/internal-marks` | `marks.read` | Filterable by `courseOfferingId`/`studentId`/`component`, paginated |
| GET | `/api/v1/students/me/marks` | none beyond auth | Self-service: a student's own marks across every course |
| GET | `/api/v1/course-offerings/:id/roster` | `students.read` | New: real section roster for bulk-entry screens (used by the marks UI; ownership-gated the same way as everything else) |

## Authorization — consistent with Phase 4
Every write in this phase reuses the same two-layer check Phase 4
established: an RBAC permission (`assignments.create`, `marks.enter`,
...) says a role *can* act; a separate ownership check
(`assertOwnsCourseOffering`, now extracted to
`src/utils/courseOfferingAccess.ts` as the shared version — the
original copy in `attendanceSession.service.ts` was left as-is,
working code) confirms *this* faculty member is actually assigned to
*this* course offering, or is an institution/platform admin. This is
what "prevent unauthorized faculty from modifying another faculty's
course data" means concretely in this codebase.

## What replaced demo data this phase
| Dashboard field | Was | Now |
|---|---|---|
| Student: `attendancePercentage`, `academicHealth.attendance` | demo (82%) | real, dynamic |
| Student: `assignments` list, `academicHealth.assignments` | demo | real (published assignments in-section + own submission status; completion % of them) |
| Student: `academicHealth.internalMarks` | demo (74) | real average across entered marks |
| Faculty: `pending.assignmentsToReview` | demo | real count of `SUBMITTED`/`LATE` submissions awaiting review |
| Faculty: `smartInsights.assignmentSubmissionGaps` | demo | real per-assignment roster-minus-submitted gap |

Still demo (no real module yet, isolated in the two `demo/*.ts`
files): class **scheduling** (time/room — no Timetable, Phase 7),
Announcements, Upcoming Events, and `academicHealth.engagement` (no
real proxy identified yet).

## Validation & tenant isolation
Same conventions as every prior phase: Zod schemas validate request
shape; services cross-check foreign keys against the caller's
institution; `institutionId` and the acting user always come from
the verified access token, never from the request body. Indexes were
added on every new model's foreign keys and the fields list/filter
endpoints query by (`status`, `dueDate`, `studentId`, etc.) — see
`schema.prisma`. All list endpoints (`/assignments`,
`/internal-marks`, `/attendance-sessions`) are paginated.

## How to test
```bash
cd backend
npm run prisma:migrate -- --name phase5_assignments_marks
npm run prisma:seed
npm run dev

cd frontend
npm run dev
```
- Student (`student@aimt.acadlyx.com`): `/student` → "Details" on
  Attendance, "View all" on Assignments → open "Assignment #4" and
  submit; "View full marks breakdown" for Internal Marks.
- Faculty (`faculty@aimt.acadlyx.com`): `/faculty` → "Assignments" in
  the header to create/publish one, or open the seeded "Assignment
  #3" to review the 3 existing submissions; "Marks" link next to any
  section in the Attendance card to bulk-enter internal marks.

## Decisions that affect future phases
- `courseOfferingAccess.ts` is now the shared ownership util —
  anything faculty-scoped from here on (Phase 6 lecture plans, Phase
  7 timetable entries, etc.) should use it rather than reimplementing
  the check.
- Assignment submissions are text-only (`content: String?`); file
  upload needs Cloudinary/S3 wiring, deliberately deferred rather
  than half-built.
- `getCourseOfferingRoster` (via `/course-offerings/:id/roster`) is a
  reusable building block — any future bulk-entry screen (HOD
  overrides, fee status, etc.) can reuse it instead of re-querying
  `StudentEnrollment` directly.

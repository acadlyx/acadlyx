# Phase 4 — Faculty Portal

## Scope
A faculty dashboard built to save time, not just expose CRUD, plus a
real one-click attendance marking flow. This phase pulls the *marking
mechanics* of attendance forward from the original Phase 5 slot —
building a fake "submit attendance" button with nowhere real for it to
go would have contradicted "all data must come from APIs/database."
Phase 5 remains where attendance **reporting/analytics** (student-facing
history, HOD/management rollups, trend charts) gets built.

## New models
- `AttendanceSession` — one row per (CourseOffering, date). Get-or-create
  semantics: opening the same section's attendance for the same day
  twice returns the same session, never a duplicate.
- `AttendanceRecord` — one row per (session, student), status
  `PRESENT | ABSENT | LATE`. Upsert, not insert-only — correcting a
  mark after submission is a normal write, not a special case.

## Backend

### Ownership vs. permission — two different checks
`attendance.mark` (RBAC) says a role *can* mark attendance somewhere.
It doesn't say *where*. `assertCanManageOffering()` in
`attendanceSession.service.ts` enforces the second half: a `FACULTY`
user may only open/mark sessions for course offerings where
`CourseOffering.facultyId` is their own id; `INSTITUTION_ADMIN`/
`SUPER_ADMIN` may manage any session in the institution (e.g. covering
for an absent colleague). Every attendance endpoint checks both.

### Endpoints
| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/api/v1/faculty/me/course-offerings` | `course-offerings.read` | Real assigned courses/sections |
| GET | `/api/v1/faculty/me/dashboard` | `attendance.read` | Full dashboard (see below) |
| POST | `/api/v1/attendance-sessions` | `attendance.mark` | Get-or-create a session + roster |
| GET | `/api/v1/attendance-sessions/:id` | `attendance.read` | Session + roster + current marks |
| PATCH | `/api/v1/attendance-sessions/:id/records` | `attendance.mark` | Bulk **and** single-student upsert; `submit: true` finalizes |
| GET | `/api/v1/attendance-sessions` | `attendance.read` | Filterable list (reused by later phases) |

`PATCH .../records` is deliberately one endpoint for both "Present
All" and individual correction — the client just sends however many
`{studentId, status}` pairs changed. Every `studentId` is checked
against the section's real roster (`StudentEnrollment`), so a request
can't mark attendance for a student who isn't enrolled in that
section.

### Real data vs. demo data
| Field | Source |
|---|---|
| Assigned courses/sections, attendance sessions, roster, records, per-section present/roster counts | **Real** |
| "Students below 75% attendance" | **Real** — live aggregation over actual `AttendanceRecord` rows, a plain threshold rule (not AI) |
| `todaysClasses` | **Hybrid** — course/section are real; the time slot is a placeholder (`isDemoSchedule: true`) pending Phase 7 Timetable |
| "Assignments to review", "lecture plans pending", "haven't submitted Assignment #3" | **Demo** — no Assignments/Lecture-Plan module yet (Phase 6) |

All demo content is isolated in
`backend/src/services/demo/facultyDashboard.demo.ts` — same rule as
Phase 3's `studentDashboard.demo.ts`. Nothing is hard-coded in a
controller or a frontend component.

### Tenant isolation & self-service
Same pattern as every prior phase: `institutionId` comes from
`req.user.institutionId`; `/faculty/me/*` is always scoped to
`req.user.id` inside the service layer regardless of what the
caller's RBAC permissions would otherwise allow to be listed broadly.

## Frontend
- `src/app/faculty/page.tsx` — dashboard: today's classes, per-section
  attendance overview (each row links straight into that section's
  marking sheet), pending items, smart insights, at-risk student list.
- `src/app/faculty/attendance/[courseOfferingId]/page.tsx` — opens
  (or resumes) today's session for that course offering and renders
  the marking sheet.
- `src/components/faculty/AttendanceMarkingSheet.tsx` — the one-click
  checklist: checkbox per student, **Present All** bulk action,
  per-row click for individual correction. It's presentational/
  controlled — the page owns the `statuses` state so it can validate
  and call the submit API.
- **Validation rule:** on final "Submit Attendance", any student left
  unmarked is recorded absent (attendance defaults to
  "absent-unless-marked-present") — shown to the faculty member as an
  explicit unmarked count before they submit, not a silent default.
  "Save Draft" instead persists exactly what's currently marked
  without that fill-in, so a partial pass can be resumed later.
- Reused from Phase 3 without modification: `DashboardCard`,
  `StatusBadge`, `SectionHeader`, `ClassSchedule`, `AnnouncementList`
  (for the at-risk student list — same `{id, title, meta}` shape).

## Database changes
New tables: `attendance_sessions`, `attendance_records`. Needs a new
migration. Seed additions:
- Six more demo students (Rahul, Priya, Aman, Ayush, Neha, Kabir —
  matching the names in this phase's mockup) enrolled in Section A,
  so the marking sheet has a real roster instead of one student.
- One historical, already-submitted `AttendanceSession` for DBMS /
  Section A (3 days ago) with two students marked absent, so "below
  75% attendance" has real data to compute against on a fresh seed.
  Today's sessions are intentionally left unopened so you can test
  the one-click flow from scratch.

## How to test
```bash
cd backend
npm run prisma:migrate -- --name phase4_attendance
npm run prisma:seed
npm run dev

cd frontend
npm run dev
```
Log in as `faculty@aimt.acadlyx.com` (your `SEED_DEMO_PASSWORD`) at
`/login` — you're not redirected anywhere automatically after login
yet (that's still `/student` from Phase 3); navigate to
**http://localhost:3000/faculty** directly. From there, click "Take
attendance" on any section to open the marking sheet, try **Present
All**, uncheck a student (individual correction), **Save Draft**, then
**Submit Attendance**.

API-only check:
```bash
curl -X POST http://localhost:5000/api/v1/attendance-sessions \
  -H "Authorization: Bearer <facultyAccessToken>" -H "Content-Type: application/json" \
  -d '{"courseOfferingId":"<dbmsOfferingId>","sessionDate":"2026-09-11"}'

curl -X PATCH http://localhost:5000/api/v1/attendance-sessions/<sessionId>/records \
  -H "Authorization: Bearer <facultyAccessToken>" -H "Content-Type: application/json" \
  -d '{"records":[{"studentId":"<id>","status":"PRESENT"}],"submit":true}'
```

## Decisions that affect future phases
- Attendance marking (the write path) now lives in
  `attendanceSession.service.ts` — Phase 5 should build reporting
  **on top of** these tables, not introduce a second attendance model.
- Ownership-beyond-permission (`assertCanManageOffering`) is a pattern
  worth reusing anywhere else "my own assignment" matters more than
  a blanket RBAC grant (e.g. HOD editing only their department later).
- No cross-portal navigation exists yet (login doesn't route by role
  to `/student` vs `/faculty`) — worth solving once more than one
  portal needs it, rather than guessing the right rule now.

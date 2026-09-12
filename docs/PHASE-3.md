# Phase 3 — Student Portal

## Scope
The first end-to-end feature: a student logs in and sees a real,
data-backed dashboard. This is also the first phase where the
frontend talks to authenticated APIs, so it's where the Phase 1
question ("where do tokens live?") gets answered.

## Backend

### New model
`StudentEnrollment` — links a `User` (holding the `STUDENT` role) to a
`Program` for a given `AcademicYear`, optionally a `Section`. One row
per student per academic year; re-enrolling creates a **new** row
instead of overwriting the old one, so which program/section/year a
student was in during a past year is never lost. A full "Student"
profile model (photo, guardian info, admission details, etc.) is
intentionally still out of scope — this only carries what the portal
needs.

### Endpoints (self-service only — see below)
| Method | Path | Returns |
|---|---|---|
| GET | `/api/v1/students/me` | Real profile + current enrollment |
| GET | `/api/v1/students/me/dashboard` | Full dashboard payload (see below) |

Both require only `authenticate` — no `authorize(...)` permission
check. Rationale: these endpoints only ever return the caller's own
data (`req.user.id`), so there's no data-leak risk from omitting a
permission gate, and gating "view your own dashboard" behind a
grantable permission would be backwards (every student must always be
able to see their own portal). Admin-facing student management
(listing/creating students across an institution) is a different,
later concern and would use the `students.read/create/update`
permissions already reserved in the Phase 1 catalog.

### Real data vs. demo data — the actual point of this phase
`GET /students/me/dashboard` is intentionally a blend, and the blend
is structured, not accidental:

| Field | Source |
|---|---|
| `student`, `program`, `academicYear`, `section` | **Real** — `StudentEnrollment` + Phase 2 tables |
| `courseOfferings` (course code/name/credits, faculty name) | **Real** — Phase 2 `CourseOffering` for the student's section |
| `institution` (name, logoUrl, colors) | **Real** — `Institution` row, configurable, never hard-coded |
| `attendancePercentage`, `academicHealth`, `academicRisk`, `recommendations` | **Demo** — no Attendance/Marks/Intelligence module yet (Phases 5, 12) |
| `todaysClasses` | **Hybrid** — course code/name are real (from the student's real course offerings); time slot and room are placeholders (`isDemoSchedule: true`) because there's no Timetable model yet (Phase 7) |
| `assignments` | **Demo**, but reuses real course codes so it doesn't invent courses the student isn't in (Phase 6) |
| `announcements`, `upcomingEvents` | **Demo** — no Announcements/Placements module yet (Phases 7, 11) |

All demo data lives in exactly one file:
`backend/src/services/demo/studentDashboard.demo.ts`. No controller
or frontend component hard-codes a placeholder value — when a real
module ships, only that file's function bodies change; every
consumer's shape stays identical.

`academicRisk`/`recommendations` are simple threshold rules over the
demo health numbers — explicitly labeled as such in code comments, per
the standing rule: transparent rule-based logic now, never presented
as AI, replaceable by a real intelligence service in Phase 12 without
changing what callers receive.

### Tenant isolation
Identical pattern to every prior phase: `institutionId` comes from
`req.user.institutionId` (the verified token), never from the client.
`getMyProfile`/`getCurrentEnrollment` additionally scope by
`req.user.id`, so this endpoint can only ever return the caller's own
records — there's no `:id` param to tamper with.

## Frontend

### Auth (new — first frontend phase that needs it)
- `src/lib/auth.ts` — login/logout, token storage, and `authedFetch`
  (attaches the access token, retries once through a silent refresh
  on a 401, then throws `AuthRequiredError`).
- **Decision:** tokens are stored in `localStorage` for this MVP —
  simplest thing that makes the portal testable end-to-end. This is a
  known, explicit trade-off, not a final answer: an httpOnly cookie is
  the production-appropriate home for the refresh token, revisit in
  Phase 14.
- `src/app/login/page.tsx` — minimal login form, pre-filled with the
  demo student email for convenience.

### Student dashboard
- `src/app/student/page.tsx` — client component; redirects to
  `/login` if unauthenticated, fetches `/students/me/dashboard`, and
  renders the componentized layout below. Loading/error states are
  explicit, not silently blank.
- `src/lib/studentApi.ts` — typed wrapper around the dashboard call.
- `src/types/dashboard.ts` — TypeScript types mirroring the backend
  response exactly, so a backend field rename shows up as a type
  error here instead of a silent `undefined` in the UI.

### Components (all in `src/components/dashboard/`, all reusable/stateless)
`DashboardCard`, `ProgressCard`, `StatusBadge`, `SectionHeader`,
`ClassSchedule`, `AssignmentList`, `AnnouncementList`,
`RecommendationCard`. `AnnouncementList` is deliberately generic
(`{id, title, meta}[]`) and reused for both Announcements and
Upcoming — they're the same shape, so one component serves both
instead of two near-duplicates.

### Branding
`src/components/branding/InstitutionLogo.tsx` renders
`institution.logoUrl` when the API returns one (fetched from the
`Institution` row — configurable, not hard-coded), and falls back to
a monogram built from the institution's name when it's absent. The
seeded AIMT logo (the asset you supplied) is wired through
`Institution.logoUrl` in the seed script, not pasted into any
component.

## Database changes
- New model: `StudentEnrollment` (see above). Requires a new
  migration (`student_enrollments` table).
- Seed data: the demo student (`student@aimt.acadlyx.com`) is now
  enrolled — B.Tech CSE, 2025-2026, Semester 3, Section A,
  `AIMT-CSE-2023-001`. `Institution.logoUrl` is set to
  `/branding/aimt-logo.png`.

## How to test
```bash
# Backend
cd backend
npm run prisma:migrate -- --name phase3_student_enrollment
npm run prisma:seed
npm run dev

# Frontend (separate terminal)
cd frontend
npm run dev
```
Open **http://localhost:3000/login**, sign in as
`student@aimt.acadlyx.com` with your `SEED_DEMO_PASSWORD`, and you'll
land on **http://localhost:3000/student** with the full dashboard.

API-only check:
```bash
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"student@aimt.acadlyx.com","password":"ChangeMe123!"}'
# copy accessToken, then:
curl http://localhost:5000/api/v1/students/me/dashboard \
  -H "Authorization: Bearer <accessToken>"
```

## Decisions that affect future phases
- The real/demo split pattern (`services/demo/*.demo.ts`, combined by
  the controller, one response shape) is the template for Faculty
  (Phase 4), Attendance (Phase 5), and every dashboard after it —
  keep demo content in one clearly-named file per feature, never
  scattered into components.
- `authedFetch`/localStorage token storage is the frontend's auth
  baseline going forward — Faculty/HOD/Management portals should
  reuse `src/lib/auth.ts` rather than reimplementing login.
- `AnnouncementList`'s generic `{id, title, meta}` shape is worth
  reusing again before reaching for a new list component.

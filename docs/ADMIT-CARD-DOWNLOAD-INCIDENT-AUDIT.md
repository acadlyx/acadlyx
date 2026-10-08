# ACADLYX — Student Admit Card Download Incident Audit

Date: 2026-10-09
Branch: `production-upgrade-2026-09-20`

## Incident

Student clicks **Download PDF** on an already-issued admit card and receives an internal server error.

## Root cause found and fixed

The backend PDF generation query in `backend/src/services/examination.service.ts` joined `student_enrollments` using `se."studentId" = u."id"`. The canonical service and Prisma model identify the student enrollment relation as `userId` (for example, `studentEnrollment.findFirst({ where: { userId: studentId } })`). The raw SQL therefore referenced the wrong enrollment column and could trigger a PostgreSQL error during PDF generation.

The join is corrected to `se."userId" = u."id"` while retaining the institution and ACTIVE-enrollment predicates. The fix does not weaken authorization or tenant isolation.

Commit: `373551b5b841f4fd7fbda99ea7d606917d36b4eb`.

## Relevant download flow audited

- Student admit-card list: `GET /api/v1/examinations/students/:studentId/hall-tickets`
- PDF download: `GET /api/v1/examinations/sessions/:id/hall-ticket.pdf`
- Frontend calls the PDF endpoint through `authedBlobFetch`, which attaches the Bearer access token and retries after a successful token refresh.
- Backend requires authentication, `exams.read`, tenant scope, and student-view authorization before generating the PDF.
- The PDF response sets `application/pdf`, attachment filename, content length, and private/no-store cache control.
- Frontend rejects zero-byte or non-PDF responses instead of silently downloading an invalid file.

## Verification status

- [x] Inspected the student download UI and typed API client.
- [x] Inspected the PDF route, service query, enrollment relation usage, and PDF generator.
- [x] Fixed the incorrect raw SQL enrollment join.
- [ ] Backend build and automated tests on this exact commit: pending CI.
- [ ] Authenticated production download for a real student: not executed from the connected repository environment.
- [ ] Verify generated PDF opens and contains the expected student/session/schedule: pending runtime verification.

## Deployment and acceptance

This fix is in the **backend**, so it must be deployed with the backend service (Render in the current deployment setup). A frontend-only Vercel redeploy will not apply this SQL fix.

**Current posture: root cause identified and source fix committed; production runtime is not yet verified.** If the deployed backend still returns 500 after this commit is deployed, inspect the corresponding backend error log/request ID; do not suppress the error or bypass student/tenant authorization.

-- Supports tenant-scoped active-enrollment lookups used by student portal,
-- roster and profile requests without scanning a tenant's enrollment history.
CREATE INDEX "student_enrollments_institutionId_userId_status_idx"
ON "student_enrollments"("institutionId", "userId", "status");

-- Supports submitted-attendance reporting and student attendance joins while
-- preserving the existing per-session uniqueness constraint.
CREATE INDEX "attendance_sessions_institutionId_isSubmitted_idx"
ON "attendance_sessions"("institutionId", "isSubmitted");

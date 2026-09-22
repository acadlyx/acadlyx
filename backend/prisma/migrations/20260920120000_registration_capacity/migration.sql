-- Course registration: seat capacity, registration window and elective flag.
ALTER TABLE "course_offerings" ADD COLUMN IF NOT EXISTS "capacity" INTEGER;
ALTER TABLE "course_offerings" ADD COLUMN IF NOT EXISTS "registrationOpen" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "course_offerings" ADD COLUMN IF NOT EXISTS "isElective" BOOLEAN NOT NULL DEFAULT false;

-- Circulation and registration read paths are list-heavy; back them with indexes.
CREATE INDEX IF NOT EXISTS "library_issues_institutionId_dueDate_idx" ON "library_issues" ("institutionId", "dueDate");
CREATE INDEX IF NOT EXISTS "course_registrations_studentId_status_idx" ON "course_registrations" ("studentId", "status");
CREATE INDEX IF NOT EXISTS "calendar_events_institutionId_endDate_idx" ON "calendar_events" ("institutionId", "endDate");
CREATE INDEX IF NOT EXISTS "certificates_institutionId_certificateType_idx" ON "certificates" ("institutionId", "certificateType");
CREATE INDEX IF NOT EXISTS "student_movement_requests_institutionId_requestType_idx" ON "student_movement_requests" ("institutionId", "requestType");

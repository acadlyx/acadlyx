-- ACADLYX tenant hot-path indexes.
-- These target the most common scoped list, roster, dashboard and reporting
-- predicates. All are idempotent for safe deployment/recovery.

CREATE INDEX IF NOT EXISTS "student_enrollments_institution_year_section_status_idx"
  ON "student_enrollments" ("institutionId", "academicYearId", "sectionId", "status");

CREATE INDEX IF NOT EXISTS "course_offerings_institution_semester_section_active_idx"
  ON "course_offerings" ("institutionId", "semesterId", "sectionId", "isActive");

CREATE INDEX IF NOT EXISTS "course_offerings_institution_faculty_semester_active_idx"
  ON "course_offerings" ("institutionId", "facultyId", "semesterId", "isActive");

CREATE INDEX IF NOT EXISTS "attendance_sessions_institution_offering_date_idx"
  ON "attendance_sessions" ("institutionId", "courseOfferingId", "sessionDate");

CREATE INDEX IF NOT EXISTS "assignments_institution_offering_status_due_idx"
  ON "assignments" ("institutionId", "courseOfferingId", "status", "dueDate");

CREATE INDEX IF NOT EXISTS "assignment_submissions_institution_student_status_submitted_idx"
  ON "assignment_submissions" ("institutionId", "studentId", "status", "submittedAt");

CREATE INDEX IF NOT EXISTS "internal_marks_institution_offering_student_idx"
  ON "internal_marks" ("institutionId", "courseOfferingId", "studentId");

CREATE INDEX IF NOT EXISTS "exams_institution_offering_date_idx"
  ON "exams" ("institutionId", "courseOfferingId", "examDate");

CREATE INDEX IF NOT EXISTS "notifications_institution_user_read_created_idx"
  ON "notifications" ("institutionId", "userId", "readAt", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "notices_institution_audience_published_idx"
  ON "notices" ("institutionId", "audience", "publishedAt" DESC);

CREATE INDEX IF NOT EXISTS "applications_institution_student_status_idx"
  ON "applications" ("institutionId", "studentId", "status");

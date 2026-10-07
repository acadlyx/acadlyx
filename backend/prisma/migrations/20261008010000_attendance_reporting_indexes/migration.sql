-- Reporting hot paths introduced by the production performance pass.
-- Keep these indexes limited to queries that aggregate attendance and
-- assignment-review state at institutional scale.

CREATE INDEX "attendance_records_session_status_idx"
  ON "attendance_records" ("attendanceSessionId", "status");

CREATE INDEX "attendance_records_student_session_idx"
  ON "attendance_records" ("studentId", "attendanceSessionId");

CREATE INDEX "assignment_submissions_assignment_status_idx"
  ON "assignment_submissions" ("assignmentId", "status");

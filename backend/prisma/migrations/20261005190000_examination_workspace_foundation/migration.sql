-- Examination workspace scope is stored with the examination session so one
-- examination can cover multiple campuses/departments/programmes/semesters.
ALTER TABLE "exam_sessions"
  ADD COLUMN IF NOT EXISTS "campusIds" JSONB,
  ADD COLUMN IF NOT EXISTS "departmentIds" JSONB,
  ADD COLUMN IF NOT EXISTS "programIds" JSONB,
  ADD COLUMN IF NOT EXISTS "semesterIds" JSONB,
  ADD COLUMN IF NOT EXISTS "sectionIds" JSONB,
  ADD COLUMN IF NOT EXISTS "studentGroupIds" JSONB;

CREATE INDEX IF NOT EXISTS "exam_sessions_institution_startDate_status_idx"
  ON "exam_sessions" ("institutionId", "startDate", "status");

CREATE INDEX IF NOT EXISTS "exam_schedules_institution_examDate_status_idx"
  ON "exam_schedules" ("institutionId", "examDate", "status");

CREATE INDEX IF NOT EXISTS "exam_schedules_session_examDate_time_idx"
  ON "exam_schedules" ("examSessionId", "examDate", "startTime");

CREATE INDEX IF NOT EXISTS "exam_seat_allocations_schedule_room_idx"
  ON "exam_seat_allocations" ("examScheduleId", "examRoomId");

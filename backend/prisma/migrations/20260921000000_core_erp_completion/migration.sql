-- ACADLYX — core ERP completion.
--
-- Examinations, attendance governance, LMS, fee lifecycle, institution
-- operations, SaaS plan catalogue and authentication hardening.
--
-- These tables follow the established convention introduced by the
-- fee_structures migration: they are owned by domain services that use
-- parameterized Prisma SQL, so existing Prisma models and their runtime
-- behaviour are untouched.
--
-- Every tenant-owned table carries "institutionId" with a cascading FK to
-- "institutions" so tenant isolation is enforceable in a single predicate.

-- ==========================================================
-- Shared updatedAt trigger
-- ==========================================================

CREATE OR REPLACE FUNCTION "acadlyx_set_updated_at"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


-- ==========================================================
-- 1. EXAMINATIONS
-- ==========================================================

CREATE TABLE "exam_sessions" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "academicYearId" TEXT,
  "semesterId" TEXT,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "examType" TEXT NOT NULL DEFAULT 'REGULAR',
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "hallTicketReleaseAt" TIMESTAMP(3),
  "resultPublishedAt" TIMESTAMP(3),
  "instructions" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "exam_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "exam_sessions_institutionId_fkey" FOREIGN KEY ("institutionId")
    REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "exam_sessions_academicYearId_fkey" FOREIGN KEY ("academicYearId")
    REFERENCES "academic_years"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "exam_sessions_semesterId_fkey" FOREIGN KEY ("semesterId")
    REFERENCES "semesters"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "exam_sessions_createdById_fkey" FOREIGN KEY ("createdById")
    REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "exam_sessions_dates_check" CHECK ("endDate" >= "startDate")
);

CREATE UNIQUE INDEX "exam_sessions_institutionId_code_key"
  ON "exam_sessions"("institutionId", "code");
CREATE INDEX "exam_sessions_institutionId_status_idx"
  ON "exam_sessions"("institutionId", "status");
CREATE INDEX "exam_sessions_institutionId_startDate_idx"
  ON "exam_sessions"("institutionId", "startDate");

CREATE TRIGGER "exam_sessions_updated_at_trigger"
BEFORE UPDATE ON "exam_sessions"
FOR EACH ROW EXECUTE FUNCTION "acadlyx_set_updated_at"();


CREATE TABLE "exam_rooms" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "campusId" TEXT,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "building" TEXT,
  "floor" TEXT,
  "capacity" INTEGER NOT NULL,
  "rowCount" INTEGER,
  "columnCount" INTEGER,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "exam_rooms_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "exam_rooms_institutionId_fkey" FOREIGN KEY ("institutionId")
    REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "exam_rooms_campusId_fkey" FOREIGN KEY ("campusId")
    REFERENCES "campuses"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "exam_rooms_capacity_check" CHECK ("capacity" > 0)
);

CREATE UNIQUE INDEX "exam_rooms_institutionId_code_key"
  ON "exam_rooms"("institutionId", "code");
CREATE INDEX "exam_rooms_institutionId_isActive_idx"
  ON "exam_rooms"("institutionId", "isActive");

CREATE TRIGGER "exam_rooms_updated_at_trigger"
BEFORE UPDATE ON "exam_rooms"
FOR EACH ROW EXECUTE FUNCTION "acadlyx_set_updated_at"();


CREATE TABLE "exam_schedules" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "examSessionId" TEXT NOT NULL,
  "courseOfferingId" TEXT NOT NULL,
  "examDate" TIMESTAMP(3) NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "maxMarks" DOUBLE PRECISION NOT NULL,
  "passMarks" DOUBLE PRECISION NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "marksLockedAt" TIMESTAMP(3),
  "marksLockedById" TEXT,
  "resultsPublishedAt" TIMESTAMP(3),
  "instructions" TEXT,
  -- Published results are mirrored into the existing Exam/ExamResult
  -- models so transcripts, grade sheets and SGPA/CGPA keep their single
  -- source of truth. This is that mirror row.
  "legacyExamId" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "exam_schedules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "exam_schedules_legacyExamId_fkey" FOREIGN KEY ("legacyExamId")
    REFERENCES "exams"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "exam_schedules_institutionId_fkey" FOREIGN KEY ("institutionId")
    REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "exam_schedules_examSessionId_fkey" FOREIGN KEY ("examSessionId")
    REFERENCES "exam_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "exam_schedules_courseOfferingId_fkey" FOREIGN KEY ("courseOfferingId")
    REFERENCES "course_offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "exam_schedules_createdById_fkey" FOREIGN KEY ("createdById")
    REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "exam_schedules_marks_check" CHECK ("maxMarks" > 0 AND "passMarks" >= 0 AND "passMarks" <= "maxMarks"),
  CONSTRAINT "exam_schedules_time_check" CHECK ("endTime" > "startTime")
);

CREATE UNIQUE INDEX "exam_schedules_session_offering_key"
  ON "exam_schedules"("examSessionId", "courseOfferingId");
CREATE INDEX "exam_schedules_institutionId_examDate_idx"
  ON "exam_schedules"("institutionId", "examDate");
CREATE INDEX "exam_schedules_institutionId_status_idx"
  ON "exam_schedules"("institutionId", "status");

CREATE TRIGGER "exam_schedules_updated_at_trigger"
BEFORE UPDATE ON "exam_schedules"
FOR EACH ROW EXECUTE FUNCTION "acadlyx_set_updated_at"();


CREATE TABLE "exam_seat_allocations" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "examScheduleId" TEXT NOT NULL,
  "examRoomId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "seatNumber" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "exam_seat_allocations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "exam_seat_allocations_institutionId_fkey" FOREIGN KEY ("institutionId")
    REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "exam_seat_allocations_examScheduleId_fkey" FOREIGN KEY ("examScheduleId")
    REFERENCES "exam_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "exam_seat_allocations_examRoomId_fkey" FOREIGN KEY ("examRoomId")
    REFERENCES "exam_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "exam_seat_allocations_studentId_fkey" FOREIGN KEY ("studentId")
    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "exam_seat_allocations_schedule_student_key"
  ON "exam_seat_allocations"("examScheduleId", "studentId");
CREATE UNIQUE INDEX "exam_seat_allocations_schedule_room_seat_key"
  ON "exam_seat_allocations"("examScheduleId", "examRoomId", "seatNumber");
CREATE INDEX "exam_seat_allocations_institutionId_studentId_idx"
  ON "exam_seat_allocations"("institutionId", "studentId");


CREATE TABLE "exam_invigilators" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "examScheduleId" TEXT NOT NULL,
  "examRoomId" TEXT NOT NULL,
  "facultyId" TEXT NOT NULL,
  "dutyRole" TEXT NOT NULL DEFAULT 'ASSISTANT',
  "assignedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "exam_invigilators_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "exam_invigilators_institutionId_fkey" FOREIGN KEY ("institutionId")
    REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "exam_invigilators_examScheduleId_fkey" FOREIGN KEY ("examScheduleId")
    REFERENCES "exam_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "exam_invigilators_examRoomId_fkey" FOREIGN KEY ("examRoomId")
    REFERENCES "exam_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "exam_invigilators_facultyId_fkey" FOREIGN KEY ("facultyId")
    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "exam_invigilators_assignedById_fkey" FOREIGN KEY ("assignedById")
    REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "exam_invigilators_schedule_room_faculty_key"
  ON "exam_invigilators"("examScheduleId", "examRoomId", "facultyId");
CREATE INDEX "exam_invigilators_institutionId_facultyId_idx"
  ON "exam_invigilators"("institutionId", "facultyId");


CREATE TABLE "hall_tickets" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "examSessionId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "serialNumber" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ISSUED',
  "blockedReason" TEXT,
  "issuedById" TEXT NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "hall_tickets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hall_tickets_institutionId_fkey" FOREIGN KEY ("institutionId")
    REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "hall_tickets_examSessionId_fkey" FOREIGN KEY ("examSessionId")
    REFERENCES "exam_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "hall_tickets_studentId_fkey" FOREIGN KEY ("studentId")
    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "hall_tickets_issuedById_fkey" FOREIGN KEY ("issuedById")
    REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "hall_tickets_session_student_key"
  ON "hall_tickets"("examSessionId", "studentId");
CREATE UNIQUE INDEX "hall_tickets_institutionId_serialNumber_key"
  ON "hall_tickets"("institutionId", "serialNumber");

CREATE TRIGGER "hall_tickets_updated_at_trigger"
BEFORE UPDATE ON "hall_tickets"
FOR EACH ROW EXECUTE FUNCTION "acadlyx_set_updated_at"();


CREATE TABLE "exam_attendances" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "examScheduleId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PRESENT',
  "bookletNumber" TEXT,
  "remarks" TEXT,
  "markedById" TEXT NOT NULL,
  "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "exam_attendances_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "exam_attendances_institutionId_fkey" FOREIGN KEY ("institutionId")
    REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "exam_attendances_examScheduleId_fkey" FOREIGN KEY ("examScheduleId")
    REFERENCES "exam_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "exam_attendances_studentId_fkey" FOREIGN KEY ("studentId")
    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "exam_attendances_markedById_fkey" FOREIGN KEY ("markedById")
    REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "exam_attendances_schedule_student_key"
  ON "exam_attendances"("examScheduleId", "studentId");
CREATE INDEX "exam_attendances_institutionId_status_idx"
  ON "exam_attendances"("institutionId", "status");

CREATE TRIGGER "exam_attendances_updated_at_trigger"
BEFORE UPDATE ON "exam_attendances"
FOR EACH ROW EXECUTE FUNCTION "acadlyx_set_updated_at"();


CREATE TABLE "exam_marks" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "examScheduleId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "marksObtained" DOUBLE PRECISION,
  "isAbsent" BOOLEAN NOT NULL DEFAULT FALSE,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "remarks" TEXT,
  "enteredById" TEXT NOT NULL,
  "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "exam_marks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "exam_marks_institutionId_fkey" FOREIGN KEY ("institutionId")
    REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "exam_marks_examScheduleId_fkey" FOREIGN KEY ("examScheduleId")
    REFERENCES "exam_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "exam_marks_studentId_fkey" FOREIGN KEY ("studentId")
    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "exam_marks_enteredById_fkey" FOREIGN KEY ("enteredById")
    REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "exam_marks_marks_check" CHECK ("marksObtained" IS NULL OR "marksObtained" >= 0)
);

CREATE UNIQUE INDEX "exam_marks_schedule_student_key"
  ON "exam_marks"("examScheduleId", "studentId");
CREATE INDEX "exam_marks_institutionId_studentId_idx"
  ON "exam_marks"("institutionId", "studentId");
CREATE INDEX "exam_marks_institutionId_status_idx"
  ON "exam_marks"("institutionId", "status");

CREATE TRIGGER "exam_marks_updated_at_trigger"
BEFORE UPDATE ON "exam_marks"
FOR EACH ROW EXECUTE FUNCTION "acadlyx_set_updated_at"();


CREATE TABLE "exam_mark_histories" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "examMarkId" TEXT NOT NULL,
  "previousMarks" DOUBLE PRECISION,
  "newMarks" DOUBLE PRECISION,
  "previousStatus" TEXT,
  "newStatus" TEXT NOT NULL,
  "reason" TEXT,
  "changedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "exam_mark_histories_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "exam_mark_histories_institutionId_fkey" FOREIGN KEY ("institutionId")
    REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "exam_mark_histories_examMarkId_fkey" FOREIGN KEY ("examMarkId")
    REFERENCES "exam_marks"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "exam_mark_histories_changedById_fkey" FOREIGN KEY ("changedById")
    REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "exam_mark_histories_examMarkId_idx"
  ON "exam_mark_histories"("examMarkId", "createdAt");


CREATE TABLE "revaluation_requests" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "examScheduleId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "feeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "feeInvoiceId" TEXT,
  "originalMarks" DOUBLE PRECISION,
  "revisedMarks" DOUBLE PRECISION,
  "decisionNote" TEXT,
  "reviewedById" TEXT,
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "revaluation_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "revaluation_requests_institutionId_fkey" FOREIGN KEY ("institutionId")
    REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "revaluation_requests_examScheduleId_fkey" FOREIGN KEY ("examScheduleId")
    REFERENCES "exam_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "revaluation_requests_studentId_fkey" FOREIGN KEY ("studentId")
    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "revaluation_requests_feeInvoiceId_fkey" FOREIGN KEY ("feeInvoiceId")
    REFERENCES "fee_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "revaluation_requests_schedule_student_key"
  ON "revaluation_requests"("examScheduleId", "studentId");
CREATE INDEX "revaluation_requests_institutionId_status_idx"
  ON "revaluation_requests"("institutionId", "status");

CREATE TRIGGER "revaluation_requests_updated_at_trigger"
BEFORE UPDATE ON "revaluation_requests"
FOR EACH ROW EXECUTE FUNCTION "acadlyx_set_updated_at"();


CREATE TABLE "exam_incidents" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "examScheduleId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'MINOR',
  "status" TEXT NOT NULL DEFAULT 'REPORTED',
  "actionTaken" TEXT,
  "reportedById" TEXT NOT NULL,
  "decidedById" TEXT,
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "exam_incidents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "exam_incidents_institutionId_fkey" FOREIGN KEY ("institutionId")
    REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "exam_incidents_examScheduleId_fkey" FOREIGN KEY ("examScheduleId")
    REFERENCES "exam_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "exam_incidents_studentId_fkey" FOREIGN KEY ("studentId")
    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "exam_incidents_reportedById_fkey" FOREIGN KEY ("reportedById")
    REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "exam_incidents_institutionId_status_idx"
  ON "exam_incidents"("institutionId", "status");
CREATE INDEX "exam_incidents_institutionId_studentId_idx"
  ON "exam_incidents"("institutionId", "studentId");

CREATE TRIGGER "exam_incidents_updated_at_trigger"
BEFORE UPDATE ON "exam_incidents"
FOR EACH ROW EXECUTE FUNCTION "acadlyx_set_updated_at"();


-- ==========================================================
-- 2. ATTENDANCE GOVERNANCE
-- ==========================================================

ALTER TABLE "attendance_sessions"
  ADD COLUMN IF NOT EXISTS "isLocked" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "lockedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lockedById" TEXT;

CREATE TABLE "attendance_policies" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "scope" TEXT NOT NULL DEFAULT 'INSTITUTION',
  "departmentId" TEXT,
  "programId" TEXT,
  "minPercentage" DOUBLE PRECISION NOT NULL DEFAULT 75,
  "warnPercentage" DOUBLE PRECISION NOT NULL DEFAULT 80,
  "condonationPercentage" DOUBLE PRECISION,
  "countExcusedAsPresent" BOOLEAN NOT NULL DEFAULT TRUE,
  "blockHallTicket" BOOLEAN NOT NULL DEFAULT TRUE,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "attendance_policies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "attendance_policies_institutionId_fkey" FOREIGN KEY ("institutionId")
    REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "attendance_policies_departmentId_fkey" FOREIGN KEY ("departmentId")
    REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "attendance_policies_programId_fkey" FOREIGN KEY ("programId")
    REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "attendance_policies_percentage_check"
    CHECK ("minPercentage" >= 0 AND "minPercentage" <= 100
      AND "warnPercentage" >= 0 AND "warnPercentage" <= 100)
);

CREATE INDEX "attendance_policies_institutionId_isActive_idx"
  ON "attendance_policies"("institutionId", "isActive");
CREATE UNIQUE INDEX "attendance_policies_institution_scope_key"
  ON "attendance_policies"(
    "institutionId",
    "scope",
    COALESCE("departmentId", ''),
    COALESCE("programId", '')
  );

CREATE TRIGGER "attendance_policies_updated_at_trigger"
BEFORE UPDATE ON "attendance_policies"
FOR EACH ROW EXECUTE FUNCTION "acadlyx_set_updated_at"();


CREATE TABLE "attendance_correction_requests" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "attendanceSessionId" TEXT NOT NULL,
  "attendanceRecordId" TEXT,
  "studentId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "currentStatus" TEXT,
  "requestedStatus" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "evidenceUrl" TEXT,
  "leaveRequestId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "decisionNote" TEXT,
  "decidedById" TEXT,
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "attendance_correction_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "attendance_correction_requests_institutionId_fkey" FOREIGN KEY ("institutionId")
    REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "attendance_correction_requests_sessionId_fkey" FOREIGN KEY ("attendanceSessionId")
    REFERENCES "attendance_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "attendance_correction_requests_recordId_fkey" FOREIGN KEY ("attendanceRecordId")
    REFERENCES "attendance_records"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "attendance_correction_requests_studentId_fkey" FOREIGN KEY ("studentId")
    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "attendance_correction_requests_requestedById_fkey" FOREIGN KEY ("requestedById")
    REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "attendance_correction_requests_leaveRequestId_fkey" FOREIGN KEY ("leaveRequestId")
    REFERENCES "leave_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "attendance_correction_requests_pending_key"
  ON "attendance_correction_requests"("attendanceSessionId", "studentId")
  WHERE "status" = 'PENDING';
CREATE INDEX "attendance_correction_requests_institutionId_status_idx"
  ON "attendance_correction_requests"("institutionId", "status");
CREATE INDEX "attendance_correction_requests_institutionId_studentId_idx"
  ON "attendance_correction_requests"("institutionId", "studentId");

CREATE TRIGGER "attendance_correction_requests_updated_at_trigger"
BEFORE UPDATE ON "attendance_correction_requests"
FOR EACH ROW EXECUTE FUNCTION "acadlyx_set_updated_at"();


CREATE TABLE "attendance_shortage_alerts" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "courseOfferingId" TEXT,
  "semesterId" TEXT,
  "percentage" DOUBLE PRECISION NOT NULL,
  "threshold" DOUBLE PRECISION NOT NULL,
  "level" TEXT NOT NULL DEFAULT 'WARNING',
  "acknowledgedAt" TIMESTAMP(3),
  "generatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "attendance_shortage_alerts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "attendance_shortage_alerts_institutionId_fkey" FOREIGN KEY ("institutionId")
    REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "attendance_shortage_alerts_studentId_fkey" FOREIGN KEY ("studentId")
    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "attendance_shortage_alerts_courseOfferingId_fkey" FOREIGN KEY ("courseOfferingId")
    REFERENCES "course_offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "attendance_shortage_alerts_institutionId_studentId_idx"
  ON "attendance_shortage_alerts"("institutionId", "studentId", "createdAt");
CREATE INDEX "attendance_shortage_alerts_institutionId_level_idx"
  ON "attendance_shortage_alerts"("institutionId", "level");


-- ==========================================================
-- 3. LMS
-- ==========================================================

CREATE TABLE "course_modules" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "courseOfferingId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "sequence" INTEGER NOT NULL DEFAULT 1,
  "isPublished" BOOLEAN NOT NULL DEFAULT FALSE,
  "availableFrom" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "course_modules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "course_modules_institutionId_fkey" FOREIGN KEY ("institutionId")
    REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "course_modules_courseOfferingId_fkey" FOREIGN KEY ("courseOfferingId")
    REFERENCES "course_offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "course_modules_createdById_fkey" FOREIGN KEY ("createdById")
    REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "course_modules_sequence_check" CHECK ("sequence" > 0)
);

CREATE INDEX "course_modules_courseOfferingId_sequence_idx"
  ON "course_modules"("courseOfferingId", "sequence");
CREATE INDEX "course_modules_institutionId_idx"
  ON "course_modules"("institutionId");

CREATE TRIGGER "course_modules_updated_at_trigger"
BEFORE UPDATE ON "course_modules"
FOR EACH ROW EXECUTE FUNCTION "acadlyx_set_updated_at"();


CREATE TABLE "course_lessons" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "courseModuleId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "content" TEXT,
  "contentType" TEXT NOT NULL DEFAULT 'TEXT',
  "sequence" INTEGER NOT NULL DEFAULT 1,
  "durationMinutes" INTEGER,
  "isPublished" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "course_lessons_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "course_lessons_institutionId_fkey" FOREIGN KEY ("institutionId")
    REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "course_lessons_courseModuleId_fkey" FOREIGN KEY ("courseModuleId")
    REFERENCES "course_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "course_lessons_createdById_fkey" FOREIGN KEY ("createdById")
    REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "course_lessons_sequence_check" CHECK ("sequence" > 0)
);

CREATE INDEX "course_lessons_courseModuleId_sequence_idx"
  ON "course_lessons"("courseModuleId", "sequence");
CREATE INDEX "course_lessons_institutionId_idx"
  ON "course_lessons"("institutionId");

CREATE TRIGGER "course_lessons_updated_at_trigger"
BEFORE UPDATE ON "course_lessons"
FOR EACH ROW EXECUTE FUNCTION "acadlyx_set_updated_at"();


CREATE TABLE "lesson_resources" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "courseLessonId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL DEFAULT 'LINK',
  "sizeKb" INTEGER,
  "uploadedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "lesson_resources_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lesson_resources_institutionId_fkey" FOREIGN KEY ("institutionId")
    REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "lesson_resources_courseLessonId_fkey" FOREIGN KEY ("courseLessonId")
    REFERENCES "course_lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "lesson_resources_uploadedById_fkey" FOREIGN KEY ("uploadedById")
    REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "lesson_resources_courseLessonId_idx"
  ON "lesson_resources"("courseLessonId");


CREATE TABLE "lesson_progresses" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "courseLessonId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  "completedAt" TIMESTAMP(3),
  "secondsSpent" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "lesson_progresses_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lesson_progresses_institutionId_fkey" FOREIGN KEY ("institutionId")
    REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "lesson_progresses_courseLessonId_fkey" FOREIGN KEY ("courseLessonId")
    REFERENCES "course_lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "lesson_progresses_studentId_fkey" FOREIGN KEY ("studentId")
    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "lesson_progresses_lesson_student_key"
  ON "lesson_progresses"("courseLessonId", "studentId");
CREATE INDEX "lesson_progresses_institutionId_studentId_idx"
  ON "lesson_progresses"("institutionId", "studentId");

CREATE TRIGGER "lesson_progresses_updated_at_trigger"
BEFORE UPDATE ON "lesson_progresses"
FOR EACH ROW EXECUTE FUNCTION "acadlyx_set_updated_at"();


CREATE TABLE "question_bank_items" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "courseId" TEXT,
  "courseOfferingId" TEXT,
  "questionType" TEXT NOT NULL DEFAULT 'SINGLE_CHOICE',
  "prompt" TEXT NOT NULL,
  "defaultMarks" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "difficulty" TEXT NOT NULL DEFAULT 'MEDIUM',
  "explanation" TEXT,
  "topic" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "question_bank_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "question_bank_items_institutionId_fkey" FOREIGN KEY ("institutionId")
    REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "question_bank_items_courseId_fkey" FOREIGN KEY ("courseId")
    REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "question_bank_items_courseOfferingId_fkey" FOREIGN KEY ("courseOfferingId")
    REFERENCES "course_offerings"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "question_bank_items_createdById_fkey" FOREIGN KEY ("createdById")
    REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "question_bank_items_marks_check" CHECK ("defaultMarks" > 0)
);

CREATE INDEX "question_bank_items_institutionId_courseId_idx"
  ON "question_bank_items"("institutionId", "courseId");
CREATE INDEX "question_bank_items_institutionId_isActive_idx"
  ON "question_bank_items"("institutionId", "isActive");

CREATE TRIGGER "question_bank_items_updated_at_trigger"
BEFORE UPDATE ON "question_bank_items"
FOR EACH ROW EXECUTE FUNCTION "acadlyx_set_updated_at"();


CREATE TABLE "question_options" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "questionBankItemId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "isCorrect" BOOLEAN NOT NULL DEFAULT FALSE,
  "sequence" INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT "question_options_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "question_options_institutionId_fkey" FOREIGN KEY ("institutionId")
    REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "question_options_questionBankItemId_fkey" FOREIGN KEY ("questionBankItemId")
    REFERENCES "question_bank_items"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "question_options_questionBankItemId_idx"
  ON "question_options"("questionBankItemId", "sequence");


CREATE TABLE "quizzes" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "courseOfferingId" TEXT NOT NULL,
  "courseModuleId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "totalMarks" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "passMarks" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "durationMinutes" INTEGER,
  "attemptsAllowed" INTEGER NOT NULL DEFAULT 1,
  "opensAt" TIMESTAMP(3),
  "closesAt" TIMESTAMP(3),
  "shuffleQuestions" BOOLEAN NOT NULL DEFAULT FALSE,
  "showResultsImmediately" BOOLEAN NOT NULL DEFAULT TRUE,
  "gradingMode" TEXT NOT NULL DEFAULT 'AUTO',
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "quizzes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "quizzes_institutionId_fkey" FOREIGN KEY ("institutionId")
    REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "quizzes_courseOfferingId_fkey" FOREIGN KEY ("courseOfferingId")
    REFERENCES "course_offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "quizzes_courseModuleId_fkey" FOREIGN KEY ("courseModuleId")
    REFERENCES "course_modules"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "quizzes_createdById_fkey" FOREIGN KEY ("createdById")
    REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "quizzes_attempts_check" CHECK ("attemptsAllowed" > 0),
  CONSTRAINT "quizzes_window_check" CHECK ("closesAt" IS NULL OR "opensAt" IS NULL OR "closesAt" > "opensAt")
);

CREATE INDEX "quizzes_institutionId_courseOfferingId_idx"
  ON "quizzes"("institutionId", "courseOfferingId");
CREATE INDEX "quizzes_institutionId_status_idx"
  ON "quizzes"("institutionId", "status");

CREATE TRIGGER "quizzes_updated_at_trigger"
BEFORE UPDATE ON "quizzes"
FOR EACH ROW EXECUTE FUNCTION "acadlyx_set_updated_at"();


CREATE TABLE "quiz_questions" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "quizId" TEXT NOT NULL,
  "questionBankItemId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL DEFAULT 1,
  "marks" DOUBLE PRECISION NOT NULL,

  CONSTRAINT "quiz_questions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "quiz_questions_institutionId_fkey" FOREIGN KEY ("institutionId")
    REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "quiz_questions_quizId_fkey" FOREIGN KEY ("quizId")
    REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "quiz_questions_questionBankItemId_fkey" FOREIGN KEY ("questionBankItemId")
    REFERENCES "question_bank_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "quiz_questions_marks_check" CHECK ("marks" > 0)
);

CREATE UNIQUE INDEX "quiz_questions_quiz_item_key"
  ON "quiz_questions"("quizId", "questionBankItemId");
CREATE INDEX "quiz_questions_quizId_sequence_idx"
  ON "quiz_questions"("quizId", "sequence");


CREATE TABLE "quiz_attempts" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "quizId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "attemptNumber" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submittedAt" TIMESTAMP(3),
  "score" DOUBLE PRECISION,
  "maxScore" DOUBLE PRECISION,
  "gradedById" TEXT,
  "gradedAt" TIMESTAMP(3),
  "feedback" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "quiz_attempts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "quiz_attempts_institutionId_fkey" FOREIGN KEY ("institutionId")
    REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "quiz_attempts_quizId_fkey" FOREIGN KEY ("quizId")
    REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "quiz_attempts_studentId_fkey" FOREIGN KEY ("studentId")
    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "quiz_attempts_attemptNumber_check" CHECK ("attemptNumber" > 0)
);

CREATE UNIQUE INDEX "quiz_attempts_quiz_student_attempt_key"
  ON "quiz_attempts"("quizId", "studentId", "attemptNumber");
CREATE INDEX "quiz_attempts_institutionId_studentId_idx"
  ON "quiz_attempts"("institutionId", "studentId");
CREATE INDEX "quiz_attempts_institutionId_status_idx"
  ON "quiz_attempts"("institutionId", "status");

CREATE TRIGGER "quiz_attempts_updated_at_trigger"
BEFORE UPDATE ON "quiz_attempts"
FOR EACH ROW EXECUTE FUNCTION "acadlyx_set_updated_at"();


CREATE TABLE "quiz_answers" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "quizAttemptId" TEXT NOT NULL,
  "questionBankItemId" TEXT NOT NULL,
  "selectedOptionIds" JSONB,
  "textAnswer" TEXT,
  "awardedMarks" DOUBLE PRECISION,
  "isCorrect" BOOLEAN,
  "requiresManualReview" BOOLEAN NOT NULL DEFAULT FALSE,
  "feedback" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "quiz_answers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "quiz_answers_institutionId_fkey" FOREIGN KEY ("institutionId")
    REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "quiz_answers_quizAttemptId_fkey" FOREIGN KEY ("quizAttemptId")
    REFERENCES "quiz_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "quiz_answers_questionBankItemId_fkey" FOREIGN KEY ("questionBankItemId")
    REFERENCES "question_bank_items"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "quiz_answers_attempt_question_key"
  ON "quiz_answers"("quizAttemptId", "questionBankItemId");

CREATE TRIGGER "quiz_answers_updated_at_trigger"
BEFORE UPDATE ON "quiz_answers"
FOR EACH ROW EXECUTE FUNCTION "acadlyx_set_updated_at"();


-- ==========================================================
-- 4. FEES — lifecycle
-- ==========================================================

ALTER TABLE "fee_invoices"
  ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "feeStructureId" TEXT,
  ADD COLUMN IF NOT EXISTS "academicYearId" TEXT,
  ADD COLUMN IF NOT EXISTS "semesterId" TEXT,
  ADD COLUMN IF NOT EXISTS "installmentNumber" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "grossAmount" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lateFeeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "refundedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS "notes" TEXT,
  ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "createdById" TEXT;

UPDATE "fee_invoices" SET "grossAmount" = "amount" WHERE "grossAmount" IS NULL;
UPDATE "fee_invoices" i
SET "paidAmount" = COALESCE((SELECT SUM(p."amount") FROM "fee_payments" p WHERE p."invoiceId" = i."id"), 0)
WHERE i."paidAmount" = 0;

CREATE UNIQUE INDEX IF NOT EXISTS "fee_invoices_institutionId_invoiceNumber_key"
  ON "fee_invoices"("institutionId", "invoiceNumber");
CREATE INDEX IF NOT EXISTS "fee_invoices_institutionId_dueDate_idx"
  ON "fee_invoices"("institutionId", "dueDate");

ALTER TABLE "fee_payments"
  ADD COLUMN IF NOT EXISTS "method" TEXT NOT NULL DEFAULT 'OFFLINE',
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'SUCCESS',
  ADD COLUMN IF NOT EXISTS "provider" TEXT,
  ADD COLUMN IF NOT EXISTS "providerOrderId" TEXT,
  ADD COLUMN IF NOT EXISTS "providerPaymentId" TEXT,
  ADD COLUMN IF NOT EXISTS "providerSignature" TEXT,
  ADD COLUMN IF NOT EXISTS "receiptNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "refundedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "reconciledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "recordedById" TEXT,
  ADD COLUMN IF NOT EXISTS "notes" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "fee_payments_institutionId_receiptNumber_key"
  ON "fee_payments"("institutionId", "receiptNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "fee_payments_provider_payment_key"
  ON "fee_payments"("provider", "providerPaymentId");
CREATE INDEX IF NOT EXISTS "fee_payments_institutionId_status_idx"
  ON "fee_payments"("institutionId", "status");


CREATE TABLE "fee_concessions" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "feeStructureId" TEXT,
  "academicYearId" TEXT,
  "name" TEXT NOT NULL,
  "concessionType" TEXT NOT NULL DEFAULT 'SCHOLARSHIP',
  "amount" DOUBLE PRECISION,
  "percentage" DOUBLE PRECISION,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "reason" TEXT,
  "requestedById" TEXT NOT NULL,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "fee_concessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "fee_concessions_institutionId_fkey" FOREIGN KEY ("institutionId")
    REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "fee_concessions_studentId_fkey" FOREIGN KEY ("studentId")
    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "fee_concessions_feeStructureId_fkey" FOREIGN KEY ("feeStructureId")
    REFERENCES "fee_structures"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "fee_concessions_academicYearId_fkey" FOREIGN KEY ("academicYearId")
    REFERENCES "academic_years"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "fee_concessions_value_check"
    CHECK (("amount" IS NOT NULL AND "amount" > 0) OR ("percentage" IS NOT NULL AND "percentage" > 0 AND "percentage" <= 100))
);

CREATE INDEX "fee_concessions_institutionId_studentId_idx"
  ON "fee_concessions"("institutionId", "studentId");
CREATE INDEX "fee_concessions_institutionId_status_idx"
  ON "fee_concessions"("institutionId", "status");

CREATE TRIGGER "fee_concessions_updated_at_trigger"
BEFORE UPDATE ON "fee_concessions"
FOR EACH ROW EXECUTE FUNCTION "acadlyx_set_updated_at"();


CREATE TABLE "late_fee_rules" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "graceDays" INTEGER NOT NULL DEFAULT 0,
  "chargeType" TEXT NOT NULL DEFAULT 'FLAT',
  "chargeValue" DOUBLE PRECISION NOT NULL,
  "perDay" BOOLEAN NOT NULL DEFAULT FALSE,
  "maxAmount" DOUBLE PRECISION,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "late_fee_rules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "late_fee_rules_institutionId_fkey" FOREIGN KEY ("institutionId")
    REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "late_fee_rules_value_check" CHECK ("chargeValue" >= 0 AND "graceDays" >= 0)
);

CREATE INDEX "late_fee_rules_institutionId_isActive_idx"
  ON "late_fee_rules"("institutionId", "isActive");

CREATE TRIGGER "late_fee_rules_updated_at_trigger"
BEFORE UPDATE ON "late_fee_rules"
FOR EACH ROW EXECUTE FUNCTION "acadlyx_set_updated_at"();


CREATE TABLE "fee_refunds" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "feePaymentId" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "reference" TEXT,
  "requestedById" TEXT NOT NULL,
  "approvedById" TEXT,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "fee_refunds_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "fee_refunds_institutionId_fkey" FOREIGN KEY ("institutionId")
    REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "fee_refunds_feePaymentId_fkey" FOREIGN KEY ("feePaymentId")
    REFERENCES "fee_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "fee_refunds_amount_check" CHECK ("amount" > 0)
);

CREATE INDEX "fee_refunds_institutionId_status_idx"
  ON "fee_refunds"("institutionId", "status");

CREATE TRIGGER "fee_refunds_updated_at_trigger"
BEFORE UPDATE ON "fee_refunds"
FOR EACH ROW EXECUTE FUNCTION "acadlyx_set_updated_at"();


CREATE TABLE "payment_reconciliations" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "statementReference" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "statementTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "systemTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "matchedCount" INTEGER NOT NULL DEFAULT 0,
  "unmatchedCount" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdById" TEXT NOT NULL,
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "payment_reconciliations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_reconciliations_institutionId_fkey" FOREIGN KEY ("institutionId")
    REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "payment_reconciliations_period_check" CHECK ("periodEnd" >= "periodStart")
);

CREATE UNIQUE INDEX "payment_reconciliations_institution_reference_key"
  ON "payment_reconciliations"("institutionId", "statementReference");

CREATE TRIGGER "payment_reconciliations_updated_at_trigger"
BEFORE UPDATE ON "payment_reconciliations"
FOR EACH ROW EXECUTE FUNCTION "acadlyx_set_updated_at"();


CREATE TABLE "payment_reconciliation_entries" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "reconciliationId" TEXT NOT NULL,
  "feePaymentId" TEXT,
  "externalReference" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "valueDate" TIMESTAMP(3),
  "matchStatus" TEXT NOT NULL DEFAULT 'UNMATCHED',
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "payment_reconciliation_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_reconciliation_entries_institutionId_fkey" FOREIGN KEY ("institutionId")
    REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "payment_reconciliation_entries_reconciliationId_fkey" FOREIGN KEY ("reconciliationId")
    REFERENCES "payment_reconciliations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "payment_reconciliation_entries_feePaymentId_fkey" FOREIGN KEY ("feePaymentId")
    REFERENCES "fee_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "payment_reconciliation_entries_reconciliationId_idx"
  ON "payment_reconciliation_entries"("reconciliationId", "matchStatus");


-- ==========================================================
-- 5. INSTITUTION OPERATIONS
-- ==========================================================

CREATE TABLE "asset_categories" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "asset_categories_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "asset_categories_institutionId_fkey" FOREIGN KEY ("institutionId")
    REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "asset_categories_institutionId_code_key"
  ON "asset_categories"("institutionId", "code");

CREATE TRIGGER "asset_categories_updated_at_trigger"
BEFORE UPDATE ON "asset_categories"
FOR EACH ROW EXECUTE FUNCTION "acadlyx_set_updated_at"();


CREATE TABLE "assets" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "assetCategoryId" TEXT,
  "campusId" TEXT,
  "departmentId" TEXT,
  "name" TEXT NOT NULL,
  "assetTag" TEXT NOT NULL,
  "serialNumber" TEXT,
  "location" TEXT,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unitCost" DOUBLE PRECISION,
  "purchaseDate" TIMESTAMP(3),
  "warrantyEndsAt" TIMESTAMP(3),
  "condition" TEXT NOT NULL DEFAULT 'GOOD',
  "status" TEXT NOT NULL DEFAULT 'IN_USE',
  "assignedToId" TEXT,
  "notes" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "assets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "assets_institutionId_fkey" FOREIGN KEY ("institutionId")
    REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "assets_assetCategoryId_fkey" FOREIGN KEY ("assetCategoryId")
    REFERENCES "asset_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "assets_campusId_fkey" FOREIGN KEY ("campusId")
    REFERENCES "campuses"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "assets_departmentId_fkey" FOREIGN KEY ("departmentId")
    REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "assets_assignedToId_fkey" FOREIGN KEY ("assignedToId")
    REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "assets_quantity_check" CHECK ("quantity" > 0)
);

CREATE UNIQUE INDEX "assets_institutionId_assetTag_key"
  ON "assets"("institutionId", "assetTag");
CREATE INDEX "assets_institutionId_status_idx"
  ON "assets"("institutionId", "status");
CREATE INDEX "assets_institutionId_departmentId_idx"
  ON "assets"("institutionId", "departmentId");

CREATE TRIGGER "assets_updated_at_trigger"
BEFORE UPDATE ON "assets"
FOR EACH ROW EXECUTE FUNCTION "acadlyx_set_updated_at"();


CREATE TABLE "facilities" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "campusId" TEXT,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "facilityType" TEXT NOT NULL DEFAULT 'CLASSROOM',
  "capacity" INTEGER,
  "location" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "facilities_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "facilities_institutionId_fkey" FOREIGN KEY ("institutionId")
    REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "facilities_campusId_fkey" FOREIGN KEY ("campusId")
    REFERENCES "campuses"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "facilities_institutionId_code_key"
  ON "facilities"("institutionId", "code");
CREATE INDEX "facilities_institutionId_isActive_idx"
  ON "facilities"("institutionId", "isActive");

CREATE TRIGGER "facilities_updated_at_trigger"
BEFORE UPDATE ON "facilities"
FOR EACH ROW EXECUTE FUNCTION "acadlyx_set_updated_at"();


CREATE TABLE "maintenance_requests" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "facilityId" TEXT,
  "assetId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "raisedById" TEXT NOT NULL,
  "assignedToId" TEXT,
  "resolutionNote" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "maintenance_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "maintenance_requests_institutionId_fkey" FOREIGN KEY ("institutionId")
    REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "maintenance_requests_facilityId_fkey" FOREIGN KEY ("facilityId")
    REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "maintenance_requests_assetId_fkey" FOREIGN KEY ("assetId")
    REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "maintenance_requests_raisedById_fkey" FOREIGN KEY ("raisedById")
    REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "maintenance_requests_assignedToId_fkey" FOREIGN KEY ("assignedToId")
    REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "maintenance_requests_target_check"
    CHECK ("facilityId" IS NOT NULL OR "assetId" IS NOT NULL)
);

CREATE INDEX "maintenance_requests_institutionId_status_idx"
  ON "maintenance_requests"("institutionId", "status", "priority");
CREATE INDEX "maintenance_requests_institutionId_assignedToId_idx"
  ON "maintenance_requests"("institutionId", "assignedToId");

CREATE TRIGGER "maintenance_requests_updated_at_trigger"
BEFORE UPDATE ON "maintenance_requests"
FOR EACH ROW EXECUTE FUNCTION "acadlyx_set_updated_at"();


-- ==========================================================
-- 6. SaaS — plan catalogue and tenant lifecycle
-- ==========================================================

CREATE TABLE "subscription_plans" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "monthlyPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "annualPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "trialDays" INTEGER NOT NULL DEFAULT 14,
  "studentLimit" INTEGER,
  "userLimit" INTEGER,
  "facultyLimit" INTEGER,
  "storageLimitMb" INTEGER,
  "features" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "subscription_plans_code_key" ON "subscription_plans"("code");

CREATE TRIGGER "subscription_plans_updated_at_trigger"
BEFORE UPDATE ON "subscription_plans"
FOR EACH ROW EXECUTE FUNCTION "acadlyx_set_updated_at"();


CREATE TABLE "tenant_lifecycle_events" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT,
  "planCode" TEXT,
  "reason" TEXT,
  "actorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "tenant_lifecycle_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tenant_lifecycle_events_institutionId_fkey" FOREIGN KEY ("institutionId")
    REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "tenant_lifecycle_events_institutionId_createdAt_idx"
  ON "tenant_lifecycle_events"("institutionId", "createdAt");

INSERT INTO "subscription_plans"
  ("id", "code", "name", "description", "monthlyPrice", "annualPrice", "trialDays",
   "studentLimit", "userLimit", "facultyLimit", "storageLimitMb", "features", "sortOrder")
VALUES
  (gen_random_uuid()::text, 'TRIAL', 'Trial', 'Time-boxed evaluation of the full platform.',
   0, 0, 14, 200, 250, 50, 2048,
   '["students","faculty","attendance","timetable","exams","results","assignments","notices","notifications","calendar","reports"]'::jsonb, 0),
  (gen_random_uuid()::text, 'STANDARD', 'Standard', 'Core academic operations for a single campus.',
   0, 0, 0, 3000, 3500, 400, 20480,
   '["students","faculty","attendance","timetable","exams","results","assignments","fees","payments","parent_portal","notices","notifications","reports","calendar","registration","library","admissions","hr","leave","promotions","certificates","lms","operations"]'::jsonb, 1),
  (gen_random_uuid()::text, 'ENTERPRISE', 'Enterprise', 'Multi-campus institutions with analytics and intelligence.',
   0, 0, 0, NULL, NULL, NULL, NULL,
   '["students","faculty","attendance","timetable","exams","results","assignments","fees","payments","parent_portal","notices","notifications","reports","import_export","cms","documents","analytics","intelligence","placements","admissions","hr","leave","library","calendar","registration","promotions","certificates","audit","lms","operations"]'::jsonb, 2)
ON CONFLICT ("code") DO NOTHING;

ALTER TABLE "tenant_subscriptions"
  ADD COLUMN IF NOT EXISTS "planId" TEXT,
  ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT;


-- ==========================================================
-- 7. AUTHENTICATION HARDENING
-- ==========================================================

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "mfaEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "mfaSecret" TEXT,
  ADD COLUMN IF NOT EXISTS "mfaEnrolledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE "password_reset_tokens" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "requestedIp" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key"
  ON "password_reset_tokens"("tokenHash");
CREATE INDEX "password_reset_tokens_userId_expiresAt_idx"
  ON "password_reset_tokens"("userId", "expiresAt");


CREATE TABLE "mfa_recovery_codes" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "mfa_recovery_codes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "mfa_recovery_codes_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "mfa_recovery_codes_userId_idx" ON "mfa_recovery_codes"("userId");


CREATE TABLE "mfa_challenges" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "challengeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "ipAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "mfa_challenges_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "mfa_challenges_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "mfa_challenges_challengeHash_key"
  ON "mfa_challenges"("challengeHash");
CREATE INDEX "mfa_challenges_userId_expiresAt_idx"
  ON "mfa_challenges"("userId", "expiresAt");

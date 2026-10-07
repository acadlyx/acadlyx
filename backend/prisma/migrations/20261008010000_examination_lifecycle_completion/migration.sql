-- ACADLYX — integrated examination lifecycle completion.
-- Extends the existing Examination Cell source of truth; no parallel exam system.

ALTER TABLE "exam_sessions"
  ADD COLUMN IF NOT EXISTS "registrationRequired" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "registrationStart" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "registrationEnd" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "examFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "attendanceRequirement" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "eligibilityRules" JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "studentIds" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "registrationStatus" TEXT NOT NULL DEFAULT 'NOT_OPEN',
  ADD COLUMN IF NOT EXISTS "eligibilityStatus" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "admitCardStatus" TEXT NOT NULL DEFAULT 'NOT_ISSUED',
  ADD COLUMN IF NOT EXISTS "resultStatus" TEXT NOT NULL DEFAULT 'DRAFT';

CREATE INDEX IF NOT EXISTS "exam_sessions_institution_registration_window_idx"
  ON "exam_sessions" ("institutionId", "registrationStart", "registrationEnd");

CREATE TABLE IF NOT EXISTS "exam_eligibilities" (
  "id" TEXT PRIMARY KEY,
  "institutionId" TEXT NOT NULL REFERENCES "institutions"("id") ON DELETE CASCADE,
  "examSessionId" TEXT NOT NULL REFERENCES "exam_sessions"("id") ON DELETE CASCADE,
  "studentId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status" TEXT NOT NULL DEFAULT 'INELIGIBLE',
  "reasons" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "contextSnapshot" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "evaluatedById" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "exam_eligibilities_session_student_key" UNIQUE ("examSessionId","studentId")
);
CREATE INDEX IF NOT EXISTS "exam_eligibilities_institution_status_idx"
  ON "exam_eligibilities" ("institutionId","status");
CREATE INDEX IF NOT EXISTS "exam_eligibilities_student_idx"
  ON "exam_eligibilities" ("institutionId","studentId","status");

CREATE TABLE IF NOT EXISTS "exam_registrations" (
  "id" TEXT PRIMARY KEY,
  "institutionId" TEXT NOT NULL REFERENCES "institutions"("id") ON DELETE CASCADE,
  "examSessionId" TEXT NOT NULL REFERENCES "exam_sessions"("id") ON DELETE CASCADE,
  "studentId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status" TEXT NOT NULL DEFAULT 'REGISTERED',
  "feeStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "feeInvoiceId" TEXT REFERENCES "fee_invoices"("id") ON DELETE SET NULL,
  "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "exam_registrations_session_student_key" UNIQUE ("examSessionId","studentId")
);
CREATE INDEX IF NOT EXISTS "exam_registrations_institution_status_idx"
  ON "exam_registrations" ("institutionId","status","feeStatus");
CREATE INDEX IF NOT EXISTS "exam_registrations_student_idx"
  ON "exam_registrations" ("institutionId","studentId","createdAt");

CREATE TABLE IF NOT EXISTS "admit_card_holds" (
  "id" TEXT PRIMARY KEY,
  "institutionId" TEXT NOT NULL REFERENCES "institutions"("id") ON DELETE CASCADE,
  "examSessionId" TEXT NOT NULL REFERENCES "exam_sessions"("id") ON DELETE CASCADE,
  "studentId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "hallTicketId" TEXT REFERENCES "hall_tickets"("id") ON DELETE SET NULL,
  "reasonCode" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "resolution" TEXT,
  "createdById" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedById" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
  "resolvedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "admit_card_holds_institution_active_idx"
  ON "admit_card_holds" ("institutionId","status");
CREATE INDEX IF NOT EXISTS "admit_card_holds_student_idx"
  ON "admit_card_holds" ("institutionId","studentId","examSessionId","status");

CREATE TABLE IF NOT EXISTS "exam_mark_correction_requests" (
  "id" TEXT PRIMARY KEY,
  "institutionId" TEXT NOT NULL REFERENCES "institutions"("id") ON DELETE CASCADE,
  "examScheduleId" TEXT NOT NULL REFERENCES "exam_schedules"("id") ON DELETE CASCADE,
  "examMarkId" TEXT NOT NULL REFERENCES "exam_marks"("id") ON DELETE CASCADE,
  "studentId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "requestedById" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "oldMarks" DOUBLE PRECISION,
  "newMarks" DOUBLE PRECISION,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "decisionNote" TEXT,
  "decidedById" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
  "decidedAt" TIMESTAMP(3),
  "unlockedAt" TIMESTAMP(3),
  "relockedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "exam_mark_corrections_institution_status_idx"
  ON "exam_mark_correction_requests" ("institutionId","status");
CREATE UNIQUE INDEX IF NOT EXISTS "exam_mark_corrections_pending_key"
  ON "exam_mark_correction_requests" ("examMarkId")
  WHERE "status" = 'PENDING';

CREATE TABLE IF NOT EXISTS "exam_result_publications" (
  "id" TEXT PRIMARY KEY,
  "institutionId" TEXT NOT NULL REFERENCES "institutions"("id") ON DELETE CASCADE,
  "examScheduleId" TEXT NOT NULL REFERENCES "exam_schedules"("id") ON DELETE CASCADE,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "totalCandidates" INTEGER NOT NULL DEFAULT 0,
  "processedCandidates" INTEGER NOT NULL DEFAULT 0,
  "verifiedById" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
  "verifiedAt" TIMESTAMP(3),
  "approvedById" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
  "approvedAt" TIMESTAMP(3),
  "publishedById" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "exam_result_publications_schedule_key" UNIQUE ("examScheduleId")
);
CREATE INDEX IF NOT EXISTS "exam_result_publications_institution_status_idx"
  ON "exam_result_publications" ("institutionId","status");

ALTER TABLE "hall_tickets"
  ADD COLUMN IF NOT EXISTS "generationStatus" TEXT NOT NULL DEFAULT 'GENERATED',
  ADD COLUMN IF NOT EXISTS "reissuedFromId" TEXT,
  ADD COLUMN IF NOT EXISTS "downloadedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "hall_tickets_institution_status_idx"
  ON "hall_tickets" ("institutionId","status","generationStatus");

CREATE INDEX IF NOT EXISTS "hall_tickets_reissued_from_idx"
  ON "hall_tickets" ("reissuedFromId");

DO $
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hall_tickets_reissued_from_fk'
  ) THEN
    ALTER TABLE "hall_tickets"
      ADD CONSTRAINT "hall_tickets_reissued_from_fk"
      FOREIGN KEY ("reissuedFromId") REFERENCES "hall_tickets"("id") ON DELETE SET NULL;
  END IF;
END $;

ALTER TABLE "exam_marks"
  ADD COLUMN IF NOT EXISTS "correctionRequestId" TEXT;

CREATE INDEX IF NOT EXISTS "exam_marks_schedule_status_idx"
  ON "exam_marks" ("examScheduleId","status");

CREATE INDEX IF NOT EXISTS "exam_marks_correction_request_idx"
  ON "exam_marks" ("correctionRequestId");

DO $
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exam_marks_correction_request_fk'
  ) THEN
    ALTER TABLE "exam_marks"
      ADD CONSTRAINT "exam_marks_correction_request_fk"
      FOREIGN KEY ("correctionRequestId")
      REFERENCES "exam_mark_correction_requests"("id") ON DELETE SET NULL;
  END IF;
END $;

-- Keep updatedAt correct for lifecycle tables.
CREATE OR REPLACE FUNCTION "acadlyx_exam_lifecycle_updated_at"()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW."updatedAt" = CURRENT_TIMESTAMP; RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS "exam_eligibilities_updated_at_trigger" ON "exam_eligibilities";
CREATE TRIGGER "exam_eligibilities_updated_at_trigger" BEFORE UPDATE ON "exam_eligibilities"
FOR EACH ROW EXECUTE FUNCTION "acadlyx_exam_lifecycle_updated_at"();
DROP TRIGGER IF EXISTS "exam_registrations_updated_at_trigger" ON "exam_registrations";
CREATE TRIGGER "exam_registrations_updated_at_trigger" BEFORE UPDATE ON "exam_registrations"
FOR EACH ROW EXECUTE FUNCTION "acadlyx_exam_lifecycle_updated_at"();
DROP TRIGGER IF EXISTS "admit_card_holds_updated_at_trigger" ON "admit_card_holds";
CREATE TRIGGER "admit_card_holds_updated_at_trigger" BEFORE UPDATE ON "admit_card_holds"
FOR EACH ROW EXECUTE FUNCTION "acadlyx_exam_lifecycle_updated_at"();
DROP TRIGGER IF EXISTS "exam_mark_corrections_updated_at_trigger" ON "exam_mark_correction_requests";
CREATE TRIGGER "exam_mark_corrections_updated_at_trigger" BEFORE UPDATE ON "exam_mark_correction_requests"
FOR EACH ROW EXECUTE FUNCTION "acadlyx_exam_lifecycle_updated_at"();
DROP TRIGGER IF EXISTS "exam_result_publications_updated_at_trigger" ON "exam_result_publications";
CREATE TRIGGER "exam_result_publications_updated_at_trigger" BEFORE UPDATE ON "exam_result_publications"
FOR EACH ROW EXECUTE FUNCTION "acadlyx_exam_lifecycle_updated_at"();

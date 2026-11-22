ALTER TABLE "academic_years"
  ADD COLUMN IF NOT EXISTS "registrationOpensAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "registrationClosesAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "addDropDeadline" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "withdrawalDeadline" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "exceptionalWithdrawalAllowed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "exceptionalWithdrawalStartsAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "exceptionalWithdrawalEndsAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "course_registration_history" (
  "id" TEXT NOT NULL, "institutionId" TEXT NOT NULL, "registrationId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL, "action" TEXT NOT NULL, "previousStatus" TEXT,
  "newStatus" TEXT NOT NULL, "reason" TEXT, "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB, CONSTRAINT "course_registration_history_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "course_registration_history_registrationId_fkey"
    FOREIGN KEY ("registrationId") REFERENCES "course_registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "course_registration_history" ("id","institutionId","registrationId","actorId","action","previousStatus","newStatus","occurredAt","metadata")
SELECT gen_random_uuid()::text,"institutionId","id",COALESCE("decidedById","studentId"),'MIGRATED_BASELINE',NULL,"status","createdAt",jsonb_build_object('migration','20261122010000_registration_withdrawal_integrity')
FROM "course_registrations";
CREATE INDEX IF NOT EXISTS "course_registration_history_institutionId_registrationId_occurredAt_idx" ON "course_registration_history"("institutionId","registrationId","occurredAt");
CREATE INDEX IF NOT EXISTS "course_registration_history_actorId_occurredAt_idx" ON "course_registration_history"("actorId","occurredAt");

CREATE TABLE IF NOT EXISTS "course_withdrawal_requests" (
  "id" TEXT NOT NULL, "institutionId" TEXT NOT NULL, "registrationId" TEXT NOT NULL, "studentId" TEXT NOT NULL,
  "reason" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING', "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedById" TEXT, "decidedAt" TIMESTAMP(3), "decisionNote" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "course_withdrawal_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "course_withdrawal_requests_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "course_withdrawal_requests_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "course_registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "course_withdrawal_requests_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "course_withdrawal_requests_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "course_withdrawal_requests_institutionId_status_requestedAt_idx" ON "course_withdrawal_requests"("institutionId","status","requestedAt");
CREATE INDEX IF NOT EXISTS "course_withdrawal_requests_studentId_status_idx" ON "course_withdrawal_requests"("studentId","status");
CREATE INDEX IF NOT EXISTS "course_withdrawal_requests_registrationId_status_idx" ON "course_withdrawal_requests"("registrationId","status");
CREATE UNIQUE INDEX IF NOT EXISTS "course_withdrawal_requests_one_pending_per_registration_idx" ON "course_withdrawal_requests"("registrationId") WHERE "status"='PENDING';

CREATE TABLE IF NOT EXISTS "student_enrollment_request_history" (
  "id" TEXT NOT NULL, "institutionId" TEXT NOT NULL, "requestId" TEXT NOT NULL, "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL, "previousStatus" TEXT, "newStatus" TEXT NOT NULL, "reason" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "metadata" JSONB,
  CONSTRAINT "student_enrollment_request_history_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "student_enrollment_request_history_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "student_enrollment_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "student_enrollment_request_history" ("id","institutionId","requestId","actorId","action","previousStatus","newStatus","occurredAt","metadata")
SELECT gen_random_uuid()::text,"institutionId","id","requestedById",'MIGRATED_BASELINE',NULL,"status","createdAt",jsonb_build_object('migration','20261122010000_registration_withdrawal_integrity')
FROM "student_enrollment_requests";
CREATE INDEX IF NOT EXISTS "student_enrollment_request_history_institutionId_requestId_occurredAt_idx" ON "student_enrollment_request_history"("institutionId","requestId","occurredAt");
CREATE INDEX IF NOT EXISTS "student_enrollment_request_history_actorId_occurredAt_idx" ON "student_enrollment_request_history"("actorId","occurredAt");

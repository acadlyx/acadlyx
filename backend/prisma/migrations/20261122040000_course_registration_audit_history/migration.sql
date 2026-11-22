CREATE TABLE "course_registration_history" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "registrationId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "previousStatus" TEXT,
  "newStatus" TEXT NOT NULL,
  "reason" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  CONSTRAINT "course_registration_history_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "course_registration_history_registrationId_fkey"
    FOREIGN KEY ("registrationId") REFERENCES "course_registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "course_registration_history"
  ("id","institutionId","registrationId","actorId","action","previousStatus","newStatus","occurredAt","metadata")
SELECT
  gen_random_uuid()::text,
  "institutionId",
  "id",
  COALESCE("decidedById","studentId"),
  'MIGRATED_BASELINE',
  NULL,
  "status",
  "createdAt",
  jsonb_build_object('migration','20261122040000_course_registration_audit_history')
FROM "course_registrations";

CREATE INDEX "course_registration_history_institutionId_registrationId_occurredAt_idx"
  ON "course_registration_history"("institutionId","registrationId","occurredAt");
CREATE INDEX "course_registration_history_actorId_occurredAt_idx"
  ON "course_registration_history"("actorId","occurredAt");

CREATE TABLE "student_enrollment_request_history" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "previousStatus" TEXT,
  "newStatus" TEXT NOT NULL,
  "reason" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  CONSTRAINT "student_enrollment_request_history_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "student_enrollment_request_history_requestId_fkey"
    FOREIGN KEY ("requestId") REFERENCES "student_enrollment_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "student_enrollment_request_history"
  ("id","institutionId","requestId","actorId","action","previousStatus","newStatus","occurredAt","metadata")
SELECT
  gen_random_uuid()::text,
  "institutionId",
  "id",
  "requestedById",
  'MIGRATED_BASELINE',
  NULL,
  "status",
  "createdAt",
  jsonb_build_object('migration','20261122040000_course_registration_audit_history')
FROM "student_enrollment_requests";

CREATE INDEX "student_enrollment_request_history_institutionId_requestId_occurredAt_idx"
  ON "student_enrollment_request_history"("institutionId","requestId","occurredAt");
CREATE INDEX "student_enrollment_request_history_actorId_occurredAt_idx"
  ON "student_enrollment_request_history"("actorId","occurredAt");

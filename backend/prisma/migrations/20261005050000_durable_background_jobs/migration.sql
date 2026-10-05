/*
  Durable PostgreSQL-backed job queue.
  No production data is deleted or reset.
*/
CREATE TABLE IF NOT EXISTS "background_jobs" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "priority" INTEGER NOT NULL DEFAULT 100,
  "payload" JSONB NOT NULL,
  "progress" INTEGER NOT NULL DEFAULT 0,
  "total" INTEGER NOT NULL DEFAULT 0,
  "processed" INTEGER NOT NULL DEFAULT 0,
  "failed" INTEGER NOT NULL DEFAULT 0,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "lastHeartbeatAt" TIMESTAMP(3),
  "workerId" TEXT,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "idempotencyKey" TEXT,
  "createdById" TEXT,
  "result" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "background_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "background_jobs_institutionId_idempotencyKey_key"
  ON "background_jobs"("institutionId","idempotencyKey");
CREATE INDEX IF NOT EXISTS "background_jobs_status_priority_availableAt_idx"
  ON "background_jobs"("status","priority","availableAt");
CREATE INDEX IF NOT EXISTS "background_jobs_institutionId_status_createdAt_idx"
  ON "background_jobs"("institutionId","status","createdAt");
CREATE INDEX IF NOT EXISTS "background_jobs_institutionId_type_status_createdAt_idx"
  ON "background_jobs"("institutionId","type","status","createdAt");
CREATE INDEX IF NOT EXISTS "background_jobs_lastHeartbeatAt_idx"
  ON "background_jobs"("lastHeartbeatAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='background_jobs_institutionId_fkey') THEN
    ALTER TABLE "background_jobs"
      ADD CONSTRAINT "background_jobs_institutionId_fkey"
      FOREIGN KEY ("institutionId") REFERENCES "institutions"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='background_jobs_createdById_fkey') THEN
    ALTER TABLE "background_jobs"
      ADD CONSTRAINT "background_jobs_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "background_jobs"
  ADD CONSTRAINT "background_jobs_status_check"
  CHECK ("status" IN ('QUEUED','PROCESSING','COMPLETED','FAILED','CANCEL_REQUESTED','CANCELLED'))
  NOT VALID;

ALTER TABLE "background_jobs" VALIDATE CONSTRAINT "background_jobs_status_check";

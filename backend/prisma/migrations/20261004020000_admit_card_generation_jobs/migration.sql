CREATE TABLE IF NOT EXISTS "admit_card_generation_jobs" (
  "id" TEXT PRIMARY KEY,
  "institutionId" TEXT NOT NULL REFERENCES "institutions"("id") ON DELETE CASCADE,
  "examSessionId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "total" INTEGER NOT NULL DEFAULT 0,
  "completed" INTEGER NOT NULL DEFAULT 0,
  "failed" INTEGER NOT NULL DEFAULT 0,
  "fileName" TEXT,
  "error" TEXT,
  "createdById" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "admit_card_generation_jobs_institution_status_idx"
  ON "admit_card_generation_jobs" ("institutionId","status","createdAt");

-- Separate student cohort (Batch) from operational AcademicYear.
CREATE TABLE IF NOT EXISTS "batches" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "programId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "admissionYear" INTEGER NOT NULL,
  "completionYear" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "batches_pkey" PRIMARY KEY ("id")
);

DO $ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'batches_institutionId_fkey') THEN
    ALTER TABLE "batches" ADD CONSTRAINT "batches_institutionId_fkey"
      FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'batches_programId_fkey') THEN
    ALTER TABLE "batches" ADD CONSTRAINT "batches_programId_fkey"
      FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $;

CREATE UNIQUE INDEX IF NOT EXISTS "batches_institutionId_code_key"
  ON "batches"("institutionId", "code");
CREATE INDEX IF NOT EXISTS "batches_institutionId_programId_idx"
  ON "batches"("institutionId", "programId");
CREATE INDEX IF NOT EXISTS "batches_programId_admissionYear_idx"
  ON "batches"("programId", "admissionYear");

ALTER TABLE "student_enrollments"
  ADD COLUMN IF NOT EXISTS "batchId" TEXT;

DO $ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_enrollments_batchId_fkey') THEN
    ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_batchId_fkey"
      FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $;

CREATE INDEX IF NOT EXISTS "student_enrollments_batchId_idx"
  ON "student_enrollments"("batchId");
CREATE INDEX IF NOT EXISTS "student_enrollments_institutionId_batchId_semesterId_sectionId_idx"
  ON "student_enrollments"("institutionId", "batchId", "semesterId", "sectionId");

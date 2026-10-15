-- Restore the company-history table required by the Placement Company Master query.
-- This is tenant-scoped and cascades only when the owning institution/company is removed.
CREATE TABLE IF NOT EXISTS "placement_company_history" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "visitCount" INTEGER NOT NULL DEFAULT 0,
  "driveCount" INTEGER NOT NULL DEFAULT 0,
  "hiredCount" INTEGER NOT NULL DEFAULT 0,
  "averagePackage" DECIMAL(12,2),
  "highestPackage" DECIMAL(12,2),
  "lastInteractionAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "placement_company_history_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "placement_company_history_institutionId_companyId_key"
  ON "placement_company_history"("institutionId", "companyId");

CREATE INDEX IF NOT EXISTS "placement_company_history_institutionId_lastInteractionAt_idx"
  ON "placement_company_history"("institutionId", "lastInteractionAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'placement_company_history_institutionId_fkey'
      AND conrelid = '"placement_company_history"'::regclass
  ) THEN
    ALTER TABLE "placement_company_history"
      ADD CONSTRAINT "placement_company_history_institutionId_fkey"
      FOREIGN KEY ("institutionId") REFERENCES "institutions"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'placement_company_history_companyId_fkey'
      AND conrelid = '"placement_company_history"'::regclass
  ) THEN
    ALTER TABLE "placement_company_history"
      ADD CONSTRAINT "placement_company_history_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "placement_companies"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

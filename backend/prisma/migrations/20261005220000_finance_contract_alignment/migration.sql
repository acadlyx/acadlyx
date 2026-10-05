/*
  Finance contract alignment.
  Repairs the persisted finance contract to match the canonical billing
  service: structure-level concessions may exist before an invoice is issued,
  refund records retain a settlement reference, and existing concession rows
  remain valid.
*/

ALTER TABLE "fee_concessions"
  ALTER COLUMN "invoiceId" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "feeStructureId" TEXT,
  ADD COLUMN IF NOT EXISTS "academicYearId" TEXT,
  ADD COLUMN IF NOT EXISTS "name" TEXT,
  ADD COLUMN IF NOT EXISTS "concessionType" TEXT,
  ADD COLUMN IF NOT EXISTS "requestedById" TEXT;

UPDATE "fee_concessions"
SET "requestedById" = "createdById"
WHERE "requestedById" IS NULL;

ALTER TABLE "fee_refunds"
  ADD COLUMN IF NOT EXISTS "reference" TEXT;

CREATE INDEX IF NOT EXISTS "fee_concessions_feeStructureId_idx"
  ON "fee_concessions"("feeStructureId");
CREATE INDEX IF NOT EXISTS "fee_concessions_academicYearId_idx"
  ON "fee_concessions"("academicYearId");
CREATE INDEX IF NOT EXISTS "fee_concessions_requestedById_idx"
  ON "fee_concessions"("requestedById");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fee_concessions_feeStructureId_fkey'
  ) THEN
    ALTER TABLE "fee_concessions"
      ADD CONSTRAINT "fee_concessions_feeStructureId_fkey"
      FOREIGN KEY ("feeStructureId") REFERENCES "fee_structures"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fee_concessions_academicYearId_fkey'
  ) THEN
    ALTER TABLE "fee_concessions"
      ADD CONSTRAINT "fee_concessions_academicYearId_fkey"
      FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fee_concessions_requestedById_fkey'
  ) THEN
    ALTER TABLE "fee_concessions"
      ADD CONSTRAINT "fee_concessions_requestedById_fkey"
      FOREIGN KEY ("requestedById") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

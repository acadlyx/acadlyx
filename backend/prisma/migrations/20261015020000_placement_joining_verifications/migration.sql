-- Add the joining-verification table used by the Placement Offers workflow.
CREATE TABLE IF NOT EXISTS "placement_joining_verifications" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "offerId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "expectedJoiningDate" TIMESTAMP(3),
  "actualJoiningDate" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "proofUrl" TEXT,
  "verifiedById" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "placement_joining_verifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "placement_joining_verifications_offerId_key"
  ON "placement_joining_verifications"("offerId");

CREATE INDEX IF NOT EXISTS "placement_joining_verifications_institutionId_studentId_status_idx"
  ON "placement_joining_verifications"("institutionId", "studentId", "status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'placement_joining_verifications_institutionId_fkey'
      AND conrelid = '"placement_joining_verifications"'::regclass
  ) THEN
    ALTER TABLE "placement_joining_verifications"
      ADD CONSTRAINT "placement_joining_verifications_institutionId_fkey"
      FOREIGN KEY ("institutionId") REFERENCES "institutions"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'placement_joining_verifications_offerId_fkey'
      AND conrelid = '"placement_joining_verifications"'::regclass
  ) THEN
    ALTER TABLE "placement_joining_verifications"
      ADD CONSTRAINT "placement_joining_verifications_offerId_fkey"
      FOREIGN KEY ("offerId") REFERENCES "placement_offers"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'placement_joining_verifications_studentId_fkey'
      AND conrelid = '"placement_joining_verifications"'::regclass
  ) THEN
    ALTER TABLE "placement_joining_verifications"
      ADD CONSTRAINT "placement_joining_verifications_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

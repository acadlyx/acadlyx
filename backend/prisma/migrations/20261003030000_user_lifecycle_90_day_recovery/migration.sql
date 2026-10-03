ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "deletionReason" TEXT,
  ADD COLUMN IF NOT EXISTS "deletionNote" TEXT,
  ADD COLUMN IF NOT EXISTS "recoveryDeadline" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "permanentlyDeletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "users_deletedAt_idx" ON "users"("deletedAt");
CREATE INDEX IF NOT EXISTS "users_recoveryDeadline_idx" ON "users"("recoveryDeadline");
CREATE INDEX IF NOT EXISTS "users_institutionId_isActive_deletedAt_idx" ON "users"("institutionId", "isActive", "deletedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_deletedBy_fkey'
      AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE "users"
      ADD CONSTRAINT "users_deletedBy_fkey"
      FOREIGN KEY ("deletedBy") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

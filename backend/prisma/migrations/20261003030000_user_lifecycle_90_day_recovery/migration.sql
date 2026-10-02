ALTER TABLE "users"
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "deletedBy" TEXT,
  ADD COLUMN "deletionReason" TEXT,
  ADD COLUMN "deletionNote" TEXT,
  ADD COLUMN "recoveryDeadline" TIMESTAMP(3),
  ADD COLUMN "permanentlyDeletedAt" TIMESTAMP(3);

CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");
CREATE INDEX "users_recoveryDeadline_idx" ON "users"("recoveryDeadline");
CREATE INDEX "users_institutionId_isActive_deletedAt_idx" ON "users"("institutionId", "isActive", "deletedAt");

ALTER TABLE "users"
  ADD CONSTRAINT "users_deletedBy_fkey"
  FOREIGN KEY ("deletedBy") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

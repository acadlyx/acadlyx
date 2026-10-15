-- Add a nullable unique key so event notifications can be safely retried.
-- Existing notifications remain valid and may keep dedupeKey NULL.
ALTER TABLE "notifications" ADD COLUMN "dedupeKey" TEXT;
CREATE UNIQUE INDEX "notifications_dedupeKey_key" ON "notifications"("dedupeKey");

-- Placement automation reliability and candidate response deadlines.
-- Idempotent column/index creation keeps interrupted CI or deployment retries safe.

ALTER TABLE "domain_event_outbox"
  ADD COLUMN IF NOT EXISTS "nextAttemptAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastAttemptAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "domain_event_outbox_processedAt_nextAttemptAt_createdAt_idx"
  ON "domain_event_outbox"("processedAt", "nextAttemptAt", "createdAt");

ALTER TABLE "placement_offers"
  ADD COLUMN IF NOT EXISTS "responseDeadline" TIMESTAMP(3);

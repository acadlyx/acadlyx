-- Keep retry-exhausted domain events visible instead of leaving them
-- indistinguishable from ordinary pending work.
ALTER TABLE "domain_event_outbox"
  ADD COLUMN IF NOT EXISTS "deadLetteredAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "domain_event_outbox_dead_lettered_created_idx"
  ON "domain_event_outbox" ("deadLetteredAt", "createdAt");

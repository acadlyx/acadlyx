-- Prevent overlapping API replicas from delivering the same event concurrently.
-- A stale lease is recoverable after 15 minutes if a worker process exits mid-delivery.
ALTER TABLE "domain_event_outbox"
  ADD COLUMN IF NOT EXISTS "lockedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lockToken" TEXT;

CREATE INDEX IF NOT EXISTS "domain_event_outbox_claim_lease_idx"
  ON "domain_event_outbox" ("processedAt", "lockedAt", "nextAttemptAt", "createdAt");

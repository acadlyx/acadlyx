-- Durable ERP domain-event outbox and notification lifecycle fields.
CREATE TABLE IF NOT EXISTS "domain_event_outbox" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT,
  "actorId" TEXT,
  "name" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "domain_event_outbox_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "domain_event_outbox_institution_created_idx" ON "domain_event_outbox" ("institutionId","createdAt");
CREATE INDEX IF NOT EXISTS "domain_event_outbox_processed_created_idx" ON "domain_event_outbox" ("processedAt","createdAt");
CREATE INDEX IF NOT EXISTS "domain_event_outbox_name_processed_created_idx" ON "domain_event_outbox" ("name","processedAt","createdAt");
DO $$ BEGIN
  ALTER TABLE "domain_event_outbox" ADD CONSTRAINT "domain_event_outbox_institution_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "domain_event_outbox" ADD CONSTRAINT "domain_event_outbox_actor_fkey"
    FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "dismissedAt" TIMESTAMP(3);
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "actionUrl" TEXT;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "priority" TEXT NOT NULL DEFAULT 'NORMAL';
CREATE INDEX IF NOT EXISTS "notifications_institution_user_dismissed_created_idx"
  ON "notifications" ("institutionId","userId","dismissedAt","createdAt" DESC);

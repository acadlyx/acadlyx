CREATE TABLE IF NOT EXISTS "admit_card_templates" (
  "id" TEXT PRIMARY KEY,
  "institutionId" TEXT NOT NULL REFERENCES "institutions"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "config" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdById" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "updatedById" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "admit_card_templates_institutionId_status_idx"
  ON "admit_card_templates" ("institutionId", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "admit_card_templates_institutionId_name_key"
  ON "admit_card_templates" ("institutionId", "name");

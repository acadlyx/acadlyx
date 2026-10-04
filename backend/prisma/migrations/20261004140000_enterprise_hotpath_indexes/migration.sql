-- Enterprise hot paths: tenant-scoped mutation history, recovery queues,
-- notifications, documents and active/deleted user lifecycle lookups.
CREATE INDEX IF NOT EXISTS "audit_logs_institution_entity_created_idx"
  ON "audit_logs" ("institutionId", "entityType", "entityId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "audit_logs_institution_created_idx"
  ON "audit_logs" ("institutionId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "users_institution_active_idx"
  ON "users" ("institutionId", "isActive");

CREATE INDEX IF NOT EXISTS "users_institution_deleted_idx"
  ON "users" ("institutionId", "deletedAt");

CREATE INDEX IF NOT EXISTS "notifications_institution_created_idx"
  ON "notifications" ("institutionId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "documents_institution_created_idx"
  ON "documents" ("institutionId", "createdAt" DESC);

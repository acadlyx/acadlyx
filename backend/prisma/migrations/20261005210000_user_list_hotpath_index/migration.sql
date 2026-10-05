CREATE INDEX IF NOT EXISTS "users_institution_created_idx"
  ON "users" ("institutionId", "createdAt" DESC);

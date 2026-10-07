CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS "users_firstName_trgm_idx"
  ON "users" USING GIN ("firstName" extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "users_lastName_trgm_idx"
  ON "users" USING GIN ("lastName" extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "users_idNumber_trgm_idx"
  ON "users" USING GIN ("idNumber" extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "users_email_trgm_idx"
  ON "users" USING GIN ("email" extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "courses_code_trgm_idx"
  ON "courses" USING GIN ("code" extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "courses_name_trgm_idx"
  ON "courses" USING GIN ("name" extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "notices_title_trgm_idx"
  ON "notices" USING GIN ("title" extensions.gin_trgm_ops);

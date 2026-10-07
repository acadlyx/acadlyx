CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "users_firstName_trgm_idx"
  ON "users" USING GIN ("firstName" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "users_lastName_trgm_idx"
  ON "users" USING GIN ("lastName" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "users_idNumber_trgm_idx"
  ON "users" USING GIN ("idNumber" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "users_email_trgm_idx"
  ON "users" USING GIN ("email" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "courses_code_trgm_idx"
  ON "courses" USING GIN ("code" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "courses_name_trgm_idx"
  ON "courses" USING GIN ("name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "notices_title_trgm_idx"
  ON "notices" USING GIN ("title" gin_trgm_ops);

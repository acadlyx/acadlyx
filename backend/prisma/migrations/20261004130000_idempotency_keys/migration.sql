-- Durable request idempotency records.
-- Scope includes method, route and an authorization-token hash so one tenant/user
-- cannot accidentally replay another caller's request.
CREATE TABLE "idempotency_keys" (
  "id" TEXT NOT NULL,
  "key" VARCHAR(200) NOT NULL,
  "scope" VARCHAR(700) NOT NULL,
  "fingerprint" CHAR(64) NOT NULL,
  "status_code" INTEGER,
  "response_body" TEXT,
  "response_content_type" VARCHAR(255),
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "idempotency_keys_key_scope_key"
  ON "idempotency_keys"("key", "scope");

CREATE INDEX "idempotency_keys_expires_at_idx"
  ON "idempotency_keys"("expires_at");

CREATE INDEX "idempotency_keys_fingerprint_idx"
  ON "idempotency_keys"("fingerprint");

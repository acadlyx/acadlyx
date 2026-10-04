ALTER TABLE "fee_payments" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "fee_payments_institutionId_idempotencyKey_key" ON "fee_payments"("institutionId","idempotencyKey");

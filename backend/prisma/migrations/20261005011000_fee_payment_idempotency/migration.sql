ALTER TABLE "fee_payments" ADD COLUMN "idempotencyKey" TEXT;
CREATE UNIQUE INDEX "fee_payments_institutionId_idempotencyKey_key" ON "fee_payments"("institutionId","idempotencyKey");
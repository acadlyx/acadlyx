-- Keep legacy financial columns compatible with the canonical Prisma contract.
-- Older deployments created feePaymentId/name/concessionType as required fields.
-- Backfill the mirror before allowing new canonical-only writes during rollout.
ALTER TABLE "fee_refunds"
  ADD COLUMN IF NOT EXISTS "feePaymentId" TEXT;

UPDATE "fee_refunds"
SET "paymentId" = "feePaymentId"
WHERE "paymentId" IS NULL
  AND "feePaymentId" IS NOT NULL;

UPDATE "fee_refunds"
SET "feePaymentId" = "paymentId"
WHERE "feePaymentId" IS NULL
  AND "paymentId" IS NOT NULL;

ALTER TABLE "fee_refunds"
  ALTER COLUMN "feePaymentId" DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fee_refunds_feePaymentId_fkey'
      AND conrelid = '"fee_refunds"'::regclass
  ) THEN
    ALTER TABLE "fee_refunds"
      ADD CONSTRAINT "fee_refunds_feePaymentId_fkey"
      FOREIGN KEY ("feePaymentId") REFERENCES "fee_payments"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "fee_refunds_feePaymentId_idx"
  ON "fee_refunds"("feePaymentId");

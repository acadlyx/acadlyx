-- ACADLYX finance domain
-- Production-safe, repeatable repair migration.
--
-- This migration must tolerate a database that contains partial finance
-- objects from earlier failed/partially-applied attempts.  Prisma will retry
-- this migration after it has been marked rolled back, so every operation
-- below is intentionally idempotent.

CREATE TABLE IF NOT EXISTS "fee_invoice_items" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "feeHeadId" TEXT,
  "description" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fee_invoice_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "fee_concessions" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "percentage" DECIMAL(7,4),
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdById" TEXT NOT NULL,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fee_concessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "fee_refunds" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "requestedById" TEXT NOT NULL,
  "approvedById" TEXT,
  "processedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fee_refunds_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "fee_transactions" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "studentId" TEXT,
  "invoiceId" TEXT,
  "paymentId" TEXT,
  "amount" DECIMAL(14,2) NOT NULL,
  "type" TEXT NOT NULL,
  "reference" TEXT,
  "metadata" JSONB,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fee_transactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "fee_receipts" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "receiptNumber" TEXT NOT NULL,
  "issuedById" TEXT,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fee_receipts_pkey" PRIMARY KEY ("id")
);

-- Repair any pre-existing partial tables.  Columns are added before indexes
-- and foreign keys so a legacy partial object cannot make the migration stop
-- with 42703/42P01.
ALTER TABLE "fee_invoice_items"
  ADD COLUMN IF NOT EXISTS "invoiceId" TEXT,
  ADD COLUMN IF NOT EXISTS "feeHeadId" TEXT,
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "amount" DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "fee_concessions"
  ADD COLUMN IF NOT EXISTS "institutionId" TEXT,
  ADD COLUMN IF NOT EXISTS "invoiceId" TEXT,
  ADD COLUMN IF NOT EXISTS "studentId" TEXT,
  ADD COLUMN IF NOT EXISTS "type" TEXT,
  ADD COLUMN IF NOT EXISTS "amount" DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS "percentage" DECIMAL(7,4),
  ADD COLUMN IF NOT EXISTS "reason" TEXT,
  ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "createdById" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedById" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "fee_refunds"
  ADD COLUMN IF NOT EXISTS "institutionId" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentId" TEXT,
  ADD COLUMN IF NOT EXISTS "invoiceId" TEXT,
  ADD COLUMN IF NOT EXISTS "studentId" TEXT,
  ADD COLUMN IF NOT EXISTS "amount" DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS "reason" TEXT,
  ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'REQUESTED',
  ADD COLUMN IF NOT EXISTS "requestedById" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedById" TEXT,
  ADD COLUMN IF NOT EXISTS "processedById" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "processedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "fee_transactions"
  ADD COLUMN IF NOT EXISTS "institutionId" TEXT,
  ADD COLUMN IF NOT EXISTS "studentId" TEXT,
  ADD COLUMN IF NOT EXISTS "invoiceId" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentId" TEXT,
  ADD COLUMN IF NOT EXISTS "amount" DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS "type" TEXT,
  ADD COLUMN IF NOT EXISTS "reference" TEXT,
  ADD COLUMN IF NOT EXISTS "metadata" JSONB,
  ADD COLUMN IF NOT EXISTS "createdById" TEXT,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "fee_receipts"
  ADD COLUMN IF NOT EXISTS "institutionId" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentId" TEXT,
  ADD COLUMN IF NOT EXISTS "invoiceId" TEXT,
  ADD COLUMN IF NOT EXISTS "studentId" TEXT,
  ADD COLUMN IF NOT EXISTS "receiptNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "issuedById" TEXT,
  ADD COLUMN IF NOT EXISTS "issuedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- The repair above intentionally leaves legacy-added columns nullable when a
-- pre-existing table already contained rows.  New rows are governed by the
-- Prisma schema.  Normalize timestamps/statuses where they are missing.
UPDATE "fee_concessions" SET "status" = 'PENDING' WHERE "status" IS NULL;
UPDATE "fee_refunds" SET "status" = 'REQUESTED' WHERE "status" IS NULL;
UPDATE "fee_invoice_items" SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL;
UPDATE "fee_concessions" SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL;
UPDATE "fee_concessions" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;
UPDATE "fee_refunds" SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL;
UPDATE "fee_refunds" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;
UPDATE "fee_transactions" SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL;
UPDATE "fee_receipts" SET "issuedAt" = CURRENT_TIMESTAMP WHERE "issuedAt" IS NULL;

-- Indexes are created only after every referenced column exists.
CREATE INDEX IF NOT EXISTS "fee_invoice_items_invoiceId_idx"
  ON "fee_invoice_items"("invoiceId");

CREATE INDEX IF NOT EXISTS "fee_concessions_institutionId_studentId_status_idx"
  ON "fee_concessions"("institutionId","studentId","status");
CREATE INDEX IF NOT EXISTS "fee_concessions_invoiceId_idx"
  ON "fee_concessions"("invoiceId");

CREATE INDEX IF NOT EXISTS "fee_refunds_institutionId_status_idx"
  ON "fee_refunds"("institutionId","status");
CREATE INDEX IF NOT EXISTS "fee_refunds_paymentId_idx"
  ON "fee_refunds"("paymentId");
CREATE INDEX IF NOT EXISTS "fee_refunds_invoiceId_idx"
  ON "fee_refunds"("invoiceId");

CREATE INDEX IF NOT EXISTS "fee_transactions_institutionId_createdAt_idx"
  ON "fee_transactions"("institutionId","createdAt");
CREATE INDEX IF NOT EXISTS "fee_transactions_institutionId_studentId_idx"
  ON "fee_transactions"("institutionId","studentId");
CREATE INDEX IF NOT EXISTS "fee_transactions_institutionId_type_idx"
  ON "fee_transactions"("institutionId","type");

CREATE UNIQUE INDEX IF NOT EXISTS "fee_receipts_paymentId_key"
  ON "fee_receipts"("paymentId");
CREATE UNIQUE INDEX IF NOT EXISTS "fee_receipts_institutionId_receiptNumber_key"
  ON "fee_receipts"("institutionId","receiptNumber");
CREATE INDEX IF NOT EXISTS "fee_receipts_institutionId_studentId_idx"
  ON "fee_receipts"("institutionId","studentId");

-- Add required relationships only when they do not already exist. NOT VALID
-- makes this safe for legacy rows while enforcing the relationship for new
-- writes; later validation can be performed after data cleanup.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_invoice_items_invoiceId_fkey') THEN
    ALTER TABLE "fee_invoice_items"
      ADD CONSTRAINT "fee_invoice_items_invoiceId_fkey"
      FOREIGN KEY ("invoiceId") REFERENCES "fee_invoices"("id")
      ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_invoice_items_feeHeadId_fkey') THEN
    ALTER TABLE "fee_invoice_items"
      ADD CONSTRAINT "fee_invoice_items_feeHeadId_fkey"
      FOREIGN KEY ("feeHeadId") REFERENCES "fee_heads"("id")
      ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_concessions_institutionId_fkey') THEN
    ALTER TABLE "fee_concessions"
      ADD CONSTRAINT "fee_concessions_institutionId_fkey"
      FOREIGN KEY ("institutionId") REFERENCES "institutions"("id")
      ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_concessions_invoiceId_fkey') THEN
    ALTER TABLE "fee_concessions"
      ADD CONSTRAINT "fee_concessions_invoiceId_fkey"
      FOREIGN KEY ("invoiceId") REFERENCES "fee_invoices"("id")
      ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_concessions_studentId_fkey') THEN
    ALTER TABLE "fee_concessions"
      ADD CONSTRAINT "fee_concessions_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_concessions_createdById_fkey') THEN
    ALTER TABLE "fee_concessions"
      ADD CONSTRAINT "fee_concessions_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_concessions_approvedById_fkey') THEN
    ALTER TABLE "fee_concessions"
      ADD CONSTRAINT "fee_concessions_approvedById_fkey"
      FOREIGN KEY ("approvedById") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_refunds_institutionId_fkey') THEN
    ALTER TABLE "fee_refunds"
      ADD CONSTRAINT "fee_refunds_institutionId_fkey"
      FOREIGN KEY ("institutionId") REFERENCES "institutions"("id")
      ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_refunds_paymentId_fkey') THEN
    ALTER TABLE "fee_refunds"
      ADD CONSTRAINT "fee_refunds_paymentId_fkey"
      FOREIGN KEY ("paymentId") REFERENCES "fee_payments"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_refunds_invoiceId_fkey') THEN
    ALTER TABLE "fee_refunds"
      ADD CONSTRAINT "fee_refunds_invoiceId_fkey"
      FOREIGN KEY ("invoiceId") REFERENCES "fee_invoices"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_refunds_studentId_fkey') THEN
    ALTER TABLE "fee_refunds"
      ADD CONSTRAINT "fee_refunds_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_refunds_requestedById_fkey') THEN
    ALTER TABLE "fee_refunds"
      ADD CONSTRAINT "fee_refunds_requestedById_fkey"
      FOREIGN KEY ("requestedById") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_refunds_approvedById_fkey') THEN
    ALTER TABLE "fee_refunds"
      ADD CONSTRAINT "fee_refunds_approvedById_fkey"
      FOREIGN KEY ("approvedById") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_refunds_processedById_fkey') THEN
    ALTER TABLE "fee_refunds"
      ADD CONSTRAINT "fee_refunds_processedById_fkey"
      FOREIGN KEY ("processedById") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_transactions_institutionId_fkey') THEN
    ALTER TABLE "fee_transactions"
      ADD CONSTRAINT "fee_transactions_institutionId_fkey"
      FOREIGN KEY ("institutionId") REFERENCES "institutions"("id")
      ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_transactions_studentId_fkey') THEN
    ALTER TABLE "fee_transactions"
      ADD CONSTRAINT "fee_transactions_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_transactions_invoiceId_fkey') THEN
    ALTER TABLE "fee_transactions"
      ADD CONSTRAINT "fee_transactions_invoiceId_fkey"
      FOREIGN KEY ("invoiceId") REFERENCES "fee_invoices"("id")
      ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_transactions_paymentId_fkey') THEN
    ALTER TABLE "fee_transactions"
      ADD CONSTRAINT "fee_transactions_paymentId_fkey"
      FOREIGN KEY ("paymentId") REFERENCES "fee_payments"("id")
      ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_transactions_createdById_fkey') THEN
    ALTER TABLE "fee_transactions"
      ADD CONSTRAINT "fee_transactions_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_receipts_institutionId_fkey') THEN
    ALTER TABLE "fee_receipts"
      ADD CONSTRAINT "fee_receipts_institutionId_fkey"
      FOREIGN KEY ("institutionId") REFERENCES "institutions"("id")
      ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_receipts_paymentId_fkey') THEN
    ALTER TABLE "fee_receipts"
      ADD CONSTRAINT "fee_receipts_paymentId_fkey"
      FOREIGN KEY ("paymentId") REFERENCES "fee_payments"("id")
      ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_receipts_invoiceId_fkey') THEN
    ALTER TABLE "fee_receipts"
      ADD CONSTRAINT "fee_receipts_invoiceId_fkey"
      FOREIGN KEY ("invoiceId") REFERENCES "fee_invoices"("id")
      ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_receipts_studentId_fkey') THEN
    ALTER TABLE "fee_receipts"
      ADD CONSTRAINT "fee_receipts_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_receipts_issuedById_fkey') THEN
    ALTER TABLE "fee_receipts"
      ADD CONSTRAINT "fee_receipts_issuedById_fkey"
      FOREIGN KEY ("issuedById") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
  END IF;
END $$;

-- CHECK constraints are also conditional so a legacy partial table can be
-- repaired without duplicate-constraint failures.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_invoice_items_amount_check') THEN
    ALTER TABLE "fee_invoice_items" ADD CONSTRAINT "fee_invoice_items_amount_check" CHECK ("amount" >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_concessions_amount_check') THEN
    ALTER TABLE "fee_concessions" ADD CONSTRAINT "fee_concessions_amount_check" CHECK ("amount" >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_refunds_amount_check') THEN
    ALTER TABLE "fee_refunds" ADD CONSTRAINT "fee_refunds_amount_check" CHECK ("amount" > 0) NOT VALID;
  END IF;
END $$;

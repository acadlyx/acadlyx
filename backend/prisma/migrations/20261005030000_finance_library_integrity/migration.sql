/*
  Production finance/library reconciliation layer.
  Backward-compatible: creates missing library/financial structures and
  adds only columns that are absent from the legacy ERP tables.
*/

CREATE TABLE IF NOT EXISTS "library_books" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "author" TEXT,
  "publisher" TEXT,
  "isbn" TEXT,
  "category" TEXT,
  "shelfLocation" TEXT,
  "totalCopies" INTEGER NOT NULL DEFAULT 1,
  "availableCopies" INTEGER NOT NULL DEFAULT 1,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "library_books_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "library_books_institutionId_isActive_idx" ON "library_books"("institutionId","isActive");
CREATE INDEX IF NOT EXISTS "library_books_institutionId_title_idx" ON "library_books"("institutionId","title");
CREATE INDEX IF NOT EXISTS "library_books_institutionId_isbn_idx" ON "library_books"("institutionId","isbn");

CREATE TABLE IF NOT EXISTS "library_issues" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "bookId" TEXT NOT NULL,
  "borrowerId" TEXT NOT NULL,
  "issuedById" TEXT,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "returnedAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'ISSUED',
  "fineAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "library_issues_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "library_issues_institutionId_borrowerId_status_idx" ON "library_issues"("institutionId","borrowerId","status");
CREATE INDEX IF NOT EXISTS "library_issues_institutionId_dueDate_status_idx" ON "library_issues"("institutionId","dueDate","status");
CREATE INDEX IF NOT EXISTS "library_issues_institutionId_bookId_status_idx" ON "library_issues"("institutionId","bookId","status");

CREATE TABLE IF NOT EXISTS "library_fines" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "issueId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "originalAmount" DECIMAL(14,2) NOT NULL,
  "waivedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OUTSTANDING',
  "requestedById" TEXT,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "waiverReason" TEXT,
  "financialInvoiceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "library_fines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "library_fines_issueId_type_key" UNIQUE ("issueId","type")
);

CREATE INDEX IF NOT EXISTS "library_fines_institutionId_studentId_status_idx" ON "library_fines"("institutionId","studentId","status");
CREATE INDEX IF NOT EXISTS "library_fines_institutionId_issueId_idx" ON "library_fines"("institutionId","issueId");
CREATE INDEX IF NOT EXISTS "library_fines_financialInvoiceId_idx" ON "library_fines"("financialInvoiceId");

ALTER TABLE "fee_invoices"
  ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "feeStructureId" TEXT,
  ADD COLUMN IF NOT EXISTS "academicYearId" TEXT,
  ADD COLUMN IF NOT EXISTS "semesterId" TEXT,
  ADD COLUMN IF NOT EXISTS "installmentNumber" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "grossAmount" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lateFeeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "refundedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS "notes" TEXT,
  ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "createdById" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceModule" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceType" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceEntityId" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceEventKey" TEXT,
  ADD COLUMN IF NOT EXISTS "libraryIssueId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "fee_invoices_institutionId_invoiceNumber_key" ON "fee_invoices"("institutionId","invoiceNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "fee_invoices_institutionId_sourceEventKey_key" ON "fee_invoices"("institutionId","sourceEventKey");
CREATE INDEX IF NOT EXISTS "fee_invoices_institutionId_academicYearId_status_createdAt_idx" ON "fee_invoices"("institutionId","academicYearId","status","createdAt");
CREATE INDEX IF NOT EXISTS "fee_invoices_institutionId_createdAt_idx" ON "fee_invoices"("institutionId","createdAt");

ALTER TABLE "fee_payments"
  ADD COLUMN IF NOT EXISTS "method" TEXT NOT NULL DEFAULT 'OFFLINE',
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'SUCCESS',
  ADD COLUMN IF NOT EXISTS "provider" TEXT,
  ADD COLUMN IF NOT EXISTS "providerOrderId" TEXT,
  ADD COLUMN IF NOT EXISTS "providerPaymentId" TEXT,
  ADD COLUMN IF NOT EXISTS "providerSignature" TEXT,
  ADD COLUMN IF NOT EXISTS "receiptNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "refundedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "reconciledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "recordedById" TEXT,
  ADD COLUMN IF NOT EXISTS "notes" TEXT,
  ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "fee_payments_institutionId_receiptNumber_key" ON "fee_payments"("institutionId","receiptNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "fee_payments_institutionId_idempotencyKey_key" ON "fee_payments"("institutionId","idempotencyKey");
CREATE INDEX IF NOT EXISTS "fee_payments_institutionId_status_paidAt_idx" ON "fee_payments"("institutionId","status","paidAt");

CREATE TABLE IF NOT EXISTS "fee_invoice_items" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "feeHeadId" TEXT,
  "description" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fee_invoice_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "fee_invoice_items_invoiceId_idx" ON "fee_invoice_items"("invoiceId");

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
CREATE INDEX IF NOT EXISTS "fee_transactions_institutionId_createdAt_idx" ON "fee_transactions"("institutionId","createdAt");
CREATE INDEX IF NOT EXISTS "fee_transactions_institutionId_studentId_idx" ON "fee_transactions"("institutionId","studentId");
CREATE INDEX IF NOT EXISTS "fee_transactions_institutionId_type_idx" ON "fee_transactions"("institutionId","type");

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
CREATE INDEX IF NOT EXISTS "fee_concessions_institutionId_studentId_status_idx" ON "fee_concessions"("institutionId","studentId","status");
CREATE INDEX IF NOT EXISTS "fee_concessions_institutionId_status_createdAt_idx" ON "fee_concessions"("institutionId","status","createdAt");
CREATE INDEX IF NOT EXISTS "fee_concessions_invoiceId_idx" ON "fee_concessions"("invoiceId");

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
CREATE INDEX IF NOT EXISTS "fee_refunds_institutionId_status_idx" ON "fee_refunds"("institutionId","status");
CREATE INDEX IF NOT EXISTS "fee_refunds_institutionId_status_createdAt_idx" ON "fee_refunds"("institutionId","status","createdAt");
CREATE INDEX IF NOT EXISTS "fee_refunds_paymentId_idx" ON "fee_refunds"("paymentId");
CREATE INDEX IF NOT EXISTS "fee_refunds_invoiceId_idx" ON "fee_refunds"("invoiceId");

CREATE TABLE IF NOT EXISTS "fee_receipts" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL UNIQUE,
  "invoiceId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "receiptNumber" TEXT NOT NULL,
  "issuedById" TEXT,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fee_receipts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "fee_receipts_institutionId_receiptNumber_key" ON "fee_receipts"("institutionId","receiptNumber");
CREATE INDEX IF NOT EXISTS "fee_receipts_institutionId_studentId_idx" ON "fee_receipts"("institutionId","studentId");
CREATE INDEX IF NOT EXISTS "fee_receipts_institutionId_issuedAt_idx" ON "fee_receipts"("institutionId","issuedAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='library_books_institutionId_fkey') THEN
    ALTER TABLE "library_books" ADD CONSTRAINT "library_books_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='library_issues_institutionId_fkey') THEN
    ALTER TABLE "library_issues" ADD CONSTRAINT "library_issues_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='library_issues_bookId_fkey') THEN
    ALTER TABLE "library_issues" ADD CONSTRAINT "library_issues_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "library_books"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='library_issues_borrowerId_fkey') THEN
    ALTER TABLE "library_issues" ADD CONSTRAINT "library_issues_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='library_fines_institutionId_fkey') THEN
    ALTER TABLE "library_fines" ADD CONSTRAINT "library_fines_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='library_fines_issueId_fkey') THEN
    ALTER TABLE "library_fines" ADD CONSTRAINT "library_fines_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "library_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='library_fines_studentId_fkey') THEN
    ALTER TABLE "library_fines" ADD CONSTRAINT "library_fines_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='library_fines_financialInvoiceId_fkey') THEN
    ALTER TABLE "library_fines" ADD CONSTRAINT "library_fines_financialInvoiceId_fkey" FOREIGN KEY ("financialInvoiceId") REFERENCES "fee_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fee_invoices_libraryIssueId_fkey') THEN
    ALTER TABLE "fee_invoices" ADD CONSTRAINT "fee_invoices_libraryIssueId_fkey" FOREIGN KEY ("libraryIssueId") REFERENCES "library_issues"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fee_invoices_feeStructureId_fkey') THEN
    ALTER TABLE "fee_invoices" ADD CONSTRAINT "fee_invoices_feeStructureId_fkey" FOREIGN KEY ("feeStructureId") REFERENCES "fee_structures"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fee_invoices_academicYearId_fkey') THEN
    ALTER TABLE "fee_invoices" ADD CONSTRAINT "fee_invoices_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fee_invoices_semesterId_fkey') THEN
    ALTER TABLE "fee_invoices" ADD CONSTRAINT "fee_invoices_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semesters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fee_invoice_items_invoiceId_fkey') THEN
    ALTER TABLE "fee_invoice_items" ADD CONSTRAINT "fee_invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "fee_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fee_invoice_items_feeHeadId_fkey') THEN
    ALTER TABLE "fee_invoice_items" ADD CONSTRAINT "fee_invoice_items_feeHeadId_fkey" FOREIGN KEY ("feeHeadId") REFERENCES "fee_heads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fee_transactions_institutionId_fkey') THEN
    ALTER TABLE "fee_transactions" ADD CONSTRAINT "fee_transactions_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fee_transactions_studentId_fkey') THEN
    ALTER TABLE "fee_transactions" ADD CONSTRAINT "fee_transactions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fee_transactions_invoiceId_fkey') THEN
    ALTER TABLE "fee_transactions" ADD CONSTRAINT "fee_transactions_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "fee_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fee_transactions_paymentId_fkey') THEN
    ALTER TABLE "fee_transactions" ADD CONSTRAINT "fee_transactions_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "fee_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fee_transactions_createdById_fkey') THEN
    ALTER TABLE "fee_transactions" ADD CONSTRAINT "fee_transactions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fee_concessions_institutionId_fkey') THEN
    ALTER TABLE "fee_concessions" ADD CONSTRAINT "fee_concessions_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fee_concessions_invoiceId_fkey') THEN
    ALTER TABLE "fee_concessions" ADD CONSTRAINT "fee_concessions_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "fee_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fee_concessions_studentId_fkey') THEN
    ALTER TABLE "fee_concessions" ADD CONSTRAINT "fee_concessions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fee_concessions_createdById_fkey') THEN
    ALTER TABLE "fee_concessions" ADD CONSTRAINT "fee_concessions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fee_refunds_institutionId_fkey') THEN
    ALTER TABLE "fee_refunds" ADD CONSTRAINT "fee_refunds_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fee_refunds_paymentId_fkey') THEN
    ALTER TABLE "fee_refunds" ADD CONSTRAINT "fee_refunds_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "fee_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fee_refunds_invoiceId_fkey') THEN
    ALTER TABLE "fee_refunds" ADD CONSTRAINT "fee_refunds_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "fee_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fee_refunds_studentId_fkey') THEN
    ALTER TABLE "fee_refunds" ADD CONSTRAINT "fee_refunds_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fee_refunds_requestedById_fkey') THEN
    ALTER TABLE "fee_refunds" ADD CONSTRAINT "fee_refunds_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fee_receipts_paymentId_fkey') THEN
    ALTER TABLE "fee_receipts" ADD CONSTRAINT "fee_receipts_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "fee_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fee_receipts_invoiceId_fkey') THEN
    ALTER TABLE "fee_receipts" ADD CONSTRAINT "fee_receipts_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "fee_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fee_receipts_studentId_fkey') THEN
    ALTER TABLE "fee_receipts" ADD CONSTRAINT "fee_receipts_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

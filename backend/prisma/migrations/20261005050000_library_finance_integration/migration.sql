-- ACADLYX ERP: connect the existing LibraryIssue model to the existing
-- canonical FeeInvoice ledger. LibraryBook/LibraryIssue already exist in the
-- ERP expansion migration; no second circulation schema is introduced.

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
  CONSTRAINT "library_fines_institution_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "library_fines_issue_fkey" FOREIGN KEY ("issueId") REFERENCES "library_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "library_fines_student_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "library_fines_invoice_fkey" FOREIGN KEY ("financialInvoiceId") REFERENCES "fee_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "library_fines_issue_type_key" ON "library_fines"("issueId","type");
CREATE INDEX IF NOT EXISTS "library_fines_institution_student_status_idx" ON "library_fines"("institutionId","studentId","status");
CREATE INDEX IF NOT EXISTS "library_fines_institution_issue_idx" ON "library_fines"("institutionId","issueId");
CREATE INDEX IF NOT EXISTS "library_fines_financial_invoice_idx" ON "library_fines"("financialInvoiceId");

ALTER TABLE "fee_invoices"
  ADD COLUMN IF NOT EXISTS "sourceModule" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceType" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceEntityId" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceEventKey" TEXT,
  ADD COLUMN IF NOT EXISTS "libraryIssueId" TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_invoices_library_issue_fkey') THEN
    ALTER TABLE "fee_invoices"
      ADD CONSTRAINT "fee_invoices_library_issue_fkey"
      FOREIGN KEY ("libraryIssueId") REFERENCES "library_issues"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "fee_invoices_institution_source_event_key"
  ON "fee_invoices"("institutionId","sourceEventKey");
CREATE INDEX IF NOT EXISTS "fee_invoices_institution_source_idx"
  ON "fee_invoices"("institutionId","sourceModule","sourceType");
CREATE INDEX IF NOT EXISTS "fee_invoices_library_issue_idx"
  ON "fee_invoices"("libraryIssueId");

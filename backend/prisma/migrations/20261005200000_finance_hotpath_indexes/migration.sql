-- Finance command-center and list-page hot paths.
CREATE INDEX IF NOT EXISTS "fee_invoices_institution_academic_status_created_idx"
  ON "fee_invoices" ("institutionId", "academicYearId", "status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "fee_invoices_institution_created_idx"
  ON "fee_invoices" ("institutionId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "fee_payments_institution_status_paid_idx"
  ON "fee_payments" ("institutionId", "status", "paidAt" DESC);
CREATE INDEX IF NOT EXISTS "fee_payments_institution_paid_idx"
  ON "fee_payments" ("institutionId", "paidAt" DESC);
CREATE INDEX IF NOT EXISTS "fee_receipts_institution_issued_idx"
  ON "fee_receipts" ("institutionId", "issuedAt" DESC);
CREATE INDEX IF NOT EXISTS "fee_refunds_institution_status_created_idx"
  ON "fee_refunds" ("institutionId", "status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "fee_concessions_institution_status_created_idx"
  ON "fee_concessions" ("institutionId", "status", "createdAt" DESC);

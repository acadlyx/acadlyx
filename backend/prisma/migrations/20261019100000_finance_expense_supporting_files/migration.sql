-- Link privately stored tenant files to expenses, while retaining legacy external URLs.
ALTER TABLE "finance_expenses" ADD COLUMN IF NOT EXISTS "supportingDocumentFileId" TEXT;
ALTER TABLE "finance_expenses"
  ADD CONSTRAINT "finance_expenses_supportingDocumentFileId_fkey"
  FOREIGN KEY ("supportingDocumentFileId") REFERENCES "file_assets"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "finance_expenses_supportingDocumentFileId_idx"
  ON "finance_expenses"("supportingDocumentFileId");

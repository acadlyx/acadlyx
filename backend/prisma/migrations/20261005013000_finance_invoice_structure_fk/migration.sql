DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fee_invoices_feeStructureId_fkey'
      AND conrelid = '"fee_invoices"'::regclass
  ) THEN
    ALTER TABLE "fee_invoices"
      ADD CONSTRAINT "fee_invoices_feeStructureId_fkey"
      FOREIGN KEY ("feeStructureId") REFERENCES "fee_structures"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Validate legacy fee-domain constraints after confirming the live data has no orphaned
-- references or negative monetary values. No rows are modified by this migration.
ALTER TABLE "fee_concessions" VALIDATE CONSTRAINT "fee_concessions_amount_check";
ALTER TABLE "fee_concessions" VALIDATE CONSTRAINT "fee_concessions_approvedById_fkey";
ALTER TABLE "fee_concessions" VALIDATE CONSTRAINT "fee_concessions_createdById_fkey";
ALTER TABLE "fee_concessions" VALIDATE CONSTRAINT "fee_concessions_invoiceId_fkey";

ALTER TABLE "fee_refunds" VALIDATE CONSTRAINT "fee_refunds_approvedById_fkey";
ALTER TABLE "fee_refunds" VALIDATE CONSTRAINT "fee_refunds_invoiceId_fkey";
ALTER TABLE "fee_refunds" VALIDATE CONSTRAINT "fee_refunds_paymentId_fkey";
ALTER TABLE "fee_refunds" VALIDATE CONSTRAINT "fee_refunds_processedById_fkey";
ALTER TABLE "fee_refunds" VALIDATE CONSTRAINT "fee_refunds_requestedById_fkey";
ALTER TABLE "fee_refunds" VALIDATE CONSTRAINT "fee_refunds_studentId_fkey";

ALTER TABLE "fee_invoice_items" VALIDATE CONSTRAINT "fee_invoice_items_amount_check";
ALTER TABLE "fee_invoice_items" VALIDATE CONSTRAINT "fee_invoice_items_feeHeadId_fkey";
ALTER TABLE "fee_invoice_items" VALIDATE CONSTRAINT "fee_invoice_items_invoiceId_fkey";

ALTER TABLE "fee_transactions" VALIDATE CONSTRAINT "fee_transactions_createdById_fkey";
ALTER TABLE "fee_transactions" VALIDATE CONSTRAINT "fee_transactions_institutionId_fkey";
ALTER TABLE "fee_transactions" VALIDATE CONSTRAINT "fee_transactions_invoiceId_fkey";
ALTER TABLE "fee_transactions" VALIDATE CONSTRAINT "fee_transactions_paymentId_fkey";
ALTER TABLE "fee_transactions" VALIDATE CONSTRAINT "fee_transactions_studentId_fkey";

ALTER TABLE "fee_receipts" VALIDATE CONSTRAINT "fee_receipts_institutionId_fkey";
ALTER TABLE "fee_receipts" VALIDATE CONSTRAINT "fee_receipts_invoiceId_fkey";
ALTER TABLE "fee_receipts" VALIDATE CONSTRAINT "fee_receipts_issuedById_fkey";
ALTER TABLE "fee_receipts" VALIDATE CONSTRAINT "fee_receipts_paymentId_fkey";
ALTER TABLE "fee_receipts" VALIDATE CONSTRAINT "fee_receipts_studentId_fkey";

/*
  Remove duplicate indexes introduced by the two historical library/finance
  reconciliation migrations. The canonical Prisma index names remain in place.
*/
DROP INDEX IF EXISTS "library_fines_institution_student_status_idx";
DROP INDEX IF EXISTS "library_fines_institution_issue_idx";
DROP INDEX IF EXISTS "library_fines_financial_invoice_idx";

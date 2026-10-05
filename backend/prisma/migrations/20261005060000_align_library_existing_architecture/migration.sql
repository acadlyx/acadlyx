-- Correct the initial library-finance migration to preserve the repository's
-- existing aggregate-copy circulation model. No second copy/reservation
-- subsystem is retained.
ALTER TABLE "library_books"
  ADD COLUMN IF NOT EXISTS "totalCopies" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "availableCopies" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "library_issues"
  ADD COLUMN IF NOT EXISTS "issuedById" TEXT,
  ADD COLUMN IF NOT EXISTS "fineAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "note" TEXT;
ALTER TABLE "library_issues" DROP COLUMN IF EXISTS "copyId";
DROP TABLE IF EXISTS "library_reservations";
DROP TABLE IF EXISTS "library_copies";
ALTER TABLE "library_books"
  DROP COLUMN IF EXISTS "description";
ALTER TABLE "library_issues"
  DROP COLUMN IF EXISTS "notes";

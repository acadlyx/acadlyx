-- ACADLYX Library enterprise circulation model.
-- Adds physical-copy inventory and persisted policy/transaction terms.
-- Backward compatible: existing aggregate LibraryBook/LibraryIssue rows are
-- retained and existing copies are materialized from current stock.

CREATE TABLE "library_policies" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "name" TEXT NOT NULL DEFAULT 'Default Library Policy',
  "maxActiveLoans" INTEGER NOT NULL DEFAULT 5,
  "defaultLoanDays" INTEGER NOT NULL DEFAULT 14,
  "maxRenewals" INTEGER NOT NULL DEFAULT 2,
  "gracePeriodDays" INTEGER NOT NULL DEFAULT 0,
  "dailyFine" DOUBLE PRECISION NOT NULL DEFAULT 5,
  "fineCap" DOUBLE PRECISION NOT NULL DEFAULT 200,
  "lostChargeType" TEXT NOT NULL DEFAULT 'REPLACEMENT_VALUE',
  "lostAdministrativeCharge" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "damagedChargeType" TEXT NOT NULL DEFAULT 'PERCENTAGE',
  "damagedChargePercent" DOUBLE PRECISION NOT NULL DEFAULT 25,
  "damagedFixedCharge" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "reservationHoldDays" INTEGER NOT NULL DEFAULT 3,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "library_policies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "library_policies_institutionId_key" UNIQUE ("institutionId"),
  CONSTRAINT "library_policies_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "library_book_copies" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "bookId" TEXT NOT NULL,
  "accessionNumber" TEXT NOT NULL,
  "barcode" TEXT,
  "location" TEXT,
  "shelf" TEXT,
  "acquisitionDate" TIMESTAMP(3),
  "acquisitionCost" DOUBLE PRECISION,
  "replacementValue" DOUBLE PRECISION,
  "currentValue" DOUBLE PRECISION,
  "condition" TEXT NOT NULL DEFAULT 'GOOD',
  "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "library_book_copies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "library_book_copies_bookId_fkey"
    FOREIGN KEY ("bookId") REFERENCES "library_books"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "library_book_copies_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "library_book_copies_institutionId_accessionNumber_key"
    UNIQUE ("institutionId","accessionNumber"),
  CONSTRAINT "library_book_copies_institutionId_barcode_key"
    UNIQUE ("institutionId","barcode")
);

CREATE INDEX "library_book_copies_institutionId_bookId_status_idx"
  ON "library_book_copies"("institutionId","bookId","status");
CREATE INDEX "library_book_copies_institutionId_status_idx"
  ON "library_book_copies"("institutionId","status");

ALTER TABLE "library_books"
  ADD COLUMN "defaultAcquisitionCost" DOUBLE PRECISION,
  ADD COLUMN "defaultReplacementValue" DOUBLE PRECISION,
  ADD COLUMN "defaultCurrentValue" DOUBLE PRECISION,
  ADD COLUMN "defaultLoanDays" INTEGER,
  ADD COLUMN "defaultMaxRenewals" INTEGER,
  ADD COLUMN "defaultFinePerDay" DOUBLE PRECISION,
  ADD COLUMN "defaultFineCap" DOUBLE PRECISION,
  ADD COLUMN "defaultGracePeriodDays" INTEGER;

ALTER TABLE "library_issues"
  ADD COLUMN "copyId" TEXT,
  ADD COLUMN "loanPeriodDays" INTEGER,
  ADD COLUMN "renewalsAllowed" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "renewalsUsed" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "finePerDay" DOUBLE PRECISION,
  ADD COLUMN "fineCap" DOUBLE PRECISION,
  ADD COLUMN "gracePeriodDays" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "finePolicySource" TEXT,
  ADD COLUMN "originalDueDate" TIMESTAMP(3),
  ADD COLUMN "lostChargeAmount" DOUBLE PRECISION,
  ADD COLUMN "damagedChargeAmount" DOUBLE PRECISION;

ALTER TABLE "library_issues"
  ADD CONSTRAINT "library_issues_copyId_fkey"
  FOREIGN KEY ("copyId") REFERENCES "library_book_copies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "library_issues_institutionId_copyId_idx"
  ON "library_issues"("institutionId","copyId");

-- One explicit policy per tenant. These are configurable institutional defaults,
-- not hidden constants in application code.
INSERT INTO "library_policies" ("id","institutionId")
SELECT gen_random_uuid()::text, "id"
FROM "institutions"
ON CONFLICT ("institutionId") DO NOTHING;

-- Materialize the current aggregate stock as physical copies. Existing
-- aggregate totals are preserved; copies become the authoritative inventory
-- representation for new circulation transactions.
INSERT INTO "library_book_copies"
  ("id","institutionId","bookId","accessionNumber","location","shelf","acquisitionCost","replacementValue","currentValue","status")
SELECT
  gen_random_uuid()::text,
  b."institutionId",
  b."id",
  'ACC-' || upper(substr(replace(b."id",'-',''),1,8)) || '-' || lpad(gs::text,5,'0'),
  b."shelfLocation",
  b."shelfLocation",
  b."defaultAcquisitionCost",
  b."defaultReplacementValue",
  b."defaultCurrentValue",
  'AVAILABLE'
FROM "library_books" b
CROSS JOIN LATERAL generate_series(1, GREATEST(b."totalCopies",0)) gs;

-- Link existing active loans to distinct physical copies.
WITH active_issues AS (
  SELECT i."id", i."bookId", i."status",
         row_number() OVER (PARTITION BY i."bookId" ORDER BY i."issuedAt", i."id") AS rn
  FROM "library_issues" i
  WHERE i."status" IN ('ISSUED','RESERVED')
    AND i."copyId" IS NULL
),
ranked_copies AS (
  SELECT c."id", c."bookId",
         row_number() OVER (PARTITION BY c."bookId" ORDER BY c."accessionNumber") AS rn
  FROM "library_book_copies" c
)
UPDATE "library_issues" i
SET "copyId" = rc."id"
FROM active_issues ai
JOIN ranked_copies rc ON rc."bookId" = ai."bookId" AND rc.rn = ai.rn
WHERE i."id" = ai."id";

UPDATE "library_book_copies" c
SET "status" = CASE WHEN i."status" = 'RESERVED' THEN 'RESERVED' ELSE 'ISSUED' END
FROM "library_issues" i
WHERE i."copyId" = c."id";

UPDATE "library_book_copies" c
SET "condition" = CASE
  WHEN i."status" = 'DAMAGED' THEN 'DAMAGED'
  WHEN i."status" = 'LOST' THEN 'LOST'
  ELSE c."condition"
END
FROM "library_issues" i
WHERE i."copyId" = c."id";

-- Backfill transaction terms from the tenant policy and preserve each loan's
-- existing due date as its historical agreed return date.
UPDATE "library_issues" i
SET
  "loanPeriodDays" = GREATEST(1, CEIL(EXTRACT(EPOCH FROM (i."dueDate" - i."issuedAt")) / 86400.0)::integer),
  "renewalsAllowed" = p."maxRenewals",
  "finePerDay" = p."dailyFine",
  "fineCap" = p."fineCap",
  "gracePeriodDays" = p."gracePeriodDays",
  "finePolicySource" = 'INSTITUTION',
  "originalDueDate" = i."dueDate"
FROM "library_policies" p
WHERE p."institutionId" = i."institutionId";

-- Reconcile the aggregate counters with actual materialized copy states.
UPDATE "library_books" b
SET
  "totalCopies" = COALESCE(stats.total_count,0),
  "availableCopies" = COALESCE(stats.available_count,0)
FROM (
  SELECT "bookId",
         count(*) FILTER (WHERE "status" <> 'WITHDRAWN') AS total_count,
         count(*) FILTER (WHERE "status" = 'AVAILABLE') AS available_count
  FROM "library_book_copies"
  GROUP BY "bookId"
) stats
WHERE b."id" = stats."bookId";


CREATE TABLE "library_loan_renewals" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "issueId" TEXT NOT NULL,
  "previousDueDate" TIMESTAMP(3) NOT NULL,
  "newDueDate" TIMESTAMP(3) NOT NULL,
  "renewedById" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "library_loan_renewals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "library_loan_renewals_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "library_loan_renewals_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "library_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "library_loan_renewals_renewedById_fkey" FOREIGN KEY ("renewedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "library_loan_renewals_institutionId_issueId_createdAt_idx" ON "library_loan_renewals"("institutionId","issueId","createdAt");

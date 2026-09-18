-- M5-A: Production fee heads and fee structures.
--
-- These tables intentionally remain independent from the existing
-- FeeInvoice/FeePayment Prisma models in this migration.
-- The application accesses them through parameterized Prisma SQL.
--
-- This avoids changing existing production invoice/payment behavior
-- while introducing the fee configuration layer.

CREATE TABLE "fee_heads" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "fee_heads_pkey" PRIMARY KEY ("id"),

  CONSTRAINT "fee_heads_institutionId_fkey"
    FOREIGN KEY ("institutionId")
    REFERENCES "institutions"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "fee_heads_institutionId_code_key"
  ON "fee_heads"("institutionId", "code");

CREATE INDEX "fee_heads_institutionId_isActive_idx"
  ON "fee_heads"("institutionId", "isActive");

CREATE INDEX "fee_heads_institutionId_name_idx"
  ON "fee_heads"("institutionId", "name");


CREATE TABLE "fee_structures" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "academicYearId" TEXT,
  "programId" TEXT,
  "semesterId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "notes" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "fee_structures_pkey" PRIMARY KEY ("id"),

  CONSTRAINT "fee_structures_institutionId_fkey"
    FOREIGN KEY ("institutionId")
    REFERENCES "institutions"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT "fee_structures_academicYearId_fkey"
    FOREIGN KEY ("academicYearId")
    REFERENCES "academic_years"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  CONSTRAINT "fee_structures_programId_fkey"
    FOREIGN KEY ("programId")
    REFERENCES "programs"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  CONSTRAINT "fee_structures_semesterId_fkey"
    FOREIGN KEY ("semesterId")
    REFERENCES "semesters"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  CONSTRAINT "fee_structures_createdById_fkey"
    FOREIGN KEY ("createdById")
    REFERENCES "users"("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE
);

CREATE INDEX "fee_structures_institutionId_status_idx"
  ON "fee_structures"("institutionId", "status");

CREATE INDEX "fee_structures_institutionId_academicYearId_idx"
  ON "fee_structures"("institutionId", "academicYearId");

CREATE INDEX "fee_structures_institutionId_programId_idx"
  ON "fee_structures"("institutionId", "programId");

CREATE INDEX "fee_structures_institutionId_semesterId_idx"
  ON "fee_structures"("institutionId", "semesterId");


CREATE TABLE "fee_structure_items" (
  "id" TEXT NOT NULL,
  "feeStructureId" TEXT NOT NULL,
  "feeHeadId" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "dueDays" INTEGER,
  "installmentNumber" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "fee_structure_items_pkey" PRIMARY KEY ("id"),

  CONSTRAINT "fee_structure_items_feeStructureId_fkey"
    FOREIGN KEY ("feeStructureId")
    REFERENCES "fee_structures"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT "fee_structure_items_feeHeadId_fkey"
    FOREIGN KEY ("feeHeadId")
    REFERENCES "fee_heads"("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT "fee_structure_items_amount_check"
    CHECK ("amount" > 0),

  CONSTRAINT "fee_structure_items_dueDays_check"
    CHECK ("dueDays" IS NULL OR "dueDays" >= 0),

  CONSTRAINT "fee_structure_items_installmentNumber_check"
    CHECK ("installmentNumber" > 0)
);

CREATE UNIQUE INDEX "fee_structure_items_structure_head_installment_key"
  ON "fee_structure_items"(
    "feeStructureId",
    "feeHeadId",
    "installmentNumber"
  );

CREATE INDEX "fee_structure_items_feeStructureId_idx"
  ON "fee_structure_items"("feeStructureId");

CREATE INDEX "fee_structure_items_feeHeadId_idx"
  ON "fee_structure_items"("feeHeadId");


-- Keep updatedAt correct for direct SQL updates.

CREATE OR REPLACE FUNCTION "update_fee_heads_updated_at"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "fee_heads_updated_at_trigger"
BEFORE UPDATE ON "fee_heads"
FOR EACH ROW
EXECUTE FUNCTION "update_fee_heads_updated_at"();


CREATE OR REPLACE FUNCTION "update_fee_structures_updated_at"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "fee_structures_updated_at_trigger"
BEFORE UPDATE ON "fee_structures"
FOR EACH ROW
EXECUTE FUNCTION "update_fee_structures_updated_at"();


CREATE OR REPLACE FUNCTION "update_fee_structure_items_updated_at"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "fee_structure_items_updated_at_trigger"
BEFORE UPDATE ON "fee_structure_items"
FOR EACH ROW
EXECUTE FUNCTION "update_fee_structure_items_updated_at"();

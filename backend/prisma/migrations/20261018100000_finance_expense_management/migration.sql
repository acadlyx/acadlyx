-- Tenant-scoped expense register and immutable status history.
CREATE TABLE IF NOT EXISTS "finance_expenses" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "institutionId" TEXT NOT NULL REFERENCES "institutions"("id") ON DELETE CASCADE,
  "category" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL CHECK ("amount" > 0),
  "vendor" TEXT,
  "reference" TEXT,
  "spentAt" TIMESTAMP(3) NOT NULL,
  "supportDetails" TEXT,
  "supportingDocumentUrl" TEXT,
  "campusId" TEXT,
  "departmentId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING','APPROVED','REJECTED')),
  "createdById" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "updatedById" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
  "approvedById" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
  "decisionComment" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "finance_expense_status_history" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "institutionId" TEXT NOT NULL REFERENCES "institutions"("id") ON DELETE CASCADE,
  "expenseId" TEXT NOT NULL REFERENCES "finance_expenses"("id") ON DELETE CASCADE,
  "fromStatus" TEXT,
  "toStatus" TEXT NOT NULL CHECK ("toStatus" IN ('PENDING','APPROVED','REJECTED')),
  "comment" TEXT,
  "changedById" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "finance_expenses_institution_status_spentAt_idx" ON "finance_expenses"("institutionId","status","spentAt" DESC);
CREATE INDEX IF NOT EXISTS "finance_expenses_institution_category_idx" ON "finance_expenses"("institutionId","category");
CREATE INDEX IF NOT EXISTS "finance_expenses_campus_status_idx" ON "finance_expenses"("campusId","status");
CREATE INDEX IF NOT EXISTS "finance_expenses_department_status_idx" ON "finance_expenses"("departmentId","status");
CREATE INDEX IF NOT EXISTS "finance_expense_status_history_expense_createdAt_idx" ON "finance_expense_status_history"("expenseId","createdAt" DESC);
CREATE INDEX IF NOT EXISTS "finance_expense_status_history_institution_createdAt_idx" ON "finance_expense_status_history"("institutionId","createdAt" DESC);

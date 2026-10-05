-- ACADLYX ERP: canonical library circulation + financial source integration.
CREATE TABLE IF NOT EXISTS "library_books" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "author" TEXT,
  "publisher" TEXT,
  "isbn" TEXT,
  "category" TEXT,
  "shelfLocation" TEXT,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "library_books_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "library_books_institution_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "library_books_institution_active_idx" ON "library_books"("institutionId","isActive");
CREATE INDEX IF NOT EXISTS "library_books_institution_title_idx" ON "library_books"("institutionId","title");
CREATE INDEX IF NOT EXISTS "library_books_institution_isbn_idx" ON "library_books"("institutionId","isbn");

CREATE TABLE IF NOT EXISTS "library_copies" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "bookId" TEXT NOT NULL,
  "accessionNumber" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
  "condition" TEXT NOT NULL DEFAULT 'GOOD',
  "acquiredAt" TIMESTAMP(3),
  "price" DECIMAL(14,2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "library_copies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "library_copies_institution_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "library_copies_book_fkey" FOREIGN KEY ("bookId") REFERENCES "library_books"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "library_copies_institution_accession_key" ON "library_copies"("institutionId","accessionNumber");
CREATE INDEX IF NOT EXISTS "library_copies_institution_book_status_idx" ON "library_copies"("institutionId","bookId","status");

CREATE TABLE IF NOT EXISTS "library_issues" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "bookId" TEXT NOT NULL,
  "copyId" TEXT,
  "borrowerId" TEXT NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "returnedAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'ISSUED',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "library_issues_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "library_issues_institution_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "library_issues_book_fkey" FOREIGN KEY ("bookId") REFERENCES "library_books"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "library_issues_copy_fkey" FOREIGN KEY ("copyId") REFERENCES "library_copies"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "library_issues_borrower_fkey" FOREIGN KEY ("borrowerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "library_issues_institution_borrower_status_idx" ON "library_issues"("institutionId","borrowerId","status");
CREATE INDEX IF NOT EXISTS "library_issues_institution_due_status_idx" ON "library_issues"("institutionId","dueDate","status");
CREATE INDEX IF NOT EXISTS "library_issues_institution_book_status_idx" ON "library_issues"("institutionId","bookId","status");

CREATE TABLE IF NOT EXISTS "library_reservations" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "bookId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "issueId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "cancelledAt" TIMESTAMP(3),
  "fulfilledAt" TIMESTAMP(3),
  CONSTRAINT "library_reservations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "library_reservations_institution_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "library_reservations_book_fkey" FOREIGN KEY ("bookId") REFERENCES "library_books"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "library_reservations_member_fkey" FOREIGN KEY ("memberId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "library_reservations_issue_fkey" FOREIGN KEY ("issueId") REFERENCES "library_issues"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "library_reservations_institution_member_status_idx" ON "library_reservations"("institutionId","memberId","status");
CREATE INDEX IF NOT EXISTS "library_reservations_institution_book_status_idx" ON "library_reservations"("institutionId","bookId","status");

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

ALTER TABLE "fee_invoices"
  ADD COLUMN IF NOT EXISTS "sourceModule" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceType" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceEntityId" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceEventKey" TEXT,
  ADD COLUMN IF NOT EXISTS "libraryIssueId" TEXT;
DO $ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_invoices_library_issue_fkey') THEN ALTER TABLE "fee_invoices" ADD CONSTRAINT "fee_invoices_library_issue_fkey" FOREIGN KEY ("libraryIssueId") REFERENCES "library_issues"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $;
CREATE UNIQUE INDEX IF NOT EXISTS "fee_invoices_institution_source_event_key" ON "fee_invoices"("institutionId","sourceEventKey");
CREATE INDEX IF NOT EXISTS "fee_invoices_institution_source_idx" ON "fee_invoices"("institutionId","sourceModule","sourceType");
CREATE INDEX IF NOT EXISTS "fee_invoices_library_issue_idx" ON "fee_invoices"("libraryIssueId");


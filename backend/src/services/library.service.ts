import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { PaginationParams } from "../utils/pagination";
import { round2 } from "../utils/http";
import { recordAuditLog } from "./audit.service";
import {
  CreateBookInput,
  IssueBookInput,
  ReturnBookInput,
  UpdateBookInput,
  RenewLoanInput,
  LibraryPolicyInput,
  UpdateCopyInput,
} from "../validators/library.validators";

type Meta = { ipAddress?: string; userAgent?: string };

/** Institution-wide circulation policy. Kept here so both issue and
 *  return paths compute identical numbers. */
type LoanPolicy = {
  maxActiveLoans: number;
  defaultLoanDays: number;
  maxRenewals: number;
  gracePeriodDays: number;
  dailyFine: number;
  fineCap: number;
  lostChargeType: string;
  lostAdministrativeCharge: number;
  damagedChargeType: string;
  damagedChargePercent: number;
  damagedFixedCharge: number;
  reservationHoldDays: number;
};

const issueInclude = {
  book: { select: { id: true, title: true, author: true, isbn: true, defaultReplacementValue: true, defaultCurrentValue: true } },
  copy: { select: { id: true, accessionNumber: true, barcode: true, acquisitionCost: true, replacementValue: true, currentValue: true, condition: true, status: true, location: true, shelf: true } },
  borrower: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  fines: {
    include: {
      financialInvoice: {
        select: { id: true, amount: true, paidAmount: true, status: true },
      },
    },
  },
} satisfies Prisma.LibraryIssueInclude;

function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 86_400_000);
}

function startOfDay(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
  );
}

export function computeFine(
  dueDate: Date,
  policy: Pick<LoanPolicy, "dailyFine" | "fineCap" | "gracePeriodDays">,
  on: Date = new Date()
): number {
  const overdueDays = Math.floor(
    (startOfDay(on).getTime() - startOfDay(dueDate).getTime()) / 86_400_000
  ) - policy.gracePeriodDays;
  if (overdueDays <= 0) return 0;
  return round2(Math.min(overdueDays * policy.dailyFine, policy.fineCap));
}

function shape(row: Prisma.LibraryIssueGetPayload<{ include: typeof issueInclude }>) {
  const accrued =
    row.status === "ISSUED" && row.finePerDay !== null
      ? computeFine(row.dueDate, {
          dailyFine: row.finePerDay,
          fineCap: row.fineCap ?? Number.MAX_SAFE_INTEGER,
          gracePeriodDays: row.gracePeriodDays,
        })
      : row.fineAmount;
  return {
    ...row,
    accruedFine: accrued,
    isOverdue: row.status === "ISSUED" && row.dueDate.getTime() < Date.now(),
    financialBalance: round2(row.fines.reduce((sum, fine) => {
      const invoice = fine.financialInvoice;
      if (!invoice) return sum;
      return sum + Math.max(0, Number(invoice.amount) - Number(invoice.paidAmount ?? 0));
    }, 0)),
  };
}

async function getLibraryPolicy(tx: Prisma.TransactionClient | typeof prisma, institutionId: string): Promise<LoanPolicy> {
  return tx.libraryPolicy.upsert({
    where: { institutionId },
    update: {},
    create: { institutionId },
  });
}

export async function syncBookInventory(tx: Prisma.TransactionClient, institutionId: string, bookId: string) {
  const [totalCopies, availableCopies] = await Promise.all([
    tx.libraryBookCopy.count({ where: { institutionId, bookId, status: { not: "WITHDRAWN" } } }),
    tx.libraryBookCopy.count({ where: { institutionId, bookId, status: "AVAILABLE" } }),
  ]);
  await tx.libraryBook.update({ where: { id: bookId }, data: { totalCopies, availableCopies } });
}

export function calculateLostCharge(
  copy: { currentValue: number | null; replacementValue: number | null; acquisitionCost: number | null } | null,
  book: { defaultReplacementValue: number | null; defaultCurrentValue: number | null },
  policy: LoanPolicy
): number {
  if (policy.lostChargeType === "FIXED") return round2(policy.lostAdministrativeCharge);
  const value = policy.lostChargeType === "CURRENT_VALUE"
    ? (copy?.currentValue ?? book.defaultCurrentValue)
    : (copy?.replacementValue ?? book.defaultReplacementValue ?? copy?.currentValue ?? book.defaultCurrentValue ?? copy?.acquisitionCost);
  if (value === null || value === undefined) throw new AppError("A configured replacement/current value is required before a lost-book charge can be created", 422);
  return round2(value + policy.lostAdministrativeCharge);
}

export function calculateDamagedCharge(
  copy: { currentValue: number | null; replacementValue: number | null } | null,
  book: { defaultReplacementValue: number | null },
  policy: LoanPolicy
): number {
  if (policy.damagedChargeType === "NONE") return 0;
  if (policy.damagedChargeType === "FIXED") return round2(policy.damagedFixedCharge);
  const value = copy?.replacementValue ?? copy?.currentValue ?? book.defaultReplacementValue;
  if (value === null || value === undefined) {
    throw new AppError("Replacement value is required before a percentage damage charge can be created", 422);
  }
  return round2(value * policy.damagedChargePercent / 100);
}

/* ---------------------------------------------------------------- catalogue */

export async function listBooks(
  institutionId: string,
  pagination: PaginationParams,
  filters: { search?: string; category?: string; availableOnly?: boolean }
) {
  const where: Prisma.LibraryBookWhereInput = {
    institutionId,
    isActive: true,
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.availableOnly ? { availableCopies: { gt: 0 } } : {}),
    ...(filters.search
      ? {
          OR: [
            { title: { contains: filters.search, mode: "insensitive" } },
            { author: { contains: filters.search, mode: "insensitive" } },
            { isbn: { contains: filters.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total, categories] = await Promise.all([
    prisma.libraryBook.findMany({
      where,
      orderBy: { title: "asc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.libraryBook.count({ where }),
    prisma.libraryBook.findMany({
      where: { institutionId, isActive: true, category: { not: null } },
      select: { category: true },
      distinct: ["category"],
      take: 100,
    }),
  ]);

  return {
    items,
    total,
    categories: categories
      .map((row) => row.category)
      .filter((value): value is string => Boolean(value))
      .sort(),
  };
}

export async function getBook(institutionId: string, id: string) {
  const book = await prisma.libraryBook.findFirst({
    where: { id, institutionId },
  });
  if (!book) throw new AppError("Book not found", 404);

  const activeIssues = await prisma.libraryIssue.findMany({
    where: { institutionId, bookId: id, status: { in: ["ISSUED", "RESERVED"] } },
    include: issueInclude,
    orderBy: { issuedAt: "desc" },
    take: 50,
  });

  return { ...book, activeIssues: activeIssues.map(shape) };
}

export async function createBook(
  institutionId: string,
  actor: AuthenticatedUser,
  input: CreateBookInput,
  meta: Meta
) {
  if (input.isbn) {
    const clash = await prisma.libraryBook.findFirst({
      where: { institutionId, isbn: input.isbn },
      select: { id: true },
    });
    if (clash) throw new AppError("A book with this ISBN already exists", 409);
  }

  const book = await prisma.$transaction(async (tx) => {
    const created = await tx.libraryBook.create({
      data: {
        institutionId,
        title: input.title,
        author: input.author,
        isbn: input.isbn ?? null,
        category: input.category ?? null,
        publisher: input.publisher ?? null,
        shelfLocation: input.shelfLocation ?? null,
        totalCopies: input.totalCopies,
        availableCopies: input.totalCopies,
        defaultAcquisitionCost: input.defaultAcquisitionCost ?? null,
        defaultReplacementValue: input.defaultReplacementValue ?? null,
        defaultCurrentValue: input.defaultCurrentValue ?? input.defaultReplacementValue ?? null,
        defaultLoanDays: input.defaultLoanDays ?? null,
        defaultMaxRenewals: input.defaultMaxRenewals ?? null,
        defaultFinePerDay: input.defaultFinePerDay ?? null,
        defaultFineCap: input.defaultFineCap ?? null,
        defaultGracePeriodDays: input.defaultGracePeriodDays ?? null,
      },
    });
    await tx.libraryBookCopy.createMany({
      data: Array.from({ length: input.totalCopies }, (_, index) => ({
        institutionId,
        bookId: created.id,
        accessionNumber: `ACC-${created.id.slice(0, 8).toUpperCase()}-${String(index + 1).padStart(5, "0")}`,
        location: input.shelfLocation ?? null,
        shelf: input.shelfLocation ?? null,
        acquisitionCost: input.defaultAcquisitionCost ?? null,
        currentValue: input.defaultCurrentValue ?? input.defaultReplacementValue ?? null,
      })),
    });
    return created;
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "library.book.create",
    entityType: "LibraryBook",
    entityId: book.id,
    metadata: { title: book.title, totalCopies: book.totalCopies },
    ...meta,
  });

  return book;
}

export async function updateBook(
  institutionId: string,
  actor: AuthenticatedUser,
  id: string,
  input: UpdateBookInput,
  meta: Meta
) {
  const existing = await prisma.libraryBook.findFirst({
    where: { id, institutionId },
  });
  if (!existing) throw new AppError("Book not found", 404);

  if (input.isbn && input.isbn !== existing.isbn) {
    const clash = await prisma.libraryBook.findFirst({
      where: { institutionId, isbn: input.isbn, id: { not: id } },
      select: { id: true },
    });
    if (clash) throw new AppError("A book with this ISBN already exists", 409);
  }

  /* Stock arithmetic must never let availableCopies drift away from
     (totalCopies - copies currently out). */
  let availableCopies = existing.availableCopies;
  if (input.totalCopies !== undefined) {
    const onLoan = existing.totalCopies - existing.availableCopies;
    if (input.totalCopies < onLoan) {
      throw new AppError(
        `${onLoan} copies are currently issued or reserved; total copies cannot be lower`,
        422
      );
    }
    availableCopies = input.totalCopies - onLoan;
  }

  const book = await prisma.$transaction(async (tx) => {
    const updated = await tx.libraryBook.update({
      where: { id },
      data: {
        title: input.title,
        author: input.author,
        isbn: input.isbn,
        category: input.category,
        publisher: input.publisher,
        shelfLocation: input.shelfLocation,
        defaultAcquisitionCost: input.defaultAcquisitionCost,
        defaultReplacementValue: input.defaultReplacementValue,
        defaultCurrentValue: input.defaultCurrentValue,
        defaultLoanDays: input.defaultLoanDays,
        defaultMaxRenewals: input.defaultMaxRenewals,
        defaultFinePerDay: input.defaultFinePerDay,
        defaultFineCap: input.defaultFineCap,
        defaultGracePeriodDays: input.defaultGracePeriodDays,
        ...(input.totalCopies !== undefined
          ? { totalCopies: input.totalCopies, availableCopies }
          : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });

    if (input.totalCopies !== undefined) {
      const delta = input.totalCopies - existing.totalCopies;
      if (delta > 0) {
        await tx.libraryBookCopy.createMany({
          data: Array.from({ length: delta }, (_, index) => ({
            institutionId,
            bookId: id,
            accessionNumber: `ACC-${id.slice(0, 8).toUpperCase()}-${String(existing.totalCopies + index + 1).padStart(5, "0")}`,
            location: input.shelfLocation ?? existing.shelfLocation,
            shelf: input.shelfLocation ?? existing.shelfLocation,
            acquisitionCost: input.defaultAcquisitionCost ?? existing.defaultAcquisitionCost,
            currentValue: input.defaultCurrentValue ?? input.defaultReplacementValue ?? existing.defaultCurrentValue ?? existing.defaultReplacementValue,
          })),
        });
      } else if (delta < 0) {
        const removable = await tx.libraryBookCopy.findMany({
          where: { institutionId, bookId: id, status: "AVAILABLE" },
          orderBy: { accessionNumber: "desc" },
          take: Math.abs(delta),
          select: { id: true },
        });
        if (removable.length !== Math.abs(delta)) {
          throw new AppError("Only available copies can be removed; active circulation copies must remain", 422);
        }
        await tx.libraryBookCopy.deleteMany({ where: { id: { in: removable.map((row) => row.id) } } });
      }
    }
    return updated;
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "library.book.update",
    entityType: "LibraryBook",
    entityId: id,
    metadata: input as Prisma.InputJsonValue,
    ...meta,
  });

  return book;
}

/* -------------------------------------------------------------- circulation */

async function assertBorrowerInInstitution(
  institutionId: string,
  borrowerId: string
) {
  const borrower = await prisma.user.findFirst({
    where: { id: borrowerId, institutionId, isActive: true },
    select: { id: true },
  });
  if (!borrower) {
    throw new AppError("Borrower is not an active user of this institution", 404);
  }
}

export async function issueBook(
  institutionId: string,
  actor: AuthenticatedUser,
  input: IssueBookInput,
  meta: Meta
) {
  const result = await prisma.$transaction(async (tx) => {
    const [borrower, policy, book] = await Promise.all([
      tx.user.findFirst({
        where: { id: input.borrowerId, institutionId, isActive: true },
        select: { id: true },
      }),
      getLibraryPolicy(tx, institutionId),
      tx.libraryBook.findFirst({
        where: { id: input.bookId, institutionId, isActive: true },
        include: { copies: { where: { status: "AVAILABLE" }, orderBy: { accessionNumber: "asc" }, take: 50 } },
      }),
    ]);
    if (!borrower) throw new AppError("Borrower is not an active user of this institution", 404);
    if (!book) throw new AppError("Book not found", 404);

    const activeLoans = await tx.libraryIssue.count({
      where: { institutionId, borrowerId: input.borrowerId, status: { in: ["ISSUED", "RESERVED"] } },
    });
    const duplicate = await tx.libraryIssue.findFirst({
      where: { institutionId, borrowerId: input.borrowerId, bookId: input.bookId, status: "ISSUED" },
      select: { id: true },
    });
    const reservation = await tx.libraryIssue.findFirst({
      where: { institutionId, borrowerId: input.borrowerId, bookId: input.bookId, status: "RESERVED" },
      select: { id: true, copyId: true },
    });
    if (duplicate) throw new AppError("This borrower already holds a copy of this book", 409);
    if (!reservation && activeLoans >= (policy.maxActiveLoans)) {
      throw new AppError(`Borrowing limit reached (${policy.maxActiveLoans} active loans)`, 422);
    }

    const copy = reservation?.copyId
      ? await tx.libraryBookCopy.findFirst({ where: { id: reservation.copyId, institutionId, bookId: book.id, status: "RESERVED" } })
      : input.copyId
        ? await tx.libraryBookCopy.findFirst({ where: { id: input.copyId, institutionId, bookId: book.id, status: "AVAILABLE" } })
        : book.copies[0];

    if (!copy) throw new AppError("No matching physical copy is available", 409);

    const issuedAt = input.issuedAt ?? new Date();
    const loanDays = input.loanPeriodDays ?? book.defaultLoanDays ?? policy.defaultLoanDays;
    const dueDate = input.dueDate ?? addDays(issuedAt, loanDays);
    if (dueDate.getTime() <= issuedAt.getTime()) throw new AppError("Due date must be after the issue date", 422);

    const finePerDay = input.finePerDay ?? book.defaultFinePerDay ?? policy.dailyFine;
    const fineCap = input.fineCap ?? book.defaultFineCap ?? policy.fineCap;
    const gracePeriodDays = input.gracePeriodDays ?? book.defaultGracePeriodDays ?? policy.gracePeriodDays;
    const renewalsAllowed = input.renewalsAllowed ?? book.defaultMaxRenewals ?? policy.maxRenewals;

    if (input.fineCap !== undefined && input.fineCap < finePerDay) {
      throw new AppError("Fine cap cannot be lower than the daily fine", 422);
    }

    if (reservation) {
      await tx.libraryBookCopy.update({
        where: { id: copy.id },
        data: { status: "ISSUED" },
      });
      return tx.libraryIssue.update({
        where: { id: reservation.id },
        data: {
          status: "ISSUED",
          copyId: copy.id,
          issuedById: actor.id,
          issuedAt,
          dueDate,
          loanPeriodDays: loanDays,
          renewalsAllowed,
          finePerDay,
          fineCap,
          gracePeriodDays,
          finePolicySource: input.finePerDay !== undefined || input.fineCap !== undefined || input.gracePeriodDays !== undefined
            ? "TRANSACTION"
            : book.defaultFinePerDay !== null || book.defaultFineCap !== null || book.defaultGracePeriodDays !== null
              ? "BOOK"
              : "INSTITUTION",
          originalDueDate: dueDate,
          note: input.note ?? null,
        },
        include: issueInclude,
      });
    }

    const stockUpdate = await tx.libraryBookCopy.updateMany({
      where: { id: copy.id, institutionId, bookId: book.id, status: "AVAILABLE" },
      data: { status: "ISSUED" },
    });
    if (stockUpdate.count !== 1) throw new AppError("The selected copy is no longer available", 409);

    const issue = await tx.libraryIssue.create({
      data: {
        institutionId,
        bookId: book.id,
        borrowerId: input.borrowerId,
        issuedById: actor.id,
        issuedAt,
        dueDate,
        copyId: copy.id,
        loanPeriodDays: loanDays,
        renewalsAllowed,
        finePerDay,
        fineCap,
        gracePeriodDays,
        finePolicySource: input.finePerDay !== undefined || input.fineCap !== undefined || input.gracePeriodDays !== undefined
          ? "TRANSACTION"
          : book.defaultFinePerDay !== null || book.defaultFineCap !== null || book.defaultGracePeriodDays !== null
            ? "BOOK"
            : "INSTITUTION",
        originalDueDate: dueDate,
        note: input.note ?? null,
        status: "ISSUED",
      },
      include: issueInclude,
    });

    await syncBookInventory(tx, institutionId, book.id);
    return issue;
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "library.issue",
    entityType: "LibraryIssue",
    entityId: result.id,
    metadata: {
      bookId: result.bookId,
      borrowerId: result.borrowerId,
      copyId: result.copyId,
      dueDate: result.dueDate.toISOString(),
      finePerDay: result.finePerDay,
      fineCap: result.fineCap,
      gracePeriodDays: result.gracePeriodDays,
      renewalsAllowed: result.renewalsAllowed,
      policySource: result.finePolicySource,
    },
    ...meta,
  });

  return shape(result);
}

export async function reserveBook(
  institutionId: string,
  actor: AuthenticatedUser,
  bookId: string,
  requestedBorrowerId: string | undefined,
  meta: Meta
) {
  const borrowerId = requestedBorrowerId ?? actor.id;

  /* Reserving on behalf of someone else is a circulation-desk action. */
  if (borrowerId !== actor.id && !actor.permissions.includes("library.manage")) {
    throw new AppError("You may only reserve books for yourself", 403);
  }
  await assertBorrowerInInstitution(institutionId, borrowerId);

  const reservation = await prisma.$transaction(async (tx) => {
    const book = await tx.libraryBook.findFirst({
      where: { id: bookId, institutionId, isActive: true },
    });
    if (!book) throw new AppError("Book not found", 404);
    const copy = await tx.libraryBookCopy.findFirst({
      where: { institutionId, bookId, status: "AVAILABLE" },
      orderBy: { accessionNumber: "asc" },
    });
    if (!copy) throw new AppError("No physical copies are currently available to reserve", 409);

    const existing = await tx.libraryIssue.findFirst({
      where: {
        institutionId,
        bookId,
        borrowerId,
        status: { in: ["RESERVED", "ISSUED"] },
      },
      select: { id: true },
    });
    if (existing) {
      throw new AppError("You already hold or have reserved this book", 409);
    }

    const [activeLoans, policy] = await Promise.all([
      tx.libraryIssue.count({
        where: { institutionId, borrowerId, status: { in: ["ISSUED", "RESERVED"] } },
      }),
      getLibraryPolicy(tx, institutionId),
    ]);
    if (activeLoans >= policy.maxActiveLoans) {
      throw new AppError(
        `Borrowing limit reached (${policy.maxActiveLoans} active loans or holds)`,
        422
      );
    }

    await tx.libraryBookCopy.update({
      where: { id: copy.id },
      data: { status: "RESERVED" },
    });

    await syncBookInventory(tx, institutionId, book.id);

    return tx.libraryIssue.create({
      data: {
        institutionId,
        bookId,
        borrowerId,
        issuedById: actor.id,
        copyId: copy.id,
        dueDate: addDays(new Date(), policy.reservationHoldDays),
        status: "RESERVED",
        finePolicySource: "INSTITUTION",
      },
      include: issueInclude,
    });
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "library.reserve",
    entityType: "LibraryIssue",
    entityId: reservation.id,
    metadata: { bookId, borrowerId },
    ...meta,
  });

  return shape(reservation);
}

export async function cancelReservation(
  institutionId: string,
  actor: AuthenticatedUser,
  id: string,
  meta: Meta
) {
  const existing = await prisma.libraryIssue.findFirst({
    where: { id, institutionId },
  });
  if (!existing) throw new AppError("Reservation not found", 404);
  if (existing.status !== "RESERVED") {
    throw new AppError("Only reservations can be cancelled", 422);
  }
  if (
    existing.borrowerId !== actor.id &&
    !actor.permissions.includes("library.manage")
  ) {
    throw new AppError("You may only cancel your own reservations", 403);
  }

  const result = await prisma.$transaction(async (tx) => {
    if (existing.copyId) {
      await tx.libraryBookCopy.update({
        where: { id: existing.copyId },
        data: { status: "AVAILABLE", condition: "GOOD" },
      });
    }
    await syncBookInventory(tx, institutionId, existing.bookId);
    return tx.libraryIssue.update({
      where: { id },
      data: { status: "RETURNED", returnedAt: new Date() },
      include: issueInclude,
    });
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "library.reservation.cancel",
    entityType: "LibraryIssue",
    entityId: id,
    ...meta,
  });

  return shape(result);
}

export async function returnBook(
  institutionId: string,
  actor: AuthenticatedUser,
  id: string,
  input: ReturnBookInput,
  meta: Meta
) {
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.libraryIssue.findFirst({
      where: { id, institutionId },
      include: { book: true, copy: true },
    });
    if (!existing) throw new AppError("Loan not found", 404);
    if (existing.status !== "ISSUED" && existing.status !== "RESERVED") {
      throw new AppError("This loan is already closed", 422);
    }

    const policy = await getLibraryPolicy(tx, institutionId);
    const loanPolicy = {
      dailyFine: existing.finePerDay ?? policy.dailyFine,
      fineCap: existing.fineCap ?? policy.fineCap,
      gracePeriodDays: existing.gracePeriodDays,
    };
    const lateFine = computeFine(existing.dueDate, loanPolicy);

    let charge = lateFine;
    if (input.condition === "LOST") {
      const lostCharge = calculateLostCharge(existing.copy, existing.book, policy);
      charge = round2(lateFine + lostCharge);
    } else if (input.condition === "DAMAGED") {
      const damagedCharge = calculateDamagedCharge(existing.copy, existing.book, policy);
      charge = round2(lateFine + damagedCharge);
    }

    const finalFine = input.fineOverride ?? charge;
    if (input.fineOverride !== undefined && !input.fineOverrideReason?.trim()) {
      throw new AppError("A reason is required when overriding a library charge", 422);
    }
    if (input.waiveFine && finalFine > 0 && !actor.permissions.includes("library.fines.waive.approve")) {
      throw new AppError("Fine waiver requires financial approval authority", 403);
    }

    const financeEntitlement = await tx.tenantFeatureEntitlement.findFirst({
      where: { institutionId, featureKey: "fees", isEnabled: true },
      select: { id: true },
    });
    const financialReady = Boolean(financeEntitlement);

    let financialInvoiceId: string | null = null;
    let libraryFineId: string | null = null;
    const fineType: string | null = finalFine > 0
      ? input.condition === "LOST" ? "LOST_BOOK"
        : input.condition === "DAMAGED" ? "DAMAGED_BOOK"
        : "OVERDUE"
      : null;

    if (finalFine > 0 && fineType) {
      const reason = input.fineOverrideReason?.trim()
        ? input.fineOverrideReason.trim()
        : input.condition === "LOST"
          ? `Lost book: "${existing.book.title}"`
          : input.condition === "DAMAGED"
            ? `Damaged book: "${existing.book.title}"`
            : `Late return of "${existing.book.title}"`;

      const feeHeadCode = fineType === "LOST_BOOK"
        ? "LOST_BOOK_CHARGE"
        : fineType === "DAMAGED_BOOK"
          ? "DAMAGED_BOOK_CHARGE"
          : "LIBRARY_FINE";
      const feeHeadName = fineType === "LOST_BOOK"
        ? "Lost Book Charge"
        : fineType === "DAMAGED_BOOK"
          ? "Damaged Book Charge"
          : "Library Fine";

      const fineRow = await tx.libraryFine.upsert({
        where: { issueId_type: { issueId: existing.id, type: fineType } },
        update: {
          originalAmount: finalFine,
          reason,
          status: input.waiveFine ? "WAIVED" : "OUTSTANDING",
          waivedAmount: input.waiveFine ? finalFine : 0,
          waiverReason: input.waiveFine ? "Waived during authorized return" : null,
          requestedById: input.waiveFine ? actor.id : null,
          approvedById: input.waiveFine ? actor.id : null,
          approvedAt: input.waiveFine ? new Date() : null,
        },
        create: {
          institutionId,
          issueId: existing.id,
          studentId: existing.borrowerId,
          type: fineType,
          originalAmount: finalFine,
          waivedAmount: input.waiveFine ? finalFine : 0,
          reason,
          status: input.waiveFine ? "WAIVED" : "OUTSTANDING",
          requestedById: input.waiveFine ? actor.id : null,
          approvedById: input.waiveFine ? actor.id : null,
          approvedAt: input.waiveFine ? new Date() : null,
          waiverReason: input.waiveFine ? "Waived during authorized return" : null,
        },
      });
      libraryFineId = fineRow.id;

      if (financialReady) {
        const feeHead = await tx.feeHead.upsert({
          where: { institutionId_code: { institutionId, code: feeHeadCode } },
          update: { isActive: true },
          create: { institutionId, name: feeHeadName, code: feeHeadCode, description: "Financial charges generated by library circulation" },
          select: { id: true },
        });
        const eventKey = `LIBRARY_FINANCIAL_CHARGE:${existing.id}:${fineType}`;
        const existingInvoice = await tx.feeInvoice.findUnique({
          where: { institutionId_sourceEventKey: { institutionId, sourceEventKey: eventKey } },
          select: { id: true, paidAmount: true },
        });
        const settled = Number(existingInvoice?.paidAmount ?? 0);
        const payable = input.waiveFine ? 0 : finalFine;
        const invoiceAmount = Math.max(payable, settled);
        const invoiceStatus = invoiceAmount <= settled + 0.005
          ? "PAID"
          : settled > 0 ? "PARTIALLY_PAID" : "PENDING";
        const invoice = existingInvoice
          ? await tx.feeInvoice.update({
              where: { id: existingInvoice.id },
              data: {
                amount: invoiceAmount,
                grossAmount: finalFine,
                discountAmount: input.waiveFine ? finalFine : 0,
                status: invoiceStatus,
              },
            })
          : await tx.feeInvoice.create({
              data: {
                institutionId,
                studentId: existing.borrowerId,
                title: feeHeadName,
                amount: invoiceAmount,
                dueDate: new Date(),
                status: invoiceStatus,
                invoiceNumber: `LIB-${existing.id.slice(0, 8).toUpperCase()}`,
                grossAmount: finalFine,
                discountAmount: input.waiveFine ? finalFine : 0,
                sourceModule: "LIBRARY",
                sourceType: fineType === "OVERDUE" ? "LIBRARY_FINE" : `LIBRARY_${fineType}_CHARGE`,
                sourceEntityId: existing.id,
                sourceEventKey: eventKey,
                libraryIssueId: existing.id,
                items: { create: { feeHeadId: feeHead.id, description: reason, amount: invoiceAmount } },
              },
            });
        if (existingInvoice) {
          await tx.feeInvoiceItem.updateMany({
            where: { invoiceId: invoice.id },
            data: { feeHeadId: feeHead.id, description: reason, amount: invoiceAmount },
          });
        }
        financialInvoiceId = invoice.id;
        await tx.libraryFine.update({ where: { id: libraryFineId }, data: { financialInvoiceId: invoice.id } });
      }
    }

    if (existing.copyId) {
      await tx.libraryBookCopy.update({
        where: { id: existing.copyId },
        data: {
          status: input.condition === "RETURNED" ? "AVAILABLE" : input.condition,
          condition: input.condition === "RETURNED" ? "GOOD" : input.damageSeverity ?? input.condition,
        },
      });
    }

    if (input.condition === "RETURNED") {
      await tx.libraryBook.update({
        where: { id: existing.bookId },
        data: { availableCopies: { increment: 1 } },
      });
    }

    const issue = await tx.libraryIssue.update({
      where: { id },
      data: {
        status: input.condition,
        returnedAt: new Date(),
        fineAmount: finalFine,
        note: input.note ?? null,
        lostChargeAmount: input.condition === "LOST" ? Math.max(0, finalFine - lateFine) : null,
        damagedChargeAmount: input.condition === "DAMAGED" ? Math.max(0, finalFine - lateFine) : null,
      },
      include: issueInclude,
    });

    return {
      issue,
      lateFine,
      calculatedCharge: charge,
      finalFine,
      financialInvoiceId,
      libraryFineId,
      financialReady,
      fineOverride: input.fineOverride !== undefined,
      damageSeverity: input.damageSeverity ?? null,
    };
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "library.return",
    entityType: "LibraryIssue",
    entityId: id,
    metadata: {
      condition: input.condition,
      lateFine: result.lateFine,
      calculatedCharge: result.calculatedCharge,
      finalAmount: result.finalFine,
      financialInvoiceId: result.financialInvoiceId,
      libraryFineId: result.libraryFineId,
      fineOverride: result.fineOverride,
      overrideReason: input.fineOverrideReason?.trim() ?? null,
      damageSeverity: result.damageSeverity,
      financialReady: result.financialReady,
    },
    ...meta,
  });

  return { ...shape(result.issue), financialInvoiceId: result.financialInvoiceId, libraryFineId: result.libraryFineId };
}

export async function imposeLateReturnFine(
  institutionId: string,
  actor: AuthenticatedUser,
  issueId: string,
  meta: Meta = {}
) {
  const result = await prisma.$transaction(async (tx) => {
    const issue = await tx.libraryIssue.findFirst({
      where: { id: issueId, institutionId, status: "ISSUED" },
      include: { book: true },
    });
    if (!issue) throw new AppError("Active library loan not found", 404);

    const fine = computeFine(issue.dueDate, {
      dailyFine: issue.finePerDay ?? (await getLibraryPolicy(tx, institutionId)).dailyFine,
      fineCap: issue.fineCap ?? (await getLibraryPolicy(tx, institutionId)).fineCap,
      gracePeriodDays: issue.gracePeriodDays,
    });
    if (fine <= 0) {
      throw new AppError("This loan is not overdue, so there is no late-return fine to impose", 422);
    }

    const type = "OVERDUE";
    const reason = `Late return of "${issue.book.title}"`;

    const financeEntitlement = await tx.tenantFeatureEntitlement.findFirst({
      where: { institutionId, featureKey: "fees", isEnabled: true },
      select: { id: true },
    });

    const existingFine = await tx.libraryFine.findUnique({
      where: { issueId_type: { issueId: issue.id, type } },
      select: {
        id: true,
        originalAmount: true,
        waivedAmount: true,
        status: true,
        financialInvoiceId: true,
      },
    });

    if (!financeEntitlement) {
      const fineRow = existingFine
        ? await tx.libraryFine.update({
            where: { id: existingFine.id },
            data: {
              originalAmount: Math.max(Number(existingFine.originalAmount), fine),
              reason,
            },
          })
        : await tx.libraryFine.create({
            data: {
              institutionId,
              issueId: issue.id,
              studentId: issue.borrowerId,
              type,
              originalAmount: fine,
              reason,
              status: "FINANCE_BLOCKED",
            },
          });

      return {
        fine: fineRow,
        financialInvoiceId: null as string | null,
        financialReady: false,
      };
    }

    const feeHead = await tx.feeHead.upsert({
      where: { institutionId_code: { institutionId, code: "LIBRARY_FINE" } },
      update: { isActive: true },
      create: {
        institutionId,
        name: "Library Fine",
        code: "LIBRARY_FINE",
        description: "Financial charges generated by library circulation",
      },
      select: { id: true },
    });

    const waivedAmount = Number(existingFine?.waivedAmount ?? 0);
    const payableAmount = Math.max(0, fine - waivedAmount);
    const eventKey = `LIBRARY_FINANCIAL_CHARGE:${issue.id}:${type}`;

    const existingInvoice = await tx.feeInvoice.findUnique({
      where: {
        institutionId_sourceEventKey: {
          institutionId,
          sourceEventKey: eventKey,
        },
      },
      select: { id: true, paidAmount: true },
    });

    const settled = Number(existingInvoice?.paidAmount ?? 0);
    const invoiceAmount = Math.max(payableAmount, settled);
    const invoiceStatus =
      invoiceAmount <= settled + 0.005
        ? "PAID"
        : settled > 0
          ? "PARTIALLY_PAID"
          : "PENDING";

    const invoice = existingInvoice
      ? await tx.feeInvoice.update({
          where: { id: existingInvoice.id },
          data: {
            amount: invoiceAmount,
            grossAmount: fine,
            discountAmount: waivedAmount,
            status: invoiceStatus,
          },
        })
      : await tx.feeInvoice.create({
          data: {
            institutionId,
            studentId: issue.borrowerId,
            title: "Library Fine — Late Return",
            amount: invoiceAmount,
            dueDate: new Date(),
            status: invoiceStatus,
            invoiceNumber: `LIB-${issue.id.slice(0, 8).toUpperCase()}`,
            grossAmount: fine,
            discountAmount: waivedAmount,
            sourceModule: "LIBRARY",
            sourceType: "LIBRARY_FINE",
            sourceEntityId: issue.id,
            sourceEventKey: eventKey,
            libraryIssueId: issue.id,
            items: {
              create: {
                feeHeadId: feeHead.id,
                description: reason,
                amount: invoiceAmount,
              },
            },
          },
        });

    if (existingInvoice) {
      await tx.feeInvoiceItem.updateMany({
        where: { invoiceId: invoice.id },
        data: { feeHeadId: feeHead.id, description: reason, amount: invoiceAmount },
      });
    }

    const fineRow = existingFine
      ? await tx.libraryFine.update({
          where: { id: existingFine.id },
          data: {
            originalAmount: fine,
            reason,
            financialInvoiceId: invoice.id,
            status: waivedAmount >= fine ? "WAIVED" : "OUTSTANDING",
          },
        })
      : await tx.libraryFine.create({
          data: {
            institutionId,
            issueId: issue.id,
            studentId: issue.borrowerId,
            type,
            originalAmount: fine,
            reason,
            status: waivedAmount >= fine ? "WAIVED" : "OUTSTANDING",
            financialInvoiceId: invoice.id,
          },
        });

    return {
      fine: fineRow,
      financialInvoiceId: invoice.id,
      financialReady: true,
    };
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "library.fine.impose",
    entityType: "LibraryFine",
    entityId: result.fine.id,
    metadata: {
      issueId,
      amount: Number(result.fine.originalAmount),
      financialInvoiceId: result.financialInvoiceId,
      financialReady: result.financialReady,
    },
    ...meta,
  });

  return result;
}

export async function renewLoan(
  institutionId: string,
  actor: AuthenticatedUser,
  id: string,
  input: RenewLoanInput,
  meta: Meta
) {
  const result = await prisma.$transaction(async (tx) => {
    const loan = await tx.libraryIssue.findFirst({
      where: { id, institutionId },
      include: { book: true },
    });
    if (!loan) throw new AppError("Loan not found", 404);
    if (loan.status !== "ISSUED") throw new AppError("Only active issued loans can be renewed", 422);
    if (loan.borrowerId !== actor.id && !actor.permissions.includes("library.manage")) {
      throw new AppError("You may only renew your own loan", 403);
    }
    if (loan.renewalsUsed >= loan.renewalsAllowed) {
      throw new AppError("Renewal limit has been reached for this loan", 422);
    }
    const reservation = await tx.libraryIssue.findFirst({
      where: {
        institutionId,
        bookId: loan.bookId,
        status: "RESERVED",
        borrowerId: { not: loan.borrowerId },
      },
      select: { id: true },
    });
    if (reservation) throw new AppError("This book has a reservation waiting for another member", 409);

    const policy = await getLibraryPolicy(tx, institutionId);
    const nextDueDate = input.dueDate ?? addDays(loan.dueDate, loan.loanPeriodDays ?? policy.defaultLoanDays);
    if (nextDueDate.getTime() <= loan.dueDate.getTime()) {
      throw new AppError("Renewal due date must be after the current due date", 422);
    }

    await tx.libraryLoanRenewal.create({
      data: {
        institutionId,
        issueId: loan.id,
        previousDueDate: loan.dueDate,
        newDueDate: nextDueDate,
        renewedById: actor.id,
        note: input.note ?? null,
      },
    });

    const updated = await tx.libraryIssue.update({
      where: { id },
      data: {
        dueDate: nextDueDate,
        renewalsUsed: { increment: 1 },
        note: input.note ? [loan.note, input.note].filter(Boolean).join("\n") : loan.note,
      },
      include: issueInclude,
    });
    return updated;
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "library.loan.renew",
    entityType: "LibraryIssue",
    entityId: id,
    metadata: { dueDate: result.dueDate.toISOString(), renewalsUsed: result.renewalsUsed, renewalsAllowed: result.renewalsAllowed },
    ...meta,
  });
  return shape(result);
}

export async function getPolicy(institutionId: string) {
  return prisma.libraryPolicy.upsert({
    where: { institutionId },
    update: {},
    create: { institutionId },
  });
}

export async function updatePolicy(
  institutionId: string,
  actor: AuthenticatedUser,
  input: LibraryPolicyInput,
  meta: Meta
) {
  const current = await getPolicy(institutionId);
  const next = await prisma.libraryPolicy.update({
    where: { institutionId },
    data: input,
  });
  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "library.policy.update",
    entityType: "LibraryPolicy",
    entityId: next.id,
    metadata: {
      old: {
        name: current.name,
        maxActiveLoans: current.maxActiveLoans,
        defaultLoanDays: current.defaultLoanDays,
        maxRenewals: current.maxRenewals,
        gracePeriodDays: current.gracePeriodDays,
        dailyFine: current.dailyFine,
        fineCap: current.fineCap,
        lostChargeType: current.lostChargeType,
        damagedChargeType: current.damagedChargeType,
      },
      new: {
        name: next.name,
        maxActiveLoans: next.maxActiveLoans,
        defaultLoanDays: next.defaultLoanDays,
        maxRenewals: next.maxRenewals,
        gracePeriodDays: next.gracePeriodDays,
        dailyFine: next.dailyFine,
        fineCap: next.fineCap,
        lostChargeType: next.lostChargeType,
        damagedChargeType: next.damagedChargeType,
      },
    },
    ...meta,
  });
  return next;
}

export async function updateCopy(
  institutionId: string,
  actor: AuthenticatedUser,
  id: string,
  input: UpdateCopyInput,
  meta: Meta
) {
  const existing = await prisma.libraryBookCopy.findFirst({ where: { id, institutionId } });
  if (!existing) throw new AppError("Physical copy not found", 404);
  if (input.status === "AVAILABLE" && existing.status !== "AVAILABLE") {
    const activeLoan = await prisma.libraryIssue.findFirst({
      where: { institutionId, copyId: id, status: { in: ["ISSUED", "RESERVED"] } },
      select: { id: true },
    });
    if (activeLoan) throw new AppError("An active loan or reservation owns this copy", 409);
  }
  const next = await prisma.$transaction(async tx => {
    const updated = await tx.libraryBookCopy.update({
      where: { id },
      data: input,
    });
    await syncBookInventory(tx, institutionId, existing.bookId);
    return updated;
  });
  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "library.copy.update",
    entityType: "LibraryBookCopy",
    entityId: id,
    metadata: {
      old: { acquisitionCost: existing.acquisitionCost, replacementValue: existing.replacementValue, currentValue: existing.currentValue, condition: existing.condition, status: existing.status },
      new: { acquisitionCost: next.acquisitionCost, replacementValue: next.replacementValue, currentValue: next.currentValue, condition: next.condition, status: next.status },
    },
    ...meta,
  });
  return next;
}

export async function listCopies(
  institutionId: string,
  pagination: PaginationParams,
  filters: { bookId?: string; status?: string; search?: string }
) {
  const where: Prisma.LibraryBookCopyWhereInput = {
    institutionId,
    ...(filters.bookId ? { bookId: filters.bookId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.search ? {
      OR: [
        { accessionNumber: { contains: filters.search, mode: "insensitive" } },
        { barcode: { contains: filters.search, mode: "insensitive" } },
        { book: { title: { contains: filters.search, mode: "insensitive" } } },
      ],
    } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.libraryBookCopy.findMany({
      where,
      select: {
        id: true, accessionNumber: true, barcode: true, location: true, shelf: true,
        acquisitionDate: true, acquisitionCost: true, currentValue: true, condition: true, status: true,
        book: { select: { id: true, title: true, isbn: true } },
      },
      orderBy: { accessionNumber: "asc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.libraryBookCopy.count({ where }),
  ]);
  return { items, total };
}

export async function listCirculation(
  institutionId: string,
  pagination: PaginationParams,
  filters: { status?: string; borrowerId?: string; bookId?: string }
) {
  const overdue = filters.status === "OVERDUE";
  const where: Prisma.LibraryIssueWhereInput = {
    institutionId,
    ...(filters.borrowerId ? { borrowerId: filters.borrowerId } : {}),
    ...(filters.bookId ? { bookId: filters.bookId } : {}),
    ...(overdue
      ? { status: "ISSUED", dueDate: { lt: new Date() } }
      : filters.status
        ? { status: filters.status }
        : {}),
  };

  const [rows, total, outstanding] = await Promise.all([
    prisma.libraryIssue.findMany({
      where,
      include: issueInclude,
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.libraryIssue.count({ where }),
    prisma.feeInvoice.aggregate({
      where: { institutionId, sourceModule: "LIBRARY" },
      _sum: { amount: true, paidAmount: true },
    }),
  ]);

  const billed = Number(outstanding._sum.amount ?? 0);
  const paid = Number(outstanding._sum.paidAmount ?? 0);
  return {
    items: rows.map(shape),
    total,
    outstandingFines: round2(Math.max(0, billed - paid)),
  };
}

export async function listMyLoans(institutionId: string, actor: AuthenticatedUser) {
  const rows = await prisma.libraryIssue.findMany({
    where: { institutionId, borrowerId: actor.id },
    include: issueInclude,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const shaped = rows.map(shape);
  return {
    items: shaped,
    activeCount: shaped.filter((row) =>
      ["ISSUED", "RESERVED"].includes(row.status)
    ).length,
    outstandingFine: round2(
      shaped.reduce((sum, row) => sum + row.financialBalance, 0)
    ),
  };
}

export async function getLibrarySummary(institutionId: string) {
  const now = new Date();
  const start = startOfDay(now);
  const end = addDays(start, 1);
  const [titles, copyGroups, issuesToday, returnsToday, overdue, financialTotals] = await Promise.all([
    prisma.libraryBook.count({ where: { institutionId, isActive: true } }),
    prisma.libraryBookCopy.groupBy({
      by: ["status"],
      where: { institutionId, book: { isActive: true } },
      _count: { _all: true },
    }),
    prisma.libraryIssue.count({ where: { institutionId, issuedAt: { gte: start, lt: end } } }),
    prisma.libraryIssue.count({ where: { institutionId, returnedAt: { gte: start, lt: end } } }),
    prisma.libraryIssue.count({ where: { institutionId, status: "ISSUED", dueDate: { lt: now } } }),
    prisma.feeInvoice.aggregate({
      where: { institutionId, sourceModule: "LIBRARY" },
      _sum: { amount: true, paidAmount: true },
    }),
  ]);

  const counts = Object.fromEntries(copyGroups.map((row) => [row.status, row._count._all]));
  const totalCopies = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const availableCopies = counts.AVAILABLE ?? 0;
  const reserved = counts.RESERVED ?? 0;
  const issued = counts.ISSUED ?? 0;
  const lost = counts.LOST ?? 0;
  const damaged = counts.DAMAGED ?? 0;
  const maintenance = counts.MAINTENANCE ?? 0;
  const billed = Number(financialTotals._sum.amount ?? 0);
  const paid = Number(financialTotals._sum.paidAmount ?? 0);

  return {
    titles,
    totalCopies,
    availableCopies,
    issued,
    reserved,
    overdue,
    lost,
    damaged,
    maintenance,
    outstandingFines: round2(Math.max(0, billed - paid)),
    collectedFines: round2(paid),
    todayIssues: issuesToday,
    todayReturns: returnsToday,
  };
}

export async function requestFineWaiver(
  institutionId: string,
  actor: AuthenticatedUser,
  fineId: string,
  reason: string,
  amount?: number,
  meta: Meta = {}
) {
  if (!actor.permissions.includes("library.fines.waive.request")) {
    throw new AppError("Library fine waiver requests are not authorized", 403);
  }
  if (!reason?.trim()) throw new AppError("Waiver reason is required", 400);
  const fine = await prisma.libraryFine.findFirst({ where: { id: fineId, institutionId } });
  if (!fine) throw new AppError("Library fine not found", 404);
  const remaining = Math.max(0, Number(fine.originalAmount) - Number(fine.waivedAmount));
  const requested = amount === undefined ? remaining : amount;
  if (requested <= 0 || requested > remaining) throw new AppError("Waiver amount must be within the remaining fine balance", 400);
  const updated = await prisma.libraryFine.update({
    where: { id: fineId },
    data: { requestedById: actor.id, status: "WAIVER_REQUESTED", waiverReason: reason.trim() },
  });
  await recordAuditLog({ institutionId, userId: actor.id, action: "library.fine.waiver.request", entityType: "LibraryFine", entityId: fineId, metadata: { requestedAmount: requested, remainingAmount: remaining, reason: reason.trim() }, ...meta });
  return updated;
}

export async function approveFineWaiver(
  institutionId: string,
  actor: AuthenticatedUser,
  fineId: string,
  amount: number,
  reason: string,
  meta: Meta = {}
) {
  if (!actor.permissions.includes("library.fines.waive.approve")) {
    throw new AppError("Library fine waiver approval is not authorized", 403);
  }
  if (!Number.isFinite(amount) || amount <= 0 || !reason?.trim()) {
    throw new AppError("A positive waiver amount and reason are required", 400);
  }

  const result = await prisma.$transaction(async tx => {
    const fineRows = await tx.$queryRaw<Array<{
      id: string;
      originalAmount: number;
      waivedAmount: number;
      financialInvoiceId: string | null;
    }>>(Prisma.sql`
      SELECT "id", "originalAmount", "waivedAmount", "financialInvoiceId"
      FROM "library_fines"
      WHERE "id" = ${fineId} AND "institutionId" = ${institutionId}
      FOR UPDATE
    `);
    const fine = fineRows[0];
    if (!fine) throw new AppError("Library fine not found", 404);

    const fineRemaining = Math.max(
      0,
      Number(fine.originalAmount) - Number(fine.waivedAmount)
    );

    let invoice: {
      id: string;
      amount: number;
      paidAmount: number;
      discountAmount: number;
      lateFeeAmount: number;
      refundedAmount: number;
      status: string;
    } | null = null;

    if (fine.financialInvoiceId) {
      const invoiceRows = await tx.$queryRaw<Array<{
        id: string;
        amount: number;
        discountAmount: number;
        paidAmount: number;
        lateFeeAmount: number;
        refundedAmount: number;
        status: string;
      }>>(Prisma.sql`
        SELECT "id", "amount", "discountAmount", "paidAmount", "lateFeeAmount", "refundedAmount", "status"
        FROM "fee_invoices"
        WHERE "id" = ${fine.financialInvoiceId}
          AND "institutionId" = ${institutionId}
        FOR UPDATE
      `);
      invoice = invoiceRows[0] ?? null;
      if (!invoice) throw new AppError("Financial liability for this fine was not found", 409);
    }

    const financialOutstanding = invoice
      ? Math.max(
          0,
          Number(invoice.amount) + Number(invoice.lateFeeAmount ?? 0) -
            Number(invoice.paidAmount ?? 0)
        )
      : fineRemaining;
    const allowed = Math.min(fineRemaining, financialOutstanding);

    if (amount > allowed + 0.005) {
      throw new AppError(
        allowed <= 0
          ? "This fine has no outstanding financial balance available for waiver"
          : `Waiver exceeds the remaining fine balance of ${allowed.toFixed(2)}`,
        400
      );
    }

    const newWaived = Number(fine.waivedAmount) + amount;
    const newStatus =
      newWaived >= Number(fine.originalAmount) - 0.005 ? "WAIVED" : "PARTIAL";

    await tx.libraryFine.update({
      where: { id: fineId },
      data: {
        waivedAmount: newWaived,
        status: newStatus,
        approvedById: actor.id,
        approvedAt: new Date(),
        waiverReason: reason.trim(),
      },
    });

    if (invoice) {
      const newAmount = Math.max(0, Number(invoice.amount) - amount);
      const paidAmount = Number(invoice.paidAmount ?? 0);
      const nextStatus =
        newAmount <= paidAmount + 0.005
          ? "PAID"
          : paidAmount > 0
            ? "PARTIALLY_PAID"
            : "PENDING";

      await tx.feeInvoice.update({
        where: { id: invoice.id },
        data: {
          amount: newAmount,
          discountAmount: Number(invoice.discountAmount ?? 0) + amount,
          status: nextStatus,
        },
      });
    }

    return {
      id: fine.id,
      originalAmount: Number(fine.originalAmount),
      waivedAmount: newWaived,
      remainingAmount: Math.max(0, Number(fine.originalAmount) - newWaived),
      status: newStatus,
    };
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "library.fine.waiver.approve",
    entityType: "LibraryFine",
    entityId: fineId,
    metadata: { ...result, amount, reason: reason.trim() },
    ...meta,
  });
  return result;
}
export async function listFines(institutionId: string, actor: AuthenticatedUser, pagination: PaginationParams) {
  if (!actor.permissions.includes("library.read")) throw new AppError("Library access is not authorized", 403);
  const [items, total] = await Promise.all([
    prisma.libraryFine.findMany({
      where: { institutionId },
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
      include: {
        issue: { include: { book: { select: { id: true, title: true } } } },
        financialInvoice: { select: { id: true, amount: true, paidAmount: true, status: true } },
      },
    }),
    prisma.libraryFine.count({ where: { institutionId } }),
  ]);
  return { items, total };
}

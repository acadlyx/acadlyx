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
} from "../validators/library.validators";

type Meta = { ipAddress?: string; userAgent?: string };

/** Institution-wide circulation policy. Kept here so both issue and
 *  return paths compute identical numbers. */
export const LOAN_PERIOD_DAYS = 14;
export const FINE_PER_DAY = 5;
export const MAX_ACTIVE_LOANS = 5;
export const RESERVATION_HOLD_DAYS = 3;
export const LOST_BOOK_FINE = 500;
export const DAMAGED_BOOK_FINE = 250;

const issueInclude = {
  book: { select: { id: true, title: true, author: true, isbn: true } },
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

/** Fine accrues per whole day past the due date, capped at the
 *  replacement cost so a forgotten loan can never bankrupt a student. */
export function computeFine(dueDate: Date, on: Date = new Date()): number {
  const overdueDays = Math.floor(
    (startOfDay(on).getTime() - startOfDay(dueDate).getTime()) / 86_400_000
  );
  if (overdueDays <= 0) return 0;
  return round2(Math.min(overdueDays * FINE_PER_DAY, LOST_BOOK_FINE));
}

function shape(row: Prisma.LibraryIssueGetPayload<{ include: typeof issueInclude }>) {
  const accrued =
    row.status === "ISSUED" ? computeFine(row.dueDate) : row.fineAmount;
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

  const book = await prisma.libraryBook.create({
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
    },
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

  const book = await prisma.libraryBook.update({
    where: { id },
    data: {
      title: input.title,
      author: input.author,
      isbn: input.isbn,
      category: input.category,
      publisher: input.publisher,
      shelfLocation: input.shelfLocation,
      ...(input.totalCopies !== undefined
        ? { totalCopies: input.totalCopies, availableCopies }
        : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
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
  await assertBorrowerInInstitution(institutionId, input.borrowerId);

  const dueDate = input.dueDate ?? addDays(new Date(), LOAN_PERIOD_DAYS);
  if (dueDate.getTime() <= Date.now()) {
    throw new AppError("Due date must be in the future", 422);
  }

  const issue = await prisma.$transaction(async (tx) => {
    const book = await tx.libraryBook.findFirst({
      where: { id: input.bookId, institutionId, isActive: true },
    });
    if (!book) throw new AppError("Book not found", 404);

    const [activeLoans, duplicate, reservation] = await Promise.all([
      tx.libraryIssue.count({
        where: {
          institutionId,
          borrowerId: input.borrowerId,
          status: { in: ["ISSUED", "RESERVED"] },
        },
      }),
      tx.libraryIssue.findFirst({
        where: {
          institutionId,
          borrowerId: input.borrowerId,
          bookId: input.bookId,
          status: "ISSUED",
        },
        select: { id: true },
      }),
      tx.libraryIssue.findFirst({
        where: {
          institutionId,
          borrowerId: input.borrowerId,
          bookId: input.bookId,
          status: "RESERVED",
        },
        select: { id: true },
      }),
    ]);

    if (duplicate) {
      throw new AppError("This borrower already holds a copy of this book", 409);
    }
    if (!reservation && activeLoans >= MAX_ACTIVE_LOANS) {
      throw new AppError(
        `Borrowing limit reached (${MAX_ACTIVE_LOANS} active loans)`,
        422
      );
    }

    /* A reservation already reserved a copy, so stock only moves for
       a fresh issue. */
    if (!reservation) {
      if (book.availableCopies <= 0) {
        throw new AppError("No copies are currently available", 409);
      }
      await tx.libraryBook.update({
        where: { id: book.id },
        data: { availableCopies: { decrement: 1 } },
      });
    }

    if (reservation) {
      return tx.libraryIssue.update({
        where: { id: reservation.id },
        data: {
          status: "ISSUED",
          issuedById: actor.id,
          issuedAt: new Date(),
          dueDate,
        },
        include: issueInclude,
      });
    }

    return tx.libraryIssue.create({
      data: {
        institutionId,
        bookId: input.bookId,
        borrowerId: input.borrowerId,
        issuedById: actor.id,
        dueDate,
        status: "ISSUED",
      },
      include: issueInclude,
    });
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "library.issue",
    entityType: "LibraryIssue",
    entityId: issue.id,
    metadata: { bookId: input.bookId, borrowerId: input.borrowerId },
    ...meta,
  });

  return shape(issue);
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
    if (book.availableCopies <= 0) {
      throw new AppError("No copies are currently available to reserve", 409);
    }

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

    const activeLoans = await tx.libraryIssue.count({
      where: { institutionId, borrowerId, status: { in: ["ISSUED", "RESERVED"] } },
    });
    if (activeLoans >= MAX_ACTIVE_LOANS) {
      throw new AppError(
        `Borrowing limit reached (${MAX_ACTIVE_LOANS} active loans or holds)`,
        422
      );
    }

    await tx.libraryBook.update({
      where: { id: book.id },
      data: { availableCopies: { decrement: 1 } },
    });

    return tx.libraryIssue.create({
      data: {
        institutionId,
        bookId,
        borrowerId,
        issuedById: actor.id,
        dueDate: addDays(new Date(), RESERVATION_HOLD_DAYS),
        status: "RESERVED",
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
    await tx.libraryBook.update({
      where: { id: existing.bookId },
      data: { availableCopies: { increment: 1 } },
    });
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
  const existing = await prisma.libraryIssue.findFirst({
    where: { id, institutionId },
    include: { book: true },
  });
  if (!existing) throw new AppError("Loan not found", 404);
  if (existing.status !== "ISSUED" && existing.status !== "RESERVED") {
    throw new AppError("This loan is already closed", 422);
  }

  const fine =
    input.condition === "LOST"
      ? round2(computeFine(existing.dueDate) + LOST_BOOK_FINE)
      : input.condition === "DAMAGED"
        ? DAMAGED_BOOK_FINE
        : computeFine(existing.dueDate);

  if (input.waiveFine && fine > 0 && !actor.permissions.includes("fees.approve")) {
    throw new AppError("Fine waiver requires financial approval authority", 403);
  }

  const result = await prisma.$transaction(async (tx) => {
    if (input.condition === "LOST") {
      await tx.libraryBook.update({
        where: { id: existing.bookId },
        data: { totalCopies: { decrement: 1 } },
      });
    } else {
      await tx.libraryBook.update({
        where: { id: existing.bookId },
        data: { availableCopies: { increment: 1 } },
      });
    }

    let financialInvoiceId: string | null = null;
    let libraryFineId: string | null = null;

    if (fine > 0) {
      const feeHeadCode =
        input.condition === "LOST"
          ? "LOST_BOOK_CHARGE"
          : input.condition === "DAMAGED"
            ? "DAMAGED_BOOK_CHARGE"
            : "LIBRARY_FINE";
      const feeHeadName =
        input.condition === "LOST"
          ? "Lost Book Charge"
          : input.condition === "DAMAGED"
            ? "Damaged Book Charge"
            : "Library Fine";
      const feeHead = await tx.feeHead.upsert({
        where: { institutionId_code: { institutionId, code: feeHeadCode } },
        update: { isActive: true },
        create: {
          institutionId,
          name: feeHeadName,
          code: feeHeadCode,
          description: "Financial charges generated by library circulation",
        },
        select: { id: true },
      });

      const type = input.condition === "LOST" ? "LOST_BOOK" : input.condition === "DAMAGED" ? "DAMAGED_BOOK" : "OVERDUE";
      const reason =
        input.condition === "LOST"
          ? `Lost book: "${existing.book.title}"`
          : input.condition === "DAMAGED"
            ? `Damaged book: "${existing.book.title}"`
            : `Late return of "${existing.book.title}"`;

      const fineRow = await tx.libraryFine.upsert({
        where: { issueId_type: { issueId: existing.id, type } },
        update: {},
        create: {
          institutionId,
          issueId: existing.id,
          studentId: existing.borrowerId,
          type,
          originalAmount: fine,
          waivedAmount: input.waiveFine ? fine : 0,
          reason,
          status: input.waiveFine ? "WAIVED" : "OUTSTANDING",
          requestedById: input.waiveFine ? actor.id : null,
          approvedById: input.waiveFine ? actor.id : null,
          approvedAt: input.waiveFine ? new Date() : null,
          waiverReason: input.waiveFine ? "Waived during authorized return" : null,
        },
      });
      libraryFineId = fineRow.id;

      const eventKey = `LIBRARY_FINANCIAL_CHARGE:${existing.id}:${type}`;
      const invoice = await tx.feeInvoice.upsert({
        where: {
          institutionId_sourceEventKey: {
            institutionId,
            sourceEventKey: eventKey,
          },
        },
        update: {},
        create: {
          institutionId,
          studentId: existing.borrowerId,
          title: input.condition === "LOST" ? "Library Lost Book Charge" : "Library Fine — Late Return",
          amount: input.waiveFine ? 0 : fine,
          dueDate: new Date(),
          status: input.waiveFine ? "WAIVED" : "PENDING",
          invoiceNumber: `LIB-${existing.id.slice(0, 8).toUpperCase()}`,
          grossAmount: fine,
          discountAmount: input.waiveFine ? fine : 0,
          sourceModule: "LIBRARY",
          sourceType: type === "OVERDUE" ? "LIBRARY_FINE" : type === "LOST_BOOK" ? "LIBRARY_LOST_BOOK_CHARGE" : "LIBRARY_DAMAGED_BOOK_CHARGE",
          sourceEntityId: existing.id,
          sourceEventKey: eventKey,
          libraryIssueId: existing.id,
          items: {
            create: {
              feeHeadId: feeHead.id,
              description: reason,
              amount: fine,
            },
          },
        },
      });
      financialInvoiceId = invoice.id;

      await tx.libraryFine.update({
        where: { id: libraryFineId },
        data: { financialInvoiceId },
      });
    }

    const issue = await tx.libraryIssue.update({
      where: { id },
      data: {
        status: input.condition,
        returnedAt: new Date(),
        fineAmount: fine,
        note: input.note ?? null,
      },
      include: issueInclude,
    });

    return { issue, fine, financialInvoiceId, libraryFineId };
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "library.return",
    entityType: "LibraryIssue",
    entityId: id,
    metadata: {
      condition: input.condition,
      fine: result.fine,
      financialInvoiceId: result.financialInvoiceId,
      libraryFineId: result.libraryFineId,
      waived: Boolean(input.waiveFine),
    },
    ...meta,
  });

  return {
    ...shape(result.issue),
    financialInvoiceId: result.financialInvoiceId,
    libraryFineId: result.libraryFineId,
  };
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
    prisma.libraryIssue.aggregate({
      where: { institutionId, fineAmount: { gt: 0 } },
      _sum: { fineAmount: true },
    }),
  ]);

  return {
    items: rows.map(shape),
    total,
    outstandingFines: round2(outstanding._sum.fineAmount ?? 0),
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
      shaped.reduce(
        (sum, row) =>
          sum + (row.status === "ISSUED" ? row.accruedFine : row.fineAmount),
        0
      )
    ),
  };
}

export async function getLibrarySummary(institutionId: string) {
  const now = new Date();
  const [titles, copies, issued, reserved, overdue, fines] = await Promise.all([
    prisma.libraryBook.count({ where: { institutionId, isActive: true } }),
    prisma.libraryBook.aggregate({
      where: { institutionId, isActive: true },
      _sum: { totalCopies: true, availableCopies: true },
    }),
    prisma.libraryIssue.count({ where: { institutionId, status: "ISSUED" } }),
    prisma.libraryIssue.count({ where: { institutionId, status: "RESERVED" } }),
    prisma.libraryIssue.count({
      where: { institutionId, status: "ISSUED", dueDate: { lt: now } },
    }),
    prisma.libraryFine.aggregate({ where: { institutionId }, _sum: { originalAmount: true, waivedAmount: true } }),
    prisma.feeInvoice.aggregate({
      where: { institutionId, sourceModule: "LIBRARY", sourceType: { in: ["OVERDUE", "LIBRARY_FINE", "LOST_BOOK", "LIBRARY_LOST_BOOK_CHARGE"] } },
      _sum: { amount: true, paidAmount: true },
    }),
  ]);

  const billed = Number(fines._sum.amount ?? 0);
  const paid = Number(fines._sum.paidAmount ?? 0);
  return {
    titles,
    totalCopies: copies._sum.totalCopies ?? 0,
    availableCopies: copies._sum.availableCopies ?? 0,
    issued,
    reserved,
    overdue,
    collectedFines: round2(paid),
    outstandingFines: round2(Math.max(0, billed - paid)),
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
    const fine = await tx.libraryFine.findFirst({ where: { id: fineId, institutionId } });
    if (!fine) throw new AppError("Library fine not found", 404);
    const remaining = Math.max(0, Number(fine.originalAmount) - Number(fine.waivedAmount));
    if (amount > remaining + 0.005) throw new AppError("Waiver exceeds the remaining fine balance", 400);
    const newWaived = Number(fine.waivedAmount) + amount;
    const newStatus = newWaived >= Number(fine.originalAmount) - 0.005 ? "WAIVED" : "PARTIAL";
    await tx.libraryFine.update({
      where: { id: fineId },
      data: { waivedAmount: newWaived, status: newStatus, approvedById: actor.id, approvedAt: new Date(), waiverReason: reason.trim() },
    });
    if (fine.financialInvoiceId) {
      const invoice = await tx.feeInvoice.findFirst({ where: { id: fine.financialInvoiceId, institutionId } });
      if (invoice) {
        const newAmount = Math.max(0, Number(invoice.amount) - amount);
        await tx.feeInvoice.update({
          where: { id: invoice.id },
          data: { amount: newAmount, discountAmount: Number(invoice.discountAmount ?? 0) + amount, status: newAmount <= Number(invoice.paidAmount ?? 0) ? "PAID" : "PARTIAL" },
        });
      }
    }
    return { id: fine.id, originalAmount: Number(fine.originalAmount), waivedAmount: newWaived, remainingAmount: Math.max(0, Number(fine.originalAmount) - newWaived), status: newStatus };
  });
  await recordAuditLog({ institutionId, userId: actor.id, action: "library.fine.waiver.approve", entityType: "LibraryFine", entityId: fineId, metadata: { ...result, amount, reason: reason.trim() }, ...meta });
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

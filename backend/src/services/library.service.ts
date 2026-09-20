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

const issueInclude = {
  book: { select: { id: true, title: true, author: true, isbn: true } },
  borrower: {
    select: { id: true, firstName: true, lastName: true, email: true },
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
  });
  if (!existing) throw new AppError("Loan not found", 404);
  if (existing.status !== "ISSUED" && existing.status !== "RESERVED") {
    throw new AppError("This loan is already closed", 422);
  }

  const fine =
    input.waiveFine
      ? 0
      : input.condition === "LOST"
        ? round2(computeFine(existing.dueDate) + LOST_BOOK_FINE)
        : computeFine(existing.dueDate);

  const result = await prisma.$transaction(async (tx) => {
    if (input.condition === "LOST") {
      /* A lost copy leaves circulation permanently. */
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

    return tx.libraryIssue.update({
      where: { id },
      data: {
        status: input.condition,
        returnedAt: new Date(),
        fineAmount: fine,
      },
      include: issueInclude,
    });
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "library.return",
    entityType: "LibraryIssue",
    entityId: id,
    metadata: { condition: input.condition, fine, waived: input.waiveFine },
    ...meta,
  });

  return shape(result);
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
    prisma.libraryIssue.aggregate({
      where: { institutionId, fineAmount: { gt: 0 } },
      _sum: { fineAmount: true },
    }),
  ]);

  return {
    titles,
    totalCopies: copies._sum.totalCopies ?? 0,
    availableCopies: copies._sum.availableCopies ?? 0,
    issued,
    reserved,
    overdue,
    collectedFines: round2(fines._sum.fineAmount ?? 0),
  };
}

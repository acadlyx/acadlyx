import { authedFetch } from "./auth";
import { buildQuery, Envelope, PagedEnvelope, PageMeta } from "./httpShared";

export const LOAN_STATUSES = [
  "RESERVED",
  "ISSUED",
  "RETURNED",
  "LOST",
  "OVERDUE",
] as const;
export type LoanStatus = (typeof LOAN_STATUSES)[number];

export interface LibraryBook {
  id: string;
  title: string;
  author: string;
  isbn: string | null;
  category: string | null;
  publisher: string | null;
  shelfLocation: string | null;
  totalCopies: number;
  availableCopies: number;
  isActive: boolean;
}

export interface LibraryLoan {
  id: string;
  status: string;
  issuedAt: string;
  dueDate: string;
  returnedAt: string | null;
  fineAmount: number;
  accruedFine: number;
  isOverdue: boolean;
  book: { id: string; title: string; author: string; isbn: string | null };
  borrower: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface LibrarySummary {
  titles: number;
  totalCopies: number;
  availableCopies: number;
  issued: number;
  reserved: number;
  overdue: number;
  collectedFines: number;
}

export async function getLibrarySummary(): Promise<LibrarySummary> {
  const res = await authedFetch<Envelope<LibrarySummary>>("/library/summary");
  return res.data;
}

export interface BookListResult {
  items: LibraryBook[];
  categories: string[];
  meta: PageMeta;
}

export async function listBooks(params: {
  page?: number;
  search?: string;
  category?: string;
  availableOnly?: boolean;
} = {}): Promise<BookListResult> {
  const res = await authedFetch<
    PagedEnvelope<LibraryBook> & { categories: string[] }
  >(
    `/library/books${buildQuery({
      page: params.page,
      search: params.search,
      category: params.category,
      availableOnly: params.availableOnly ? "true" : undefined,
    })}`
  );
  return { items: res.data, categories: res.categories ?? [], meta: res.meta };
}

export async function createBook(input: {
  title: string;
  author: string;
  isbn?: string;
  category?: string;
  publisher?: string;
  shelfLocation?: string;
  totalCopies: number;
}): Promise<LibraryBook> {
  const res = await authedFetch<Envelope<LibraryBook>>("/library/books", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function updateBook(
  id: string,
  input: Partial<{
    title: string;
    author: string;
    isbn: string;
    category: string;
    publisher: string;
    shelfLocation: string;
    totalCopies: number;
    isActive: boolean;
  }>
): Promise<LibraryBook> {
  const res = await authedFetch<Envelope<LibraryBook>>(`/library/books/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return res.data;
}

export interface LoanListResult {
  items: LibraryLoan[];
  outstandingFines: number;
  meta: PageMeta;
}

export async function listLoans(params: {
  page?: number;
  status?: LoanStatus;
  borrowerId?: string;
  bookId?: string;
} = {}): Promise<LoanListResult> {
  const res = await authedFetch<
    PagedEnvelope<LibraryLoan> & { outstandingFines: number }
  >(`/library/loans${buildQuery(params as Record<string, string | number | undefined>)}`);
  return {
    items: res.data,
    outstandingFines: res.outstandingFines ?? 0,
    meta: res.meta,
  };
}

export async function listMyLoans(): Promise<{
  items: LibraryLoan[];
  activeCount: number;
  outstandingFine: number;
}> {
  const res = await authedFetch<
    Envelope<{
      items: LibraryLoan[];
      activeCount: number;
      outstandingFine: number;
    }>
  >("/library/loans/mine");
  return res.data;
}

export async function issueBook(input: {
  bookId: string;
  borrowerId: string;
  dueDate?: string;
}): Promise<LibraryLoan> {
  const res = await authedFetch<Envelope<LibraryLoan>>("/library/loans", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function returnLoan(
  id: string,
  input: { condition: "RETURNED" | "LOST"; waiveFine?: boolean; note?: string }
): Promise<LibraryLoan> {
  const res = await authedFetch<Envelope<LibraryLoan>>(
    `/library/loans/${id}/return`,
    { method: "POST", body: JSON.stringify(input) }
  );
  return res.data;
}

export async function reserveBook(
  bookId: string,
  borrowerId?: string
): Promise<LibraryLoan> {
  const res = await authedFetch<Envelope<LibraryLoan>>("/library/reservations", {
    method: "POST",
    body: JSON.stringify({ bookId, borrowerId }),
  });
  return res.data;
}

export async function cancelReservation(id: string): Promise<LibraryLoan> {
  const res = await authedFetch<Envelope<LibraryLoan>>(
    `/library/reservations/${id}/cancel`,
    { method: "POST" }
  );
  return res.data;
}

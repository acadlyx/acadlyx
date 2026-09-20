"use client";

import EntityPicker from "@/components/common/EntityPicker";
import { DirectoryOption } from "@/lib/directoryApi";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import {
  AuthRequiredError,
  AuthUser,
  getCurrentUser,
  isAuthenticated,
} from "@/lib/auth";
import {
  LibraryBook,
  LibraryLoan,
  LibrarySummary,
  LoanStatus,
  cancelReservation,
  createBook,
  getLibrarySummary,
  issueBook,
  listBooks,
  listLoans,
  listMyLoans,
  reserveBook,
  returnLoan,
} from "@/lib/libraryApi";

type ViewState = "loading" | "ready" | "error";
type Tab = "catalogue" | "circulation" | "mine";

const emptyBook = {
  title: "",
  author: "",
  isbn: "",
  category: "",
  publisher: "",
  shelfLocation: "",
  totalCopies: "1",
};

const STATUS_STYLES: Record<string, string> = {
  ISSUED: "bg-amber-100 text-amber-700",
  RESERVED: "bg-indigo-100 text-indigo-700",
  RETURNED: "bg-emerald-100 text-emerald-700",
  LOST: "bg-red-100 text-red-700",
};

const money = (value: number) => `₹${value.toFixed(2)}`;
const day = (value: string | null) =>
  value ? new Date(value).toLocaleDateString() : "—";

export default function LibraryPage() {
  const router = useRouter();
  const [state, setState] = useState<ViewState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [actionError, setActionError] = useState("");

  const [user, setUser] = useState<AuthUser | null>(null);
  const [tab, setTab] = useState<Tab>("catalogue");

  const [summary, setSummary] = useState<LibrarySummary | null>(null);
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);

  const [loans, setLoans] = useState<LibraryLoan[]>([]);
  const [loanStatus, setLoanStatus] = useState<LoanStatus | "">("");
  const [outstandingFines, setOutstandingFines] = useState(0);

  const [myLoans, setMyLoans] = useState<LibraryLoan[]>([]);
  const [myFine, setMyFine] = useState(0);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyBook);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [issueFor, setIssueFor] = useState<LibraryBook | null>(null);
  const [borrower, setBorrower] = useState<DirectoryOption | null>(null);

  const canManage = user?.permissions.includes("library.manage") ?? false;
  const canBorrow = user?.permissions.includes("library.borrow") ?? false;

  const load = useCallback(async () => {
    try {
      const me = await getCurrentUser();
      setUser(me);

      const manage = me.permissions.includes("library.manage");
      const borrow = me.permissions.includes("library.borrow");

      const [summaryData, bookList] = await Promise.all([
        getLibrarySummary(),
        listBooks({
          page,
          search: search || undefined,
          category: category || undefined,
          availableOnly,
        }),
      ]);

      setSummary(summaryData);
      setBooks(bookList.items);
      setCategories(bookList.categories);
      setTotalPages(bookList.meta.totalPages);

      if (manage) {
        const circulation = await listLoans({ status: loanStatus || undefined });
        setLoans(circulation.items);
        setOutstandingFines(circulation.outstandingFines);
      }

      if (borrow) {
        const mine = await listMyLoans();
        setMyLoans(mine.items);
        setMyFine(mine.outstandingFine);
      }

      setState("ready");
    } catch (err) {
      if (err instanceof AuthRequiredError) {
        router.replace("/login");
        return;
      }
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to load library"
      );
      setState("error");
    }
  }, [page, search, category, availableOnly, loanStatus, router]);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    load();
  }, [load, router]);

  async function handleCreateBook(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!form.title || !form.author) {
      setFormError("Title and author are required.");
      return;
    }
    setSubmitting(true);
    try {
      await createBook({
        title: form.title,
        author: form.author,
        isbn: form.isbn || undefined,
        category: form.category || undefined,
        publisher: form.publisher || undefined,
        shelfLocation: form.shelfLocation || undefined,
        totalCopies: Number(form.totalCopies) || 1,
      });
      setForm(emptyBook);
      setShowForm(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to add book");
    } finally {
      setSubmitting(false);
    }
  }

  async function run(action: () => Promise<unknown>) {
    setActionError("");
    try {
      await action();
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
    }
  }

  if (state === "loading") {
    return (
      <DashboardShell title="Library" subtitle="Catalogue and circulation">
        <div className="p-8 text-sm text-slate-500">Loading library…</div>
      </DashboardShell>
    );
  }

  if (state === "error") {
    return (
      <DashboardShell title="Library" subtitle="Catalogue and circulation">
        <div className="m-8 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {errorMessage}
        </div>
      </DashboardShell>
    );
  }

  const tabs: Array<[Tab, string]> = [
    ["catalogue", "Catalogue"],
    ...(canManage ? ([["circulation", "Circulation"]] as Array<[Tab, string]>) : []),
    ...(canBorrow ? ([["mine", "My loans"]] as Array<[Tab, string]>) : []),
  ];

  return (
    <DashboardShell title="Library" subtitle="Catalogue, circulation and fines">
      <main className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        {summary && (
          <section className="grid grid-cols-2 gap-4 lg:grid-cols-6">
            {(
              [
                ["Titles", summary.titles],
                ["Copies", summary.totalCopies],
                ["Available", summary.availableCopies],
                ["Issued", summary.issued],
                ["Reserved", summary.reserved],
                ["Overdue", summary.overdue],
              ] as Array<[string, number]>
            ).map(([label, value]) => (
              <div
                key={label}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {label}
                </p>
                <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
              </div>
            ))}
          </section>
        )}

        <nav className="flex flex-wrap gap-2">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                tab === key
                  ? "bg-slate-950 text-white"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        {actionError && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {actionError}
          </p>
        )}

        {tab === "catalogue" && (
          <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-end gap-3">
              <input
                value={search}
                onChange={(e) => {
                  setPage(1);
                  setSearch(e.target.value);
                }}
                placeholder="Search title, author or ISBN"
                className="min-w-[220px] flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <select
                value={category}
                onChange={(e) => {
                  setPage(1);
                  setCategory(e.target.value);
                }}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">All categories</option>
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={availableOnly}
                  onChange={(e) => {
                    setPage(1);
                    setAvailableOnly(e.target.checked);
                  }}
                />
                Available only
              </label>
              {canManage && (
                <button
                  type="button"
                  onClick={() => setShowForm((v) => !v)}
                  className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white"
                >
                  {showForm ? "Cancel" : "Add book"}
                </button>
              )}
            </div>

            {showForm && canManage && (
              <form
                onSubmit={handleCreateBook}
                className="grid gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-3"
              >
                {(
                  [
                    ["title", "Title"],
                    ["author", "Author"],
                    ["isbn", "ISBN"],
                    ["category", "Category"],
                    ["publisher", "Publisher"],
                    ["shelfLocation", "Shelf location"],
                    ["totalCopies", "Total copies"],
                  ] as Array<[keyof typeof emptyBook, string]>
                ).map(([key, label]) => (
                  <label key={key} className="text-sm">
                    <span className="mb-1 block font-medium text-slate-600">
                      {label}
                    </span>
                    <input
                      value={form[key]}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      type={key === "totalCopies" ? "number" : "text"}
                      min={key === "totalCopies" ? 1 : undefined}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2"
                    />
                  </label>
                ))}
                <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {submitting ? "Saving…" : "Save book"}
                  </button>
                  {formError && (
                    <span className="text-sm text-red-600">{formError}</span>
                  )}
                </div>
              </form>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-2">Title</th>
                    <th>Author</th>
                    <th>Category</th>
                    <th>Shelf</th>
                    <th>Available</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {books.map((book) => (
                    <tr key={book.id}>
                      <td className="py-3 font-semibold text-slate-900">
                        {book.title}
                        {book.isbn && (
                          <span className="block text-xs font-normal text-slate-400">
                            {book.isbn}
                          </span>
                        )}
                      </td>
                      <td className="text-slate-600">{book.author}</td>
                      <td className="text-slate-600">{book.category || "—"}</td>
                      <td className="text-slate-600">
                        {book.shelfLocation || "—"}
                      </td>
                      <td className="text-slate-600">
                        {book.availableCopies}/{book.totalCopies}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-2">
                          {canBorrow && book.availableCopies > 0 && (
                            <button
                              type="button"
                              onClick={() => run(() => reserveBook(book.id))}
                              className="rounded-lg bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700"
                            >
                              Reserve
                            </button>
                          )}
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => {
                                setIssueFor(book);
                                setBorrower(null);
                              }}
                              className="rounded-lg bg-slate-900 px-3 py-1 text-xs font-semibold text-white"
                            >
                              Issue
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {books.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-500">
                        No books match this filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </section>
        )}

        {issueFor && canManage && (
          <section className="rounded-3xl border border-indigo-200 bg-indigo-50 p-6">
            <h2 className="text-lg font-bold text-slate-900">
              Issue “{issueFor.title}”
            </h2>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div className="w-80">
                <EntityPicker
                  kind="user"
                  label="Borrower"
                  placeholder="Search by name or email"
                  value={borrower}
                  onChange={setBorrower}
                  required
                />
              </div>
              <button
                type="button"
                disabled={!borrower}
                onClick={() =>
                  run(async () => {
                    if (!borrower) return;
                    await issueBook({
                      bookId: issueFor.id,
                      borrowerId: borrower.id,
                    });
                    setIssueFor(null);
                    setBorrower(null);
                  })
                }
                className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
              >
                Confirm issue
              </button>
              <button
                type="button"
                onClick={() => setIssueFor(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600"
              >
                Cancel
              </button>
            </div>
          </section>
        )}

        {tab === "circulation" && canManage && (
          <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <select
                value={loanStatus}
                onChange={(e) =>
                  setLoanStatus(e.target.value as LoanStatus | "")
                }
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">All loans</option>
                <option value="ISSUED">Issued</option>
                <option value="RESERVED">Reserved</option>
                <option value="OVERDUE">Overdue</option>
                <option value="RETURNED">Returned</option>
                <option value="LOST">Lost</option>
              </select>
              <p className="text-sm font-semibold text-slate-600">
                Fines recorded: {money(outstandingFines)}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-2">Book</th>
                    <th>Borrower</th>
                    <th>Issued</th>
                    <th>Due</th>
                    <th>Status</th>
                    <th>Fine</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loans.map((loan) => (
                    <tr key={loan.id}>
                      <td className="py-3 font-semibold text-slate-900">
                        {loan.book.title}
                      </td>
                      <td className="text-slate-600">
                        {loan.borrower.firstName} {loan.borrower.lastName}
                      </td>
                      <td className="text-slate-600">{day(loan.issuedAt)}</td>
                      <td
                        className={
                          loan.isOverdue
                            ? "font-semibold text-red-600"
                            : "text-slate-600"
                        }
                      >
                        {day(loan.dueDate)}
                      </td>
                      <td>
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${
                            STATUS_STYLES[loan.status] ??
                            "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {loan.status}
                        </span>
                      </td>
                      <td className="text-slate-600">
                        {money(
                          loan.status === "ISSUED"
                            ? loan.accruedFine
                            : loan.fineAmount
                        )}
                      </td>
                      <td className="py-3 text-right">
                        {["ISSUED", "RESERVED"].includes(loan.status) && (
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                run(() =>
                                  returnLoan(loan.id, { condition: "RETURNED" })
                                )
                              }
                              className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white"
                            >
                              Return
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                run(() =>
                                  returnLoan(loan.id, { condition: "LOST" })
                                )
                              }
                              className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white"
                            >
                              Mark lost
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {loans.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-slate-500">
                        No circulation records for this filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "mine" && canBorrow && (
          <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-slate-600">
              Outstanding fine: {money(myFine)}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-2">Book</th>
                    <th>Due</th>
                    <th>Status</th>
                    <th>Fine</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {myLoans.map((loan) => (
                    <tr key={loan.id}>
                      <td className="py-3 font-semibold text-slate-900">
                        {loan.book.title}
                      </td>
                      <td
                        className={
                          loan.isOverdue
                            ? "font-semibold text-red-600"
                            : "text-slate-600"
                        }
                      >
                        {day(loan.dueDate)}
                      </td>
                      <td>
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${
                            STATUS_STYLES[loan.status] ??
                            "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {loan.status}
                        </span>
                      </td>
                      <td className="text-slate-600">
                        {money(
                          loan.status === "ISSUED"
                            ? loan.accruedFine
                            : loan.fineAmount
                        )}
                      </td>
                      <td className="py-3 text-right">
                        {loan.status === "RESERVED" && (
                          <button
                            type="button"
                            onClick={() => run(() => cancelReservation(loan.id))}
                            className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600"
                          >
                            Cancel hold
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {myLoans.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-500">
                        You have no loans or holds.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </DashboardShell>
  );
}

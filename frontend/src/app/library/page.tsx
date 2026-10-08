"use client";

import EntityPicker from "@/components/common/EntityPicker";
import { DirectoryOption } from "@/lib/directoryApi";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  updateBook,
  LibraryFine,
  listLibraryFines,
  LibraryBookCopy,
  listBookCopies,
  getLibraryPolicy,
  LibraryPolicy,
  requestFineWaiver,
  approveFineWaiver,
  imposeLateReturnFine,
} from "@/lib/libraryApi";

type ViewState = "loading" | "ready" | "error";
type Tab = "catalogue" | "circulation" | "fines" | "mine";

const emptyBook = {
  title: "",
  author: "",
  isbn: "",
  category: "",
  publisher: "",
  shelfLocation: "",
  totalCopies: "1",
  defaultAcquisitionCost: "",
  defaultReplacementValue: "",
  defaultCurrentValue: "",
  defaultLoanDays: "",
  defaultMaxRenewals: "",
  defaultFinePerDay: "",
  defaultFineCap: "",
  defaultGracePeriodDays: "",
};

const STATUS_STYLES: Record<string, string> = {
  ISSUED: "bg-amber-100 text-amber-700",
  RESERVED: "bg-indigo-100 text-indigo-700",
  RETURNED: "bg-emerald-100 text-emerald-700",
  LOST: "bg-red-100 text-red-700",
  DAMAGED: "bg-amber-100 text-amber-700",
};

const money = (value: number) => `₹${value.toFixed(2)}`;
const day = (value: string | null) =>
  value ? new Date(value).toLocaleDateString() : "—";

export default function LibraryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<ViewState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [actionError, setActionError] = useState("");

  const [user, setUser] = useState<AuthUser | null>(null);
  const [tab, setTab] = useState<Tab>("catalogue");
  useEffect(() => {
    const requested = searchParams.get("tab");
    if (requested === "circulation" || requested === "fines" || requested === "mine" || requested === "catalogue") {
      setTab(requested);
    }
  }, [searchParams]);

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
  const [fines, setFines] = useState<LibraryFine[]>([]);
  const [policy, setPolicy] = useState<LibraryPolicy | null>(null);
  const [issueCopies, setIssueCopies] = useState<LibraryBookCopy[]>([]);
  const [issueCopyId, setIssueCopyId] = useState("");
  const [issueDueDate, setIssueDueDate] = useState("");
  const [issueLoanDays, setIssueLoanDays] = useState("");
  const [issueRenewals, setIssueRenewals] = useState("");
  const [issueFinePerDay, setIssueFinePerDay] = useState("");
  const [issueFineCap, setIssueFineCap] = useState("");
  const [issueGraceDays, setIssueGraceDays] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyBook);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [issueFor, setIssueFor] = useState<LibraryBook | null>(null);
  const [borrower, setBorrower] = useState<DirectoryOption | null>(null);

  const canManage = user?.permissions.includes("library.manage") ?? false;
  const canBorrow = user?.permissions.includes("library.borrow") ?? false;
  const canRequestWaiver = user?.permissions.includes("library.fines.waive.request") ?? false;
  const canApproveWaiver = user?.permissions.includes("library.fines.waive.approve") ?? false;

  const load = useCallback(async () => {
    try {
      const me = await getCurrentUser();
      setUser(me);

      const manage = me.permissions.includes("library.manage");
      const borrow = me.permissions.includes("library.borrow");

      /*
       * Library is a multi-surface workspace. Do not let a failure in the
       * financial/fines or circulation surface take down the catalogue for
       * the librarian. Backend failures are surfaced per surface instead of
       * turning the entire page into "Internal server error".
       */
      const [summaryResult, booksResult] = await Promise.allSettled([
        getLibrarySummary(),
        listBooks({
          page,
          search: search || undefined,
          category: category || undefined,
          availableOnly,
        }),
      ]);

      const surfaceErrors: string[] = [];

      if (summaryResult.status === "fulfilled") {
        setSummary(summaryResult.value);
      } else {
        surfaceErrors.push(
          summaryResult.reason instanceof Error
            ? summaryResult.reason.message
            : "Library summary is temporarily unavailable."
        );
      }

      if (booksResult.status === "fulfilled") {
        setBooks(booksResult.value.items);
        setCategories(booksResult.value.categories);
        setTotalPages(booksResult.value.meta.totalPages);
      } else {
        surfaceErrors.push(
          booksResult.reason instanceof Error
            ? booksResult.reason.message
            : "Library catalogue is temporarily unavailable."
        );
      }

      if (manage) {
        const [policyResult, circulationResult, finesResult] = await Promise.allSettled([
          getLibraryPolicy(),

          listLoans({ status: loanStatus || undefined }),
          listLibraryFines({ page: 1 }),
        ]);

        if (policyResult.status === "fulfilled") {
          setPolicy(policyResult.value);
        } else {
          surfaceErrors.push(
            policyResult.reason instanceof Error
              ? policyResult.reason.message
              : "Library policy is temporarily unavailable."
          );
        }

        if (circulationResult.status === "fulfilled") {
          setLoans(circulationResult.value.items);
          setOutstandingFines(circulationResult.value.outstandingFines);
        } else {
          surfaceErrors.push(
            circulationResult.reason instanceof Error
              ? circulationResult.reason.message
              : "Circulation is temporarily unavailable."
          );
        }

        if (finesResult.status === "fulfilled") {
          setFines(finesResult.value.items);
        } else {
          surfaceErrors.push(
            finesResult.reason instanceof Error
              ? finesResult.reason.message
              : "Fine records are temporarily unavailable."
          );
        }
      }

      if (borrow) {
        const mineResult = await Promise.allSettled([listMyLoans()]);
        if (mineResult[0].status === "fulfilled") {
          setMyLoans(mineResult[0].value.items);
          setMyFine(mineResult[0].value.outstandingFine);
        } else {
          surfaceErrors.push(
            mineResult[0].reason instanceof Error
              ? mineResult[0].reason.message
              : "My loans are temporarily unavailable."
          );
        }
      }

      setErrorMessage(
        surfaceErrors.length
          ? [...new Set(surfaceErrors)].join(" ")
          : ""
      );
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

  async function openIssue(book: LibraryBook) {
    setIssueFor(book);
    setBorrower(null);
    const result = await listBookCopies({ bookId: book.id, status: "AVAILABLE", page: 1 });
    setIssueCopies(result.items);
    setIssueCopyId(result.items[0]?.id ?? "");
    const days = book.defaultLoanDays ?? policy?.defaultLoanDays;
    const due = days ? new Date(Date.now() + days * 86_400_000) : null;
    setIssueLoanDays(days ? String(days) : "");
    setIssueDueDate(due ? due.toISOString().slice(0, 16) : "");
    setIssueRenewals(String(book.defaultMaxRenewals ?? policy?.maxRenewals ?? ""));
    setIssueFinePerDay(String(book.defaultFinePerDay ?? policy?.dailyFine ?? ""));
    setIssueFineCap(String(book.defaultFineCap ?? policy?.fineCap ?? ""));
    setIssueGraceDays(String(book.defaultGracePeriodDays ?? policy?.gracePeriodDays ?? ""));
  }

  function startEditBook(book: LibraryBook) {
    setEditingBookId(book.id);
    setForm({
      title: book.title,
      author: book.author,
      isbn: book.isbn ?? "",
      category: book.category ?? "",
      publisher: book.publisher ?? "",
      shelfLocation: book.shelfLocation ?? "",
      totalCopies: String(book.totalCopies),
      defaultAcquisitionCost: book.defaultAcquisitionCost?.toString() ?? "",
      defaultReplacementValue: book.defaultReplacementValue?.toString() ?? "",
      defaultCurrentValue: book.defaultCurrentValue?.toString() ?? "",
      defaultLoanDays: book.defaultLoanDays?.toString() ?? "",
      defaultMaxRenewals: book.defaultMaxRenewals?.toString() ?? "",
      defaultFinePerDay: book.defaultFinePerDay?.toString() ?? "",
      defaultFineCap: book.defaultFineCap?.toString() ?? "",
      defaultGracePeriodDays: book.defaultGracePeriodDays?.toString() ?? "",
    });
    setFormError("");
    setShowForm(true);
  }

  function handleNewBook() {
    setEditingBookId(null);
    setForm(emptyBook);
    setFormError("");
    setShowForm((v) => !v);
  }

  async function handleCreateBook(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!form.title || !form.author) {
      setFormError("Title and author are required.");
      return;
    }
    setSubmitting(true);
    try {
      if (editingBookId) {
        await updateBook(editingBookId, {
          title: form.title,
          author: form.author,
          isbn: form.isbn || undefined,
          category: form.category || undefined,
          publisher: form.publisher || undefined,
          shelfLocation: form.shelfLocation || undefined,
          totalCopies: Number(form.totalCopies) || 1,
          defaultAcquisitionCost: form.defaultAcquisitionCost ? Number(form.defaultAcquisitionCost) : undefined,
          defaultReplacementValue: form.defaultReplacementValue ? Number(form.defaultReplacementValue) : undefined,
          defaultCurrentValue: form.defaultCurrentValue ? Number(form.defaultCurrentValue) : undefined,
          defaultLoanDays: form.defaultLoanDays ? Number(form.defaultLoanDays) : undefined,
          defaultMaxRenewals: form.defaultMaxRenewals ? Number(form.defaultMaxRenewals) : undefined,
          defaultFinePerDay: form.defaultFinePerDay ? Number(form.defaultFinePerDay) : undefined,
          defaultFineCap: form.defaultFineCap ? Number(form.defaultFineCap) : undefined,
          defaultGracePeriodDays: form.defaultGracePeriodDays ? Number(form.defaultGracePeriodDays) : undefined,
        });
      } else {
        await createBook({
          title: form.title,
          author: form.author,
          isbn: form.isbn || undefined,
          category: form.category || undefined,
          publisher: form.publisher || undefined,
          shelfLocation: form.shelfLocation || undefined,
          totalCopies: Number(form.totalCopies) || 1,
          defaultAcquisitionCost: form.defaultAcquisitionCost ? Number(form.defaultAcquisitionCost) : undefined,
          defaultReplacementValue: form.defaultReplacementValue ? Number(form.defaultReplacementValue) : undefined,
          defaultCurrentValue: form.defaultCurrentValue ? Number(form.defaultCurrentValue) : undefined,
          defaultLoanDays: form.defaultLoanDays ? Number(form.defaultLoanDays) : undefined,
          defaultMaxRenewals: form.defaultMaxRenewals ? Number(form.defaultMaxRenewals) : undefined,
          defaultFinePerDay: form.defaultFinePerDay ? Number(form.defaultFinePerDay) : undefined,
          defaultFineCap: form.defaultFineCap ? Number(form.defaultFineCap) : undefined,
          defaultGracePeriodDays: form.defaultGracePeriodDays ? Number(form.defaultGracePeriodDays) : undefined,
        });
      }
      setForm(emptyBook);
      setEditingBookId(null);
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
    ...(canManage ? ([["fines", "Fines"]] as Array<[Tab, string]>) : []),
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
                ...(canManage ? [["Fine outstanding", summary.outstandingFines]] as Array<[string, number]> : []),
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

        {errorMessage && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <p className="font-semibold">Some library data is temporarily unavailable.</p>
            <p className="mt-1">{errorMessage}</p>
          </div>
        )}

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
                  onClick={handleNewBook}
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
                    ["defaultAcquisitionCost", "Default acquisition cost"],
                    ["defaultReplacementValue", "Default replacement value"],
                    ["defaultCurrentValue", "Default current value"],
                    ["defaultLoanDays", "Default loan days"],
                    ["defaultMaxRenewals", "Default renewals"],
                    ["defaultFinePerDay", "Default fine / day"],
                    ["defaultFineCap", "Default fine cap"],
                    ["defaultGracePeriodDays", "Default grace days"],
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
                      type={key !== "title" && key !== "author" && key !== "isbn" && key !== "category" && key !== "publisher" && key !== "shelfLocation" ? "number" : "text"}
                      min={key !== "title" && key !== "author" && key !== "isbn" && key !== "category" && key !== "publisher" && key !== "shelfLocation" ? 0 : undefined}
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
                    {submitting ? "Saving…" : editingBookId ? "Save changes" : "Save book"}
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
                            <>
                              <button
                                type="button"
                                onClick={() => startEditBook(book)}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                              >
                                Edit
                              </button>
                              {book.isActive && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    run(async () => {
                                      await updateBook(book.id, { isActive: false });
                                    })
                                  }
                                  className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700"
                                >
                                  Archive
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => void openIssue(book)}
                                className="rounded-lg bg-slate-900 px-3 py-1 text-xs font-semibold text-white"
                              >
                                Issue
                              </button>
                            </>
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
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <EntityPicker
                kind="user"
                label="Borrower"
                placeholder="Search by name or email"
                value={borrower}
                onChange={setBorrower}
                required
              />
              <label className="text-sm text-slate-700">
                <span className="mb-1 block font-medium">Physical copy</span>
                <select value={issueCopyId} onChange={(e) => setIssueCopyId(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2">
                  {issueCopies.map((copy) => <option key={copy.id} value={copy.id}>{copy.accessionNumber}{copy.barcode ? ` · ${copy.barcode}` : ""}</option>)}
                </select>
              </label>
              <label className="text-sm text-slate-700"><span className="mb-1 block font-medium">Expected return</span><input type="datetime-local" value={issueDueDate} onChange={(e) => setIssueDueDate(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2" /></label>
              <label className="text-sm text-slate-700"><span className="mb-1 block font-medium">Loan days</span><input type="number" min="1" value={issueLoanDays} onChange={(e) => setIssueLoanDays(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2" /></label>
              <label className="text-sm text-slate-700"><span className="mb-1 block font-medium">Renewals</span><input type="number" min="0" value={issueRenewals} onChange={(e) => setIssueRenewals(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2" /></label>
              <label className="text-sm text-slate-700"><span className="mb-1 block font-medium">Daily fine</span><input type="number" min="0" step="0.01" value={issueFinePerDay} onChange={(e) => setIssueFinePerDay(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2" /></label>
              <label className="text-sm text-slate-700"><span className="mb-1 block font-medium">Fine cap</span><input type="number" min="0" step="0.01" value={issueFineCap} onChange={(e) => setIssueFineCap(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2" /></label>
              <label className="text-sm text-slate-700"><span className="mb-1 block font-medium">Grace days</span><input type="number" min="0" value={issueGraceDays} onChange={(e) => setIssueGraceDays(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2" /></label>
              <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={!borrower}
                onClick={() =>
                  run(async () => {
                    if (!borrower) return;
                    await issueBook({
                      bookId: issueFor.id,
                      borrowerId: borrower.id,
                      copyId: issueCopyId || undefined,
                      dueDate: issueDueDate ? new Date(issueDueDate).toISOString() : undefined,
                      loanPeriodDays: issueLoanDays ? Number(issueLoanDays) : undefined,
                      renewalsAllowed: issueRenewals ? Number(issueRenewals) : undefined,
                      finePerDay: issueFinePerDay ? Number(issueFinePerDay) : undefined,
                      fineCap: issueFineCap ? Number(issueFineCap) : undefined,
                      gracePeriodDays: issueGraceDays ? Number(issueGraceDays) : undefined,
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
                            ? loan.financialBalance || loan.accruedFine
                            : loan.financialBalance || loan.fineAmount
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
                            <button
                              type="button"
                              onClick={() =>
                                run(() =>
                                  returnLoan(loan.id, { condition: "DAMAGED" })
                                )
                              }
                              className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700"
                            >
                              Mark damaged
                            </button>
                            {loan.isOverdue && loan.status === "ISSUED" && loan.accruedFine > 0 && (
                              <button
                                type="button"
                                onClick={() => run(() => imposeLateReturnFine(loan.id))}
                                className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700"
                              >
                                Impose late fine
                              </button>
                            )}
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

        {tab === "fines" && canManage && (
          <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Library financial charges</h2>
              <p className="mt-1 text-sm text-slate-500">Every fine is linked to the Library issue and the canonical Accounts invoice.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500"><tr>
                  <th className="py-2">Book</th><th>Type</th><th>Original</th><th>Waived</th><th>Financial balance</th><th>Status</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {fines.map((fine) => {
                    const invoice = fine.financialInvoice;
                    const balance = invoice ? Math.max(0, invoice.amount - invoice.paidAmount) : 0;
                    return <tr key={fine.id}>
                      <td className="py-3 font-semibold text-slate-900">{fine.issue.book.title}</td>
                      <td className="text-slate-600">{fine.type}</td>
                      <td className="text-slate-600">{money(Number(fine.originalAmount))}</td>
                      <td className="text-slate-600">{money(Number(fine.waivedAmount))}</td>
                      <td className="text-slate-600">{money(balance)}</td>
                      <td>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">{fine.status}</span>
                        {balance > 0 && canRequestWaiver && fine.status !== "WAIVER_REQUESTED" && (
                          <button type="button" className="ml-2 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold"
                            onClick={() => { const reason = window.prompt("Waiver reason"); if (reason) void run(() => requestFineWaiver(fine.id, reason)); }}>
                            Request waiver
                          </button>
                        )}
                        {balance > 0 && canApproveWaiver && (fine.status === "WAIVER_REQUESTED" || fine.status === "OUTSTANDING" || fine.status === "PARTIAL") && (
                          <button type="button" className="ml-2 rounded-lg bg-slate-900 px-2 py-1 text-xs font-semibold text-white"
                            onClick={() => { const reason = window.prompt("Approval reason"); const amount = window.prompt("Waiver amount", String(balance)); if (reason && amount) void run(() => approveFineWaiver(fine.id, Number(amount), reason)); }}>
                            Approve waiver
                          </button>
                        )}
                      </td>
                    </tr>;
                  })}
                  {fines.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-slate-500">No library financial charges.</td></tr>}
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
                            ? loan.financialBalance || loan.accruedFine
                            : loan.financialBalance || loan.fineAmount
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

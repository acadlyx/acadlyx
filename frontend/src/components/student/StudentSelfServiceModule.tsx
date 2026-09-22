"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import {
  AuthRequiredError,
  AuthUser,
  getCurrentUser,
  isAuthenticated,
} from "@/lib/auth";
import { getStudentFees, StudentFeeSummary } from "@/lib/billingApi";
import { getStudentExaminations } from "@/lib/examinationsApi";
import { getMyTranscript, Transcript } from "@/lib/gradesApi";
import {
  LibraryBook,
  LibraryLoan,
  listBooks,
  listMyLoans,
  reserveBook,
} from "@/lib/libraryApi";
import {
  AvailableOffering,
  MyRegistrationSummary,
  getMyRegistrations,
  listAvailableOfferings,
  registerForOffering,
  dropRegistration,
} from "@/lib/registrationApi";
import {
  LeaveBalance,
  LeaveRequest,
  LeaveType,
  applyLeave,
  getLeaveBalances,
  listLeaveTypes,
  listMyLeaveRequests,
} from "@/lib/leaveApi";

export type StudentModule =
  | "fees"
  | "examinations"
  | "results"
  | "library"
  | "registration"
  | "leave";

const TITLES: Record<StudentModule, { title: string; subtitle: string }> = {
  fees: {
    title: "My Fees",
    subtitle: "Your invoices, payments and outstanding balance",
  },
  examinations: {
    title: "My Examinations",
    subtitle: "Your upcoming examinations and published results",
  },
  results: {
    title: "My Results",
    subtitle: "Your transcript, grades, SGPA and CGPA",
  },
  library: {
    title: "My Library",
    subtitle: "Your loans, reservations and the library catalogue",
  },
  registration: {
    title: "My Course Registration",
    subtitle: "Browse eligible courses and manage your registrations",
  },
  leave: {
    title: "My Leave",
    subtitle: "Your leave balances, requests and applications",
  },
};

const money = (value: number) =>
  value.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
  });

const date = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString("en-IN") : "—";

function Card({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-bold text-slate-950">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl bg-slate-50 px-4 py-5 text-sm text-slate-500">
      {children}
    </p>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {message}
    </div>
  );
}

function FeesView({ user }: { user: AuthUser }) {
  const [data, setData] = useState<StudentFeeSummary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getStudentFees(user.id)
      .then(setData)
      .catch(() =>
        setError(
          "We could not load your fee information right now. Please try again.",
        ),
      );
  }, [user.id]);

  if (error) {
    return <ErrorBox message={error} />;
  }

  if (!data) {
    return <Empty>Loading your fee information…</Empty>;
  }

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Card title="Outstanding">
        <p className="text-3xl font-black text-slate-950">
          {money(data.summary.outstanding)}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {data.summary.overdueCount} overdue invoice(s)
        </p>
      </Card>

      <Card title="Billed">
        <p className="text-3xl font-black text-slate-950">
          {money(data.summary.billed)}
        </p>
      </Card>

      <Card title="Paid">
        <p className="text-3xl font-black text-emerald-700">
          {money(data.summary.paid)}
        </p>
      </Card>

      <Card title="My invoices">
        {data.invoices.length === 0 ? (
          <Empty>No invoices are currently assigned to you.</Empty>
        ) : (
          <div className="space-y-3">
            {data.invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 p-4"
              >
                <div>
                  <p className="font-semibold text-slate-900">
                    {invoice.title}
                  </p>
                  <p className="text-xs text-slate-500">
                    Due {date(invoice.dueDate)}
                  </p>
                </div>

                <div className="text-right">
                  <p className="font-bold">
                    {money(invoice.amount + invoice.lateFeeAmount)}
                  </p>
                  <p className="text-xs text-slate-500">
                    Outstanding {money(invoice.outstanding)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Recent payments">
        {data.payments.length === 0 ? (
          <Empty>No payments found.</Empty>
        ) : (
          <div className="space-y-3">
            {data.payments.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between rounded-2xl bg-slate-50 p-4"
              >
                <div>
                  <p className="font-semibold">{payment.invoiceTitle}</p>
                  <p className="text-xs text-slate-500">
                    {date(payment.paidAt)} · {payment.method}
                  </p>
                </div>

                <span className="font-bold text-emerald-700">
                  {money(payment.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function ExaminationsView({ user }: { user: AuthUser }) {
  const [data, setData] = useState<{
    upcoming: Array<Record<string, unknown>>;
    results: Array<Record<string, unknown>>;
  } | null>(null);

  const [error, setError] = useState("");

  useEffect(() => {
    getStudentExaminations(user.id)
      .then(setData)
      .catch(() =>
        setError("We could not load your examination schedule."),
      );
  }, [user.id]);

  if (error) {
    return <ErrorBox message={error} />;
  }

  if (!data) {
    return <Empty>Loading your examinations…</Empty>;
  }

  const text = (value: unknown) =>
    typeof value === "string" || typeof value === "number"
      ? String(value)
      : "—";

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title="Upcoming examinations">
        {data.upcoming.length === 0 ? (
          <Empty>
            No upcoming examinations are currently published for you.
          </Empty>
        ) : (
          <div className="space-y-3">
            {data.upcoming.map((exam, index) => (
              <div
                key={String(exam.examScheduleId ?? index)}
                className="rounded-2xl border border-slate-100 p-4"
              >
                <p className="font-bold">
                  {text(exam.courseName ?? exam.courseCode)}
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  {text(exam.examDate)} · {text(exam.startTime)}–
                  {text(exam.endTime)}
                </p>

                {exam.roomName ? (
                  <p className="mt-1 text-sm text-slate-600">
                    Room: {text(exam.roomName)}
                  </p>
                ) : null}

                {exam.seatNumber ? (
                  <p className="mt-1 text-sm font-semibold text-slate-700">
                    Seat: {text(exam.seatNumber)}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Published results">
        {data.results.length === 0 ? (
          <Empty>
            No published examination results are available yet.
          </Empty>
        ) : (
          <div className="space-y-3">
            {data.results.map((result, index) => (
              <div
                key={`${String(result.courseCode ?? "")}-${index}`}
                className="flex items-center justify-between rounded-2xl bg-slate-50 p-4"
              >
                <div>
                  <p className="font-semibold">
                    {text(result.courseName ?? result.courseCode)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {text(result.sessionName)}
                  </p>
                </div>

                <span className="font-bold">
                  {text(result.marksObtained)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function ResultsView({ user }: { user: AuthUser }) {
  const [data, setData] = useState<Transcript | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getMyTranscript()
      .then(setData)
      .catch(() => setError("We could not load your results."));
  }, [user.id]);

  if (error) {
    return <ErrorBox message={error} />;
  }

  if (!data) {
    return <Empty>Loading your results…</Empty>;
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Card title="CGPA">
          <p className="text-3xl font-black">{data.cgpa ?? "—"}</p>
        </Card>

        <Card title="Credits earned">
          <p className="text-3xl font-black">{data.creditsEarned}</p>
        </Card>

        <Card title="Total credits">
          <p className="text-3xl font-black">{data.totalCredits}</p>
        </Card>

        <Card title="Percentage equivalent">
          <p className="text-3xl font-black">
            {data.percentageEquivalent === null
              ? "—"
              : `${data.percentageEquivalent.toFixed(1)}%`}
          </p>
        </Card>
      </div>

      <Card title="My transcript">
        {data.semesters.length === 0 ? (
          <Empty>No published transcript records are available.</Empty>
        ) : (
          <div className="space-y-4">
            {data.semesters.map((semester) => (
              <div
                key={semester.semesterId}
                className="rounded-2xl border border-slate-100 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold">{semester.semesterName}</p>
                    <p className="text-xs text-slate-500">
                      {semester.academicYearName}
                    </p>
                  </div>

                  <span className="text-sm font-semibold">
                    SGPA {semester.sgpa ?? "—"}
                  </span>
                </div>

                <div className="mt-3 space-y-2">
                  {semester.courses.map((course) => (
                    <div
                      key={course.courseOfferingId}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-semibold">{course.courseName}</p>
                        <p className="text-xs text-slate-500">
                          {course.courseCode} · {course.credits} credit(s)
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="font-bold">
                          {course.letter ?? "—"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {course.percentage === null
                            ? "—"
                            : `${course.percentage.toFixed(1)}%`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function LibraryView() {
  const [loans, setLoans] = useState<{
    items: LibraryLoan[];
    activeCount: number;
    outstandingFine: number;
  } | null>(null);

  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [loanData, bookData] = await Promise.all([
        listMyLoans(),
        listBooks({
          page: 1,
          search: query || undefined,
          availableOnly: true,
        }),
      ]);

      setLoans(loanData);
      setBooks(bookData.items);
    } catch {
      setError("We could not load your library information.");
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  async function reserve(id: string) {
    setBusy(id);
    setError("");

    try {
      await reserveBook(id);
      await load();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "The reservation could not be completed.",
      );
    } finally {
      setBusy("");
    }
  }

  if (!loans) {
    return <Empty>Loading your library…</Empty>;
  }

  return (
    <div className="space-y-5">
      {error ? <ErrorBox message={error} /> : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Card title="Active loans">
          <p className="text-3xl font-black">{loans.activeCount}</p>
        </Card>

        <Card title="Outstanding fine">
          <p className="text-3xl font-black">
            {money(loans.outstandingFine)}
          </p>
        </Card>
      </div>

      <Card title="My loans">
        {loans.items.length === 0 ? (
          <Empty>You have no library loans.</Empty>
        ) : (
          <div className="space-y-3">
            {loans.items.map((loan) => (
              <div
                key={loan.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 p-4"
              >
                <div>
                  <p className="font-semibold">{loan.book.title}</p>
                  <p className="text-xs text-slate-500">
                    Due {date(loan.dueDate)} · {loan.status}
                  </p>
                </div>

                {loan.fineAmount > 0 ? (
                  <span className="font-semibold text-red-600">
                    {money(loan.fineAmount)}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Catalogue">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search available books…"
          className="mb-4 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm outline-none focus:border-slate-500"
        />

        <div className="space-y-3">
          {books.map((book) => (
            <div
              key={book.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4"
            >
              <div>
                <p className="font-semibold">{book.title}</p>
                <p className="text-xs text-slate-500">
                  {book.author} · {book.availableCopies} available
                </p>
              </div>

              <button
                type="button"
                disabled={busy === book.id || book.availableCopies < 1}
                onClick={() => void reserve(book.id)}
                className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
              >
                {busy === book.id ? "Working…" : "Reserve"}
              </button>
            </div>
          ))}

          {books.length === 0 ? (
            <Empty>No matching available books were found.</Empty>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

function RegistrationView() {
  const [offerings, setOfferings] = useState<AvailableOffering[]>([]);
  const [mine, setMine] = useState<MyRegistrationSummary | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [available, current] = await Promise.all([
        listAvailableOfferings({}),
        getMyRegistrations(),
      ]);

      setOfferings(available.items);
      setMine(current);
    } catch {
      setError(
        "We could not load your course registration information.",
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function register(id: string) {
    setBusy(id);
    setError("");

    try {
      await registerForOffering(id);
      await load();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Registration could not be submitted.",
      );
    } finally {
      setBusy("");
    }
  }

  async function drop(id: string) {
    setBusy(id);
    setError("");

    try {
      await dropRegistration(id);
      await load();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Registration could not be dropped.",
      );
    } finally {
      setBusy("");
    }
  }

  if (!mine) {
    return <Empty>Loading your registration…</Empty>;
  }

  return (
    <div className="space-y-5">
      {error ? <ErrorBox message={error} /> : null}

      <Card title="My registrations">
        {mine.items.length === 0 ? (
          <Empty>You have no course registrations yet.</Empty>
        ) : (
          <div className="space-y-3">
            {mine.items.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 p-4"
              >
                <div>
                  <p className="font-semibold">
                    {item.courseOffering.course.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {item.courseOffering.course.code} · {item.status}
                  </p>
                </div>

                {item.status === "REQUESTED" ||
                item.status === "APPROVED" ? (
                  <button
                    type="button"
                    disabled={busy === item.id}
                    onClick={() => void drop(item.id)}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold"
                  >
                    {busy === item.id ? "Working…" : "Drop"}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Eligible courses">
        {offerings.length === 0 ? (
          <Empty>No eligible courses are currently open for registration.</Empty>
        ) : (
          <div className="space-y-3">
            {offerings.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4"
              >
                <div>
                  <p className="font-semibold">{item.course.name}</p>
                  <p className="text-xs text-slate-500">
                    {item.course.code} · {item.seatsLeft ?? 0} seat(s)
                    available
                  </p>
                </div>

                <button
                  type="button"
                  disabled={
                    busy === item.id ||
                    item.seatsLeft === 0 ||
                    item.registrationOpen === false
                  }
                  onClick={() => void register(item.id)}
                  className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                >
                  {busy === item.id ? "Working…" : "Register"}
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function LeaveView() {
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [mine, setMine] = useState<LeaveRequest[]>([]);
  const [form, setForm] = useState({
    leaveTypeId: "",
    fromDate: "",
    toDate: "",
    reason: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [typeList, balanceList, requestList] = await Promise.all([
        listLeaveTypes(),
        getLeaveBalances(),
        listMyLeaveRequests({ page: 1 }),
      ]);

      setTypes(typeList);
      setBalances(balanceList);
      setMine(requestList.items);

      if (!form.leaveTypeId && typeList[0]) {
        setForm((old) => ({
          ...old,
          leaveTypeId: typeList[0].id,
        }));
      }
    } catch {
      setError("We could not load your leave information.");
    }
  }, [form.leaveTypeId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(event: FormEvent) {
    event.preventDefault();

    if (
      !form.leaveTypeId ||
      !form.fromDate ||
      !form.toDate ||
      !form.reason.trim()
    ) {
      setError("Leave type, dates and reason are required.");
      return;
    }

    if (form.toDate < form.fromDate) {
      setError("The end date cannot be before the start date.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      await applyLeave(form);

      setForm((old) => ({
        ...old,
        fromDate: "",
        toDate: "",
        reason: "",
      }));

      await load();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Your leave request could not be submitted.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {error ? <ErrorBox message={error} /> : null}

      <Card title="Leave balance">
        {balances.length === 0 ? (
          <Empty>No leave balances are currently configured for you.</Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {balances.map((balance) => (
              <div
                key={balance.leaveTypeId}
                className="rounded-2xl bg-slate-50 p-4"
              >
                <p className="font-semibold">{balance.name}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {balance.remaining ?? "Unlimited"} remaining
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Apply for leave">
          <form onSubmit={submit} className="space-y-3">
            <select
              value={form.leaveTypeId}
              onChange={(event) =>
                setForm({
                  ...form,
                  leaveTypeId: event.target.value,
                })
              }
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              required
            >
              <option value="">Select leave type</option>
              {types.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={form.fromDate}
                onChange={(event) =>
                  setForm({
                    ...form,
                    fromDate: event.target.value,
                  })
                }
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                required
              />

              <input
                type="date"
                value={form.toDate}
                onChange={(event) =>
                  setForm({
                    ...form,
                    toDate: event.target.value,
                  })
                }
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                required
              />
            </div>

            <textarea
              value={form.reason}
              onChange={(event) =>
                setForm({
                  ...form,
                  reason: event.target.value,
                })
              }
              placeholder="Reason"
              className="min-h-28 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              required
            />

            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Submitting…" : "Submit leave request"}
            </button>
          </form>
        </Card>

        <Card title="My requests">
          {mine.length === 0 ? (
            <Empty>No leave requests found.</Empty>
          ) : (
            <div className="space-y-3">
              {mine.map((request) => (
                <div
                  key={request.id}
                  className="rounded-2xl border border-slate-100 p-4"
                >
                  <div className="flex justify-between gap-3">
                    <p className="font-semibold">
                      {request.leaveType.name}
                    </p>

                    <span className="text-xs font-semibold">
                      {request.status}
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-slate-500">
                    {date(request.fromDate)} – {date(request.toDate)} ·{" "}
                    {request.days} day(s)
                  </p>

                  <p className="mt-2 text-sm text-slate-600">
                    {request.reason}
                  </p>

                  {request.decisionNote ? (
                    <p className="mt-2 text-xs text-slate-500">
                      Decision note: {request.decisionNote}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export function StudentSelfServiceModule({
  module,
}: {
  module: StudentModule;
}) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }

    getCurrentUser()
      .then(setUser)
      .catch((error) => {
        if (error instanceof AuthRequiredError) {
          router.replace("/login");
        }
      });
  }, [router]);

  const content = useMemo(() => {
    if (!user) {
      return <Empty>Loading your workspace…</Empty>;
    }

    switch (module) {
      case "fees":
        return <FeesView user={user} />;

      case "examinations":
        return <ExaminationsView user={user} />;

      case "results":
        return <ResultsView user={user} />;

      case "library":
        return <LibraryView />;

      case "registration":
        return <RegistrationView />;

      case "leave":
        return <LeaveView />;
    }
  }, [module, user]);

  const meta = TITLES[module];

  return (
    <DashboardShell
      title={meta.title}
      subtitle={meta.subtitle}
      allowedRoles={["STUDENT"]}
    >
      <main className="mx-auto w-full max-w-7xl space-y-5 p-4 sm:p-6 lg:p-8">
        <div className="rounded-3xl bg-slate-950 p-5 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            My workspace
          </p>

          <h1 className="mt-1 text-2xl font-black">{meta.title}</h1>

          <p className="mt-1 text-sm text-slate-300">
            {meta.subtitle}
          </p>
        </div>

        {content}
      </main>
    </DashboardShell>
  );
}

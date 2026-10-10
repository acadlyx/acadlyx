"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { ExpandableList } from "@/components/ui/ExpandableList";
import {
  AuthRequiredError,
  AuthUser,
  getCurrentUser,
  isAuthenticated,
} from "@/lib/auth";
import { getStudentFees, StudentFeeSummary } from "@/lib/billingApi";
import {
  getHallTicket,
  getStudentExaminations,
  HallTicketView,
  printHallTicket,
} from "@/lib/examinationsApi";
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
  bulkRegisterForOfferings,
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
import { getMyAttendance, getMyMarks } from "@/lib/academicsApi";
import { getMyDocuments, getMyNotifications, getMyStudentPortal, PortalDocument, PortalNotification, StudentPortalData } from "@/lib/portalApi";
import { getMyTimetable, StudentTimetableEntry } from "@/lib/studentApi";
import { AttendanceSummaryData, InternalMarkEntry } from "@/types/academics";

export type StudentModule =
  | "fees"
  | "examinations"
  | "results"
  | "library"
  | "registration"
  | "leave"
  | "certificates"
  | "attendance"
  | "marks"
  | "notifications"
  | "profile"
  | "timetable";

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
  certificates: {
    title: "My Certificates",
    subtitle: "Your academic certificates and documents",
  },
  attendance: {
    title: "My Attendance",
    subtitle: "Your attendance across enrolled subjects",
  },
  marks: {
    title: "My Marks",
    subtitle: "Your internal marks and assessment components",
  },
  notifications: {
    title: "My Notifications",
    subtitle: "Institutional updates addressed to you",
  },
  profile: {
    title: "My Profile",
    subtitle: "Your personal and academic information",
  },
  timetable: {
    title: "My Timetable",
    subtitle: "Your weekly class schedule",
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
        <ExpandableList
          items={data.invoices}
          getKey={(invoice) => invoice.id}
          label="invoices"
          empty={<Empty>No invoices are currently assigned to you.</Empty>}
          renderItem={(invoice) => (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 p-4">
              <div><p className="font-semibold text-slate-900">{invoice.title}</p><p className="text-xs text-slate-500">Due {date(invoice.dueDate)}</p></div>
              <div className="text-right"><p className="font-bold">{money(invoice.amount + invoice.lateFeeAmount)}</p><p className="text-xs text-slate-500">Outstanding {money(invoice.outstanding)}</p></div>
            </div>
          )}
        />
      </Card>

      <Card title="Recent payments">
        <ExpandableList
          items={data.payments}
          getKey={(payment) => payment.id}
          label="payments"
          empty={<Empty>No payments found.</Empty>}
          renderItem={(payment) => (
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
              <div><p className="font-semibold">{payment.invoiceTitle}</p><p className="text-xs text-slate-500">{date(payment.paidAt)} · {payment.method}</p></div>
              <span className="font-bold text-emerald-700">{money(payment.amount)}</span>
            </div>
          )}
        />
      </Card>
    </div>
  );
}

function ExaminationsView({ user }: { user: AuthUser }) {
  const [data, setData] = useState<{
    upcoming: Array<Record<string, unknown>>;
    results: Array<Record<string, unknown>>;
  } | null>(null);
  const [hallTickets, setHallTickets] = useState<Record<string, HallTicketView>>({});
  const [ticketLoading, setTicketLoading] = useState<Record<string, boolean>>({});
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

  async function loadHallTicket(sessionId: string) {
    setTicketLoading((current) => ({ ...current, [sessionId]: true }));
    try {
      const ticket = await getHallTicket(sessionId, user.id);
      setHallTickets((current) => ({ ...current, [sessionId]: ticket }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load the hall ticket.");
    } finally {
      setTicketLoading((current) => ({ ...current, [sessionId]: false }));
    }
  }

  return (
    <>
      <style jsx global>{`
        @media print {
          body * { visibility: hidden !important; }
          .print-hall-ticket, .print-hall-ticket * { visibility: visible !important; }
          .print-hall-ticket { position: relative !important; margin: 0 !important; border: 0 !important; box-shadow: none !important; }
        }
      `}</style>
      <div className="space-y-5">
        <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Upcoming examinations">
          {data.upcoming.length === 0 ? (
            <Empty>
              No upcoming examinations are currently published for you.
            </Empty>
          ) : (
            <div className="space-y-3">
              {data.upcoming.map((exam, index) => {
                const sessionId = text(exam.examSessionId);
                const ticket = hallTickets[sessionId];
                const loading = Boolean(ticketLoading[sessionId]);
                return (
                  <div
                    key={String(exam.examScheduleId ?? index)}
                    className="rounded-2xl border border-slate-100 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
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

                      {sessionId !== "—" ? (
                        <button
                          type="button"
                          onClick={() => void loadHallTicket(sessionId)}
                          disabled={loading}
                          className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                          {loading ? "Loading…" : ticket ? "Refresh admit card" : "View admit card"}
                        </button>
                      ) : null}
                    </div>

                    {ticket ? (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 print-hall-ticket">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                              ACADLYX Examination Hall Ticket
                            </p>
                            <p className="mt-1 text-lg font-black text-slate-950">
                              {ticket.session.name}
                            </p>
                            <p className="text-xs text-slate-500">
                              Serial {ticket.ticket.serialNumber}
                            </p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-[11px] font-black ${ticket.ticket.status === "ISSUED" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                            {ticket.ticket.status}
                          </span>
                        </div>

                        {ticket.ticket.status !== "ISSUED" ? (
                          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
                            {ticket.ticket.blockedReason || "This hall ticket is not currently valid for examination entry."}
                          </div>
                        ) : (
                          <>
                            <div className="mt-4 space-y-2">
                              {ticket.papers.map((paper) => (
                                <div key={paper.examScheduleId} className="rounded-xl bg-white p-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="font-bold text-slate-900">
                                      {paper.courseCode} — {paper.courseName}
                                    </p>
                                    <p className="text-xs font-bold text-indigo-700">
                                      Seat {paper.seatNumber}
                                    </p>
                                  </div>
                                  <p className="mt-1 text-xs text-slate-500">
                                    {new Date(paper.examDate).toLocaleDateString("en-IN")} · {paper.startTime}–{paper.endTime} · {paper.roomName}{paper.building ? ` · ${paper.building}` : ""}
                                  </p>
                                </div>
                              ))}
                            </div>
                            <button
                              type="button"
                              onClick={printHallTicket}
                              className="mt-3 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                            >
                              Print / Save PDF
                            </button>
                          </>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
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
      </div>
    </>
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
    setError("");

    const [loanResult, bookResult] = await Promise.allSettled([
      listMyLoans(),
      listBooks({
        page: 1,
        search: query || undefined,
        availableOnly: true,
      }),
    ]);

    const errors: string[] = [];

    if (loanResult.status === "fulfilled") {
      setLoans(loanResult.value);
    } else {
      errors.push(
        loanResult.reason instanceof Error
          ? loanResult.reason.message
          : "Your issued-book history could not be loaded.",
      );
    }

    if (bookResult.status === "fulfilled") {
      setBooks(bookResult.value.items);
    } else {
      errors.push(
        bookResult.reason instanceof Error
          ? bookResult.reason.message
          : "The library catalogue could not be loaded.",
      );
    }

    if (errors.length > 0) {
      setError(errors.join(" "));
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

  if (!loans && error) {
    return (
      <div className="space-y-4">
        <ErrorBox message={error} />
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Retry library
        </button>
      </div>
    );
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
        <ExpandableList
          items={loans.items}
          getKey={(loan) => loan.id}
          label="loans"
          empty={<Empty>You have no library loans.</Empty>}
          renderItem={(loan) => (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 p-4">
              <div>
                <p className="font-semibold">{loan.book.title}</p>
                <p className="text-xs text-slate-500">
                  Issued {date(loan.issuedAt)} · Due {date(loan.dueDate)} · {loan.status}
                </p>
                {loan.returnedAt ? (
                  <p className="mt-1 text-xs text-slate-500">Returned {date(loan.returnedAt)}</p>
                ) : null}
              </div>
              {(loan.financialBalance > 0 || loan.accruedFine > 0) ? (
                <span className="font-semibold text-red-600">{money(loan.financialBalance || loan.accruedFine)}</span>
              ) : null}
            </div>
          )}
        />
      </Card>

      <Card title="Catalogue">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search available books…"
          className="mb-4 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm outline-none focus:border-slate-500"
        />

        <ExpandableList
          items={books}
          getKey={(book) => book.id}
          label="books"
          empty={<Empty>No matching available books were found.</Empty>}
          renderItem={(book) => (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4">
              <div>
                <p className="font-semibold">{book.title}</p>
                <p className="text-xs text-slate-500">{book.author} · {book.availableCopies} available</p>
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
          )}
        />
      </Card>
    </div>
  );
}

function RegistrationView() {
  const [offerings, setOfferings] = useState<AvailableOffering[]>([]);
  const [mine, setMine] = useState<MyRegistrationSummary | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [available, current] = await Promise.all([
        listAvailableOfferings({}),
        getMyRegistrations(),
      ]);
      setOfferings(available.items);
      setMine(current);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We could not load your course registration information.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const toggle = (id: string) =>
    setSelected((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);

  async function submit() {
    if (!selected.length) return;
    setBusy(true);
    setError("");
    try {
      const result = await bulkRegisterForOfferings(selected);
      const skipped = result.skipped > 0;
      setSelected([]);
      if (skipped) setError("Some selected courses could not be submitted. Review their current status and eligibility.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Registration could not be submitted.");
    } finally {
      setBusy(false);
    }
  }

  async function drop(id: string) {
    setBusy(true);
    setError("");
    try {
      await dropRegistration(id);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Registration could not be dropped.");
    } finally {
      setBusy(false);
    }
  }

  if (!mine) return <Empty>Loading your registration…</Empty>;

  const selectedCredits = offerings.filter((o) => selected.includes(o.id)).reduce((sum, o) => sum + o.course.credits, 0);

  return (
    <div className="space-y-5">
      {error ? <ErrorBox message={error} /> : null}

      <Card title="Academic context">
        <p className="text-sm text-slate-600">
          Course registration is available only for your active academic enrollment and eligible course offerings.
        </p>
        <p className="mt-2 text-sm font-semibold text-slate-900">
          Current credits: {mine.registeredCredits} · Selected: {selectedCredits} · Limit: {mine.maxCredits}
        </p>
      </Card>

      <Card title="My registrations">
        <ExpandableList
          items={mine.items}
          getKey={(item) => item.id}
          label="registrations"
          empty={<Empty>You have no course registrations yet.</Empty>}
          renderItem={(item) => (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 p-4">
              <div>
                <p className="font-semibold">{item.courseOffering.course.name}</p>
                <p className="text-xs text-slate-500">{item.courseOffering.course.code} · {item.courseOffering.course.credits} credit(s) · {item.status.replaceAll("_", " ")}</p>
                {item.remarks ? <p className="mt-1 text-xs text-red-600">{item.remarks}</p> : null}
              </div>
              {item.status === "REQUESTED" || item.status === "APPROVED" ? (
                <button type="button" disabled={busy} onClick={() => void drop(item.id)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold">
                  {busy ? "Working…" : "Drop"}
                </button>
              ) : null}
            </div>
          )}
        />
      </Card>

      <Card title="Eligible courses">
        {offerings.length === 0 ? <Empty>No eligible courses are currently open for registration.</Empty> : (
          <>
            <ExpandableList
              items={offerings}
              getKey={(item) => item.id}
              label="eligible courses"
              className="space-y-3"
              renderItem={(item) => {
                const held = Boolean(item.myStatus);
                const checked = selected.includes(item.id);
                return (
                  <label className={`flex cursor-pointer items-center gap-3 rounded-2xl bg-slate-50 p-4 ${held ? "opacity-70" : ""}`}>
                    <input type="checkbox" checked={checked} disabled={held || item.seatsLeft === 0 || !item.registrationOpen || busy} onChange={() => toggle(item.id)} className="h-4 w-4" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{item.course.name}</span>
                      <span className="mt-1 block text-xs text-slate-500">{item.course.code} · {item.course.credits} credit(s) · {item.seatsLeft === null ? "Capacity open" : `${item.seatsLeft} seat(s) available`}</span>
                    </span>
                    <span className="text-xs font-bold text-slate-600">{held ? item.myStatus?.replaceAll("_", " ") : item.isElective ? "Elective" : "Core"}</span>
                  </label>
                );
              }}
            />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm">
                <span className="font-bold">{selected.length}</span> course(s) selected · <span className="font-bold">{selectedCredits}</span> credits
              </div>
              <button type="button" disabled={!selected.length || busy} onClick={() => void submit()} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
                {busy ? "Submitting…" : "Submit Registration"}
              </button>
            </div>
          </>
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
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [typeList, balanceList, requestList] = await Promise.all([
        listLeaveTypes(),
        getLeaveBalances(),
        listMyLeaveRequests({ page: 1 }),
      ]);

      setTypes(typeList);
      setBalances(balanceList);
      setMine(requestList.items);

      if (typeList[0]) {
        setForm((old) => old.leaveTypeId ? old : ({
          ...old,
          leaveTypeId: typeList[0].id,
        }));
      }
    } catch {
      setError("We could not load your leave information.");
    } finally {
      setLoading(false);
    }
  }, []);

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

  if (loading) return <Empty>Loading your leave information…</Empty>;

  return (
    <div className="space-y-5">
      {error ? <div><ErrorBox message={error} /><button type="button" onClick={() => void load()} className="mt-2 text-sm font-semibold underline">Retry leave information</button></div> : null}

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
          <ExpandableList
            items={mine}
            getKey={(request) => request.id}
            label="leave requests"
            empty={<Empty>No leave requests found.</Empty>}
            renderItem={(request) => (
              <div className="rounded-2xl border border-slate-100 p-4">
                <div className="flex justify-between gap-3">
                  <p className="font-semibold">{request.leaveType.name}</p>
                  <span className="text-xs font-semibold">{request.status}</span>
                </div>
                <p className="mt-1 text-sm text-slate-500">{date(request.fromDate)} – {date(request.toDate)} · {request.days} day(s)</p>
                <p className="mt-2 text-sm text-slate-600">{request.reason}</p>
                {request.decisionNote ? <p className="mt-2 text-xs text-slate-500">Decision note: {request.decisionNote}</p> : null}
              </div>
            )}
          />
        </Card>
      </div>
    </div>
  );
}

function CertificatesView({ user }: { user: AuthUser }) {
  const [certificates, setCertificates] = useState<PortalDocument[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    getMyDocuments()
      .then((docs) => setCertificates(docs.filter((d) => d.type === "CERTIFICATE")))
      .catch(() => setError("We could not load your certificates."));
  }, [user.id]);

  if (error) {
    return <ErrorBox message={error} />;
  }

  if (certificates.length === 0) {
    return <Empty>No certificates are available yet.</Empty>;
  }

  return (
    <div className="space-y-3">
      {certificates.map((cert) => (
        <div key={String(cert.id)} className="rounded-2xl border border-slate-100 p-4">
          <p className="font-semibold text-slate-900">{String(cert.title)}</p>
          <p className="mt-1 text-xs text-slate-500">{date(String(cert.createdAt))}</p>
        </div>
      ))}
    </div>
  );
}

function AttendanceView({ user }: { user: AuthUser }) {
  const [data, setData] = useState<AttendanceSummaryData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getMyAttendance()
      .then(setData)
      .catch(() => setError("We could not load your attendance."));
  }, [user.id]);

  if (error) {
    return <ErrorBox message={error} />;
  }

  if (!data) {
    return <Empty>Loading your attendance…</Empty>;
  }

  return (
    <div className="space-y-5">
      <Card title="Overall attendance">
        <p className="text-3xl font-black text-slate-950">{data.overallPercentage}%</p>
        <p className="mt-1 text-sm text-slate-500">
          {data.totalPresent}/{data.totalSessions} sessions attended
        </p>
      </Card>

      <Card title="By subject">
        {data.subjects.length === 0 ? (
          <Empty>No attendance records yet.</Empty>
        ) : (
          <div className="space-y-4">
            {data.subjects.map((subject) => (
              <div key={subject.courseOfferingId}>
                <p className="text-sm font-medium text-slate-700">
                  {subject.courseCode} — {subject.courseName}
                </p>
                <p className="text-xs text-slate-500">
                  {subject.present}/{subject.total} sessions · {subject.percentage}%
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function MarksView({ user }: { user: AuthUser }) {
  const [marks, setMarks] = useState<InternalMarkEntry[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    getMyMarks()
      .then(setMarks)
      .catch(() => setError("We could not load your marks."));
  }, [user.id]);

  if (error) {
    return <ErrorBox message={error} />;
  }

  if (marks.length === 0) {
    return <Empty>No marks have been entered yet.</Empty>;
  }

  return (
    <div className="space-y-3">
      {marks.map((mark) => (
        <div key={mark.id} className="flex items-center justify-between rounded-2xl border border-slate-100 p-4">
          <div>
            <p className="font-semibold text-slate-900">{mark.component}</p>
            <p className="text-xs text-slate-500">
              {mark.courseOffering?.course.code} — {mark.courseOffering?.course.name}
            </p>
          </div>
          <span className="font-bold text-slate-900">
            {mark.marksObtained}/{mark.maxMarks}
          </span>
        </div>
      ))}
    </div>
  );
}

function NotificationsView({ user }: { user: AuthUser }) {
  const [data, setData] = useState<{ items: PortalNotification[]; unread: number } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getMyNotifications()
      .then(setData)
      .catch(() => setError("We could not load your notifications."));
  }, [user.id]);

  if (error) {
    return <ErrorBox message={error} />;
  }

  if (!data) {
    return <Empty>Loading your notifications…</Empty>;
  }

  return (
    <div className="space-y-5">
      <Card title="Unread">
        <p className="text-3xl font-black text-slate-950">{data.unread}</p>
      </Card>

      <Card title="Recent notifications">
        {data.items.length === 0 ? (
          <Empty>You have no notifications.</Empty>
        ) : (
          <div className="space-y-3">
            {data.items.slice(0, 10).map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-100 p-4">
                <p className="font-semibold text-slate-900">{item.title}</p>
                <p className="mt-1 text-sm text-slate-600">{item.body}</p>
                <p className="mt-2 text-xs text-slate-400">
                  {new Date(item.createdAt).toLocaleDateString("en-IN")}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function ProfileView({ user }: { user: AuthUser }) {
  const [data, setData] = useState<StudentPortalData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getMyStudentPortal()
      .then(setData)
      .catch(() => setError("We could not load your profile."));
  }, [user.id]);

  if (error) {
    return <ErrorBox message={error} />;
  }

  if (!data) {
    return <Empty>Loading your profile…</Empty>;
  }

  return (
    <div className="space-y-5">
      <Card title="Personal information">
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-sm text-slate-500">Name</span>
            <span className="text-sm font-medium text-slate-900">
              {data.student.firstName} {data.student.lastName}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-slate-500">Email</span>
            <span className="text-sm font-medium text-slate-900">{data.student.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-slate-500">Phone</span>
            <span className="text-sm font-medium text-slate-900">
              {data.student.phone || "Not provided"}
            </span>
          </div>
        </div>
      </Card>

      <Card title="Academic information">
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-sm text-slate-500">Program</span>
            <span className="text-sm font-medium text-slate-900">
              {data.enrollment?.program.name || "Not enrolled"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-slate-500">Academic year</span>
            <span className="text-sm font-medium text-slate-900">
              {data.enrollment?.academicYear.name || "Not assigned"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-slate-500">Section</span>
            <span className="text-sm font-medium text-slate-900">
              {data.enrollment?.section?.name || "Not assigned"}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}

function TimetableView({ user }: { user: AuthUser }) {
  const [entries, setEntries] = useState<StudentTimetableEntry[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    getMyTimetable()
      .then(setEntries)
      .catch(() => setError("We could not load your timetable."));
  }, [user.id]);

  if (error) {
    return <ErrorBox message={error} />;
  }

  if (entries.length === 0) {
    return <Empty>No timetable has been published for your section.</Empty>;
  }

  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  return (
    <div className="space-y-4">
      {days.map((day, dayOfWeek) => {
        const classes = entries.filter((entry) => entry.dayOfWeek === dayOfWeek);
        if (classes.length === 0) return null;

        return (
          <Card key={day} title={day}>
            <div className="space-y-3">
              {classes.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {entry.course.code} — {entry.course.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {entry.startTime} – {entry.endTime} · {entry.room || "Room pending"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        );
      })}
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

      case "certificates":
        return <CertificatesView user={user} />;

      case "attendance":
        return <AttendanceView user={user} />;

      case "marks":
        return <MarksView user={user} />;

      case "notifications":
        return <NotificationsView user={user} />;

      case "profile":
        return <ProfileView user={user} />;

      case "timetable":
        return <TimetableView user={user} />;
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
        <DashboardPageHeader
          eyebrow="Student workspace"
          title={meta.title}
          description={meta.subtitle}
          breadcrumbs={[{ label: "Student dashboard", href: "/student" }, { label: meta.title }]}
        />

        {content}
      </main>
    </DashboardShell>
  );
}

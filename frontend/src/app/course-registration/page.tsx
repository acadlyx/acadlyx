"use client";

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
  AvailableOffering,
  EnrollmentContext,
  MyRegistrationSummary,
  Registration,
  RegistrationStatus,
  decideRegistration,
  dropRegistration,
  getMyRegistrations,
  listAvailableOfferings,
  listRegistrations,
  registerForOffering,
} from "@/lib/registrationApi";

type ViewState = "loading" | "ready" | "error";
type Tab = "browse" | "mine" | "approvals";

const STATUS_STYLES: Record<RegistrationStatus, string> = {
  REQUESTED: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
  DROPPED: "bg-slate-100 text-slate-600",
};

export default function CourseRegistrationPage() {
  const router = useRouter();
  const [state, setState] = useState<ViewState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [actionError, setActionError] = useState("");

  const [user, setUser] = useState<AuthUser | null>(null);
  const [tab, setTab] = useState<Tab>("browse");

  const [offerings, setOfferings] = useState<AvailableOffering[]>([]);
  const [enrollment, setEnrollment] = useState<EnrollmentContext | null>(null);
  const [offeringsError, setOfferingsError] = useState("");
  const [search, setSearch] = useState("");
  const [electivesOnly, setElectivesOnly] = useState(false);

  const [mine, setMine] = useState<MyRegistrationSummary | null>(null);

  const [queue, setQueue] = useState<Registration[]>([]);
  const [queueSummary, setQueueSummary] = useState<Record<string, number>>({});
  const [queueStatus, setQueueStatus] = useState<RegistrationStatus | "">(
    "REQUESTED"
  );
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const canSubmit = user?.permissions.includes("registration.submit") ?? false;
  const canApprove = user?.permissions.includes("registration.approve") ?? false;
  const canRead = user?.permissions.includes("registration.read") ?? false;

  const load = useCallback(async () => {
    try {
      const me = await getCurrentUser();
      setUser(me);

      const submit = me.permissions.includes("registration.submit");
      const read = me.permissions.includes("registration.read");

      if (submit) {
        try {
          const [available, summary] = await Promise.all([
            listAvailableOfferings({
              search: search || undefined,
              electivesOnly,
            }),
            getMyRegistrations(),
          ]);
          setOfferings(available.items);
          setEnrollment(available.enrollment);
          setMine(summary);
          setOfferingsError("");
        } catch (err) {
          /* A staff member with submit rights but no enrollment is a
             normal case — surface it without failing the page. */
          setOfferingsError(
            err instanceof Error ? err.message : "No enrollment context"
          );
        }
      }

      if (read) {
        const list = await listRegistrations({
          page,
          status: queueStatus || undefined,
        });
        setQueue(list.items);
        setQueueSummary(list.summary);
        setTotalPages(list.meta.totalPages);
        if (!submit) setTab("approvals");
      }

      setState("ready");
    } catch (err) {
      if (err instanceof AuthRequiredError) {
        router.replace("/login");
        return;
      }
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to load registrations"
      );
      setState("error");
    }
  }, [search, electivesOnly, page, queueStatus, router]);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    load();
  }, [load, router]);

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
      <DashboardShell title="Course Registration" subtitle="Electives and enrolment">
        <div className="p-8 text-sm text-slate-500">Loading registration…</div>
      </DashboardShell>
    );
  }

  if (state === "error") {
    return (
      <DashboardShell title="Course Registration" subtitle="Electives and enrolment">
        <div className="m-8 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {errorMessage}
        </div>
      </DashboardShell>
    );
  }

  const tabs: Array<[Tab, string]> = [
    ...(canSubmit
      ? ([
          ["browse", "Available courses"],
          ["mine", "My registrations"],
        ] as Array<[Tab, string]>)
      : []),
    ...(canRead ? ([["approvals", "Registrations"]] as Array<[Tab, string]>) : []),
  ];

  return (
    <DashboardShell
      title="Course Registration"
      subtitle="Register, drop and approve course enrolments"
    >
      <main className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        {enrollment && (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">
              Current enrolment
            </p>
            <p className="mt-2 text-lg font-bold text-slate-900">
              {enrollment.program.name} · {enrollment.academicYear.name}
              {enrollment.semester ? ` · ${enrollment.semester.name}` : ""}
              {enrollment.section ? ` · Section ${enrollment.section.name}` : ""}
            </p>
            {mine && (
              <p className="mt-1 text-sm text-slate-500">
                {mine.registeredCredits} credits registered (minimum{" "}
                {mine.minCredits}, maximum {mine.maxCredits})
                {!mine.meetsMinimum && (
                  <span className="ml-2 font-semibold text-amber-600">
                    Below the minimum credit load
                  </span>
                )}
              </p>
            )}
          </section>
        )}

        {offeringsError && canSubmit && (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {offeringsError}
          </p>
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

        {tab === "browse" && canSubmit && (
          <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by course code or name"
                className="min-w-[220px] flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={electivesOnly}
                  onChange={(e) => setElectivesOnly(e.target.checked)}
                />
                Electives only
              </label>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-2">Course</th>
                    <th>Credits</th>
                    <th>Section</th>
                    <th>Faculty</th>
                    <th>Seats</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {offerings.map((offering) => {
                    const full =
                      offering.seatsLeft !== null && offering.seatsLeft <= 0;
                    return (
                      <tr key={offering.id}>
                        <td className="py-3 font-semibold text-slate-900">
                          {offering.course.code} — {offering.course.name}
                          {offering.isElective && (
                            <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                              Elective
                            </span>
                          )}
                        </td>
                        <td className="text-slate-600">
                          {offering.course.credits}
                        </td>
                        <td className="text-slate-600">
                          {offering.section.name}
                        </td>
                        <td className="text-slate-600">
                          {offering.faculty
                            ? `${offering.faculty.firstName} ${offering.faculty.lastName}`
                            : "—"}
                        </td>
                        <td className="text-slate-600">
                          {offering.capacity === null
                            ? "Open"
                            : `${offering.seatsTaken}/${offering.capacity}`}
                        </td>
                        <td className="py-3 text-right">
                          {offering.myStatus ? (
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-semibold ${
                                STATUS_STYLES[offering.myStatus]
                              }`}
                            >
                              {offering.myStatus}
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={full || !offering.registrationOpen}
                              onClick={() =>
                                run(() => registerForOffering(offering.id))
                              }
                              className="rounded-lg bg-slate-950 px-3 py-1 text-xs font-semibold text-white disabled:opacity-40"
                            >
                              {full
                                ? "Full"
                                : offering.registrationOpen
                                  ? "Register"
                                  : "Closed"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {offerings.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-500">
                        No offerings available for your semester.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "mine" && canSubmit && mine && (
          <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-2">Course</th>
                    <th>Credits</th>
                    <th>Semester</th>
                    <th>Status</th>
                    <th>Remarks</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {mine.items.map((row) => (
                    <tr key={row.id}>
                      <td className="py-3 font-semibold text-slate-900">
                        {row.courseOffering.course.code} —{" "}
                        {row.courseOffering.course.name}
                      </td>
                      <td className="text-slate-600">
                        {row.courseOffering.course.credits}
                      </td>
                      <td className="text-slate-600">
                        {row.courseOffering.semester.name}
                      </td>
                      <td>
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${STATUS_STYLES[row.status]}`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="text-slate-500">{row.remarks || "—"}</td>
                      <td className="py-3 text-right">
                        {["REQUESTED", "APPROVED"].includes(row.status) && (
                          <button
                            type="button"
                            onClick={() => run(() => dropRegistration(row.id))}
                            className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600"
                          >
                            Drop
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {mine.items.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-500">
                        You have not registered for any courses yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "approvals" && canRead && (
          <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <select
                value={queueStatus}
                onChange={(e) => {
                  setPage(1);
                  setQueueStatus(e.target.value as RegistrationStatus | "");
                }}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">All statuses</option>
                <option value="REQUESTED">Requested</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="DROPPED">Dropped</option>
              </select>
              <p className="text-sm text-slate-500">
                {Object.entries(queueSummary)
                  .map(([key, value]) => `${key}: ${value}`)
                  .join(" · ") || "No registrations yet"}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-2">Student</th>
                    <th>Course</th>
                    <th>Section</th>
                    <th>Seats</th>
                    <th>Status</th>
                    <th className="text-right">Decision</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {queue.map((row) => (
                    <tr key={row.id}>
                      <td className="py-3 font-semibold text-slate-900">
                        {row.student.firstName} {row.student.lastName}
                        <span className="block text-xs font-normal text-slate-400">
                          {row.student.email}
                        </span>
                      </td>
                      <td className="text-slate-600">
                        {row.courseOffering.course.code}
                      </td>
                      <td className="text-slate-600">
                        {row.courseOffering.section.name}
                      </td>
                      <td className="text-slate-600">
                        {row.courseOffering.capacity ??
                          row.courseOffering.section.capacity ??
                          "Open"}
                      </td>
                      <td>
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${STATUS_STYLES[row.status]}`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        {row.status === "REQUESTED" && canApprove && (
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                run(() => decideRegistration(row.id, "APPROVED"))
                              }
                              className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRejectFor(row.id);
                                setRejectNote("");
                              }}
                              className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {queue.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-500">
                        Nothing in this queue.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {rejectFor && (
              <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-red-50 p-4">
                <label className="flex-1 text-sm">
                  <span className="mb-1 block font-medium text-slate-600">
                    Reason for rejection (required)
                  </span>
                  <input
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2"
                  />
                </label>
                <button
                  type="button"
                  disabled={!rejectNote}
                  onClick={() =>
                    run(async () => {
                      await decideRegistration(rejectFor, "REJECTED", rejectNote);
                      setRejectFor(null);
                    })
                  }
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
                >
                  Confirm rejection
                </button>
                <button
                  type="button"
                  onClick={() => setRejectFor(null)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600"
                >
                  Cancel
                </button>
              </div>
            )}

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
      </main>
    </DashboardShell>
  );
}

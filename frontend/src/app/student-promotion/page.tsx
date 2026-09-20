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
import { listAcademicYearOptions, AcademicYearOption } from "@/lib/calendarApi";
import {
  MOVEMENT_TYPES,
  MovementRequest,
  MovementStatus,
  MovementType,
  PromotionCandidate,
  bulkPromote,
  createMovementRequest,
  decideMovement,
  listMovementRequests,
  listPromotionCandidates,
  listSectionOptions,
} from "@/lib/movementApi";

type ViewState = "loading" | "ready" | "error";
type Tab = "candidates" | "requests";

const STATUS_STYLES: Record<MovementStatus, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
};

export default function StudentPromotionPage() {
  const router = useRouter();
  const [state, setState] = useState<ViewState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [actionError, setActionError] = useState("");

  const [user, setUser] = useState<AuthUser | null>(null);
  const [tab, setTab] = useState<Tab>("candidates");

  const [candidates, setCandidates] = useState<PromotionCandidate[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [years, setYears] = useState<AcademicYearOption[]>([]);
  const [sections, setSections] = useState<
    Array<{ id: string; name: string; capacity: number | null }>
  >([]);
  const [sourceYear, setSourceYear] = useState("");
  const [targetYear, setTargetYear] = useState("");
  const [targetSection, setTargetSection] = useState("");
  const [reason, setReason] = useState("");
  const [bulkResult, setBulkResult] = useState<string>("");

  const [requests, setRequests] = useState<MovementRequest[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<MovementStatus | "">("PENDING");
  const [requestType, setRequestType] = useState<MovementType | "">("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const [transferStudentId, setTransferStudentId] = useState("");
  const [transferSectionId, setTransferSectionId] = useState("");

  const canManage = user?.permissions.includes("promotions.manage") ?? false;
  const canApprove = user?.permissions.includes("promotions.approve") ?? false;

  const load = useCallback(async () => {
    try {
      const me = await getCurrentUser();
      setUser(me);

      const [candidateList, requestList, yearOptions, sectionOptions] =
        await Promise.all([
          listPromotionCandidates({
            academicYearId: sourceYear || undefined,
          }),
          listMovementRequests({
            page,
            status: status || undefined,
            requestType: requestType || undefined,
          }),
          listAcademicYearOptions().catch(() => []),
          listSectionOptions().catch(() => []),
        ]);

      setCandidates(candidateList);
      setRequests(requestList.items);
      setSummary(requestList.summary);
      setTotalPages(requestList.meta.totalPages);
      setYears(yearOptions);
      setSections(sectionOptions);
      setState("ready");
    } catch (err) {
      if (err instanceof AuthRequiredError) {
        router.replace("/login");
        return;
      }
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to load student movement"
      );
      setState("error");
    }
  }, [sourceYear, page, status, requestType, router]);

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

  async function handleBulkPromotion() {
    setActionError("");
    setBulkResult("");
    if (!targetYear || selected.length === 0) {
      setActionError("Select students and a target academic year.");
      return;
    }
    try {
      const result = await bulkPromote({
        studentIds: selected,
        targetAcademicYearId: targetYear,
        targetSectionId: targetSection || undefined,
        reason: reason || undefined,
      });
      setBulkResult(
        `${result.created} promotion request(s) raised, ${result.failed} failed.`
      );
      setSelected([]);
      await load();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Bulk promotion failed"
      );
    }
  }

  if (state === "loading") {
    return (
      <DashboardShell title="Student Movement" subtitle="Promotion and transfer">
        <div className="p-8 text-sm text-slate-500">Loading…</div>
      </DashboardShell>
    );
  }

  if (state === "error") {
    return (
      <DashboardShell title="Student Movement" subtitle="Promotion and transfer">
        <div className="m-8 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {errorMessage}
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title="Student Movement"
      subtitle="Promotion, section change and programme transfer"
    >
      <main className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        <nav className="flex flex-wrap gap-2">
          {(
            [
              ["candidates", "Promotion candidates"],
              ["requests", "Requests and approvals"],
            ] as Array<[Tab, string]>
          ).map(([key, label]) => (
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
        {bulkResult && (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {bulkResult}
          </p>
        )}

        {tab === "candidates" && (
          <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-sm">
                <span className="mb-1 block font-medium text-slate-600">
                  Current academic year
                </span>
                <select
                  value={sourceYear}
                  onChange={(e) => {
                    setSelected([]);
                    setSourceYear(e.target.value);
                  }}
                  className="rounded-xl border border-slate-200 px-3 py-2"
                >
                  <option value="">All years</option>
                  {years.map((year) => (
                    <option key={year.id} value={year.id}>
                      {year.name}
                    </option>
                  ))}
                </select>
              </label>
              {canManage && (
                <>
                  <label className="text-sm">
                    <span className="mb-1 block font-medium text-slate-600">
                      Promote to year
                    </span>
                    <select
                      value={targetYear}
                      onChange={(e) => setTargetYear(e.target.value)}
                      className="rounded-xl border border-slate-200 px-3 py-2"
                    >
                      <option value="">Select year</option>
                      {years.map((year) => (
                        <option key={year.id} value={year.id}>
                          {year.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block font-medium text-slate-600">
                      Target section
                    </span>
                    <select
                      value={targetSection}
                      onChange={(e) => setTargetSection(e.target.value)}
                      className="rounded-xl border border-slate-200 px-3 py-2"
                    >
                      <option value="">Keep unassigned</option>
                      {sections.map((section) => (
                        <option key={section.id} value={section.id}>
                          {section.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block font-medium text-slate-600">
                      Reason
                    </span>
                    <input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="End of academic year"
                      className="rounded-xl border border-slate-200 px-3 py-2"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleBulkPromotion}
                    disabled={selected.length === 0 || !targetYear}
                    className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
                  >
                    Raise {selected.length || ""} promotion request
                    {selected.length === 1 ? "" : "s"}
                  </button>
                </>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="w-10 py-2">
                      <input
                        type="checkbox"
                        checked={
                          candidates.length > 0 &&
                          selected.length === candidates.length
                        }
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? candidates.map((row) => row.user.id)
                              : []
                          )
                        }
                      />
                    </th>
                    <th>Student</th>
                    <th>Roll no.</th>
                    <th>Programme</th>
                    <th>Year</th>
                    <th>Section</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {candidates.map((row) => (
                    <tr key={row.id}>
                      <td className="py-3">
                        <input
                          type="checkbox"
                          checked={selected.includes(row.user.id)}
                          onChange={(e) =>
                            setSelected((prev) =>
                              e.target.checked
                                ? [...prev, row.user.id]
                                : prev.filter((id) => id !== row.user.id)
                            )
                          }
                        />
                      </td>
                      <td className="font-semibold text-slate-900">
                        {row.user.firstName} {row.user.lastName}
                        <span className="block text-xs font-normal text-slate-400">
                          {row.user.email}
                        </span>
                      </td>
                      <td className="text-slate-600">{row.rollNumber || "—"}</td>
                      <td className="text-slate-600">{row.program.name}</td>
                      <td className="text-slate-600">{row.academicYear.name}</td>
                      <td className="text-slate-600">
                        {row.section?.name || "—"}
                      </td>
                    </tr>
                  ))}
                  {candidates.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-500">
                        No active enrolments for this filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {canManage && (
              <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-slate-50 p-4">
                <p className="w-full text-sm font-semibold text-slate-600">
                  Raise a single section transfer
                </p>
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-slate-600">
                    Student user ID
                  </span>
                  <input
                    value={transferStudentId}
                    onChange={(e) => setTransferStudentId(e.target.value)}
                    placeholder="UUID"
                    className="w-72 rounded-xl border border-slate-200 px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-slate-600">
                    Target section
                  </span>
                  <select
                    value={transferSectionId}
                    onChange={(e) => setTransferSectionId(e.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2"
                  >
                    <option value="">Select section</option>
                    {sections.map((section) => (
                      <option key={section.id} value={section.id}>
                        {section.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={!transferStudentId || !transferSectionId}
                  onClick={() =>
                    run(async () => {
                      await createMovementRequest({
                        studentId: transferStudentId,
                        requestType: "SECTION_TRANSFER",
                        targetSectionId: transferSectionId,
                        reason: reason || undefined,
                      });
                      setTransferStudentId("");
                      setTransferSectionId("");
                    })
                  }
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
                >
                  Raise transfer
                </button>
              </div>
            )}
          </section>
        )}

        {tab === "requests" && (
          <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-3">
                <select
                  value={status}
                  onChange={(e) => {
                    setPage(1);
                    setStatus(e.target.value as MovementStatus | "");
                  }}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">All statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </select>
                <select
                  value={requestType}
                  onChange={(e) => {
                    setPage(1);
                    setRequestType(e.target.value as MovementType | "");
                  }}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">All types</option>
                  {MOVEMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-sm text-slate-500">
                {Object.entries(summary)
                  .map(([key, value]) => `${key}: ${value}`)
                  .join(" · ") || "No requests yet"}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-2">Student</th>
                    <th>Type</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Status</th>
                    <th className="text-right">Decision</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {requests.map((row) => (
                    <tr key={row.id}>
                      <td className="py-3 font-semibold text-slate-900">
                        {row.student.firstName} {row.student.lastName}
                        <span className="block text-xs font-normal text-slate-400">
                          {row.student.email}
                        </span>
                      </td>
                      <td className="text-slate-600">
                        {row.requestType.replace("_", " ")}
                      </td>
                      <td className="text-slate-600">
                        {row.fromEnrollment
                          ? `${row.fromEnrollment.program.name} · ${row.fromEnrollment.academicYear.name}${
                              row.fromEnrollment.section
                                ? ` · ${row.fromEnrollment.section.name}`
                                : ""
                            }`
                          : "—"}
                      </td>
                      <td className="text-slate-600">
                        {[
                          row.targetProgram?.name,
                          row.targetAcademicYear?.name,
                          row.targetSection?.name,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </td>
                      <td>
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${STATUS_STYLES[row.status]}`}
                        >
                          {row.status}
                        </span>
                        {row.decisionNote && (
                          <span className="block text-xs text-slate-400">
                            {row.decisionNote}
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        {row.status === "PENDING" && canApprove && (
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                run(() => decideMovement(row.id, "APPROVED"))
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
                  {requests.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-500">
                        No movement requests for this filter.
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
                      await decideMovement(rejectFor, "REJECTED", rejectNote);
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

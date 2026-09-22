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
  LEAVE_STATUSES,
  LeaveBalance,
  LeaveRequest,
  LeaveStatus,
  LeaveType,
  applyLeave,
  cancelLeaveRequest,
  decideLeaveRequest,
  getLeaveBalances,
  listLeaveApprovals,
  listLeaveTypes,
  listMyLeaveRequests,
} from "@/lib/leaveApi";

type ViewState = "loading" | "ready" | "error";
type Tab = "apply" | "mine" | "approvals";

const STATUS_STYLES: Record<LeaveStatus, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
  CANCELLED: "bg-slate-100 text-slate-600",
};

const day = (value: string) => new Date(value).toLocaleDateString();

export default function LeaveManagementPage() {
  const router = useRouter();
  const [state, setState] = useState<ViewState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [actionError, setActionError] = useState("");

  const [user, setUser] = useState<AuthUser | null>(null);
  const [tab, setTab] = useState<Tab>("apply");

  const [types, setTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [mine, setMine] = useState<LeaveRequest[]>([]);
  const [minePage, setMinePage] = useState(1);
  const [mineTotalPages, setMineTotalPages] = useState(1);
  const [mineStatus, setMineStatus] = useState<LeaveStatus | "">("");

  const [approvals, setApprovals] = useState<LeaveRequest[]>([]);
  const [approvalPage, setApprovalPage] = useState(1);
  const [approvalTotalPages, setApprovalTotalPages] = useState(1);

  const [form, setForm] = useState({
    leaveTypeId: "",
    fromDate: "",
    toDate: "",
    reason: "",
  });
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const canApply = user?.permissions.includes("leave.apply") ?? false;
  const canApprove = user?.permissions.includes("leave.approve") ?? false;

  const load = useCallback(async () => {
    try {
      const me = await getCurrentUser();
      setUser(me);

      const apply = me.permissions.includes("leave.apply");
      const approve = me.permissions.includes("leave.approve");

      if (apply) {
        const [typeList, balanceList, mineList] = await Promise.all([
          listLeaveTypes(),
          getLeaveBalances(),
          listMyLeaveRequests({
            page: minePage,
            status: mineStatus || undefined,
          }),
        ]);
        setTypes(typeList);
        setBalances(balanceList);
        setMine(mineList.items);
        setMineTotalPages(mineList.totalPages);
      }

      if (approve) {
        const approvalList = await listLeaveApprovals({
          page: approvalPage,
          status: "PENDING",
        });
        setApprovals(approvalList.items);
        setApprovalTotalPages(approvalList.totalPages);
        if (!apply) setTab("approvals");
      }

      setState("ready");
    } catch (err) {
      if (err instanceof AuthRequiredError) {
        router.replace("/login");
        return;
      }
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to load leave data"
      );
      setState("error");
    }
  }, [minePage, mineStatus, approvalPage, router]);

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

  async function handleApply(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!form.leaveTypeId || !form.fromDate || !form.toDate || !form.reason) {
      setFormError("Leave type, dates and a reason are required.");
      return;
    }
    if (form.toDate < form.fromDate) {
      setFormError("The end date must not be before the start date.");
      return;
    }
    setSubmitting(true);
    try {
      await applyLeave(form);
      setForm({ leaveTypeId: "", fromDate: "", toDate: "", reason: "" });
      setTab("mine");
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to apply");
    } finally {
      setSubmitting(false);
    }
  }

  if (state === "loading") {
    return (
      <DashboardShell title="Leave Management" subtitle="Balances and approvals">
        <div className="p-8 text-sm text-slate-500">Loading leave data…</div>
      </DashboardShell>
    );
  }

  if (state === "error") {
    return (
      <DashboardShell title="Leave Management" subtitle="Balances and approvals">
        <div className="m-8 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {errorMessage}
        </div>
      </DashboardShell>
    );
  }

  const tabs: Array<[Tab, string]> = [
    ...(canApply
      ? ([
          ["apply", "Apply"],
          ["mine", "My requests"],
        ] as Array<[Tab, string]>)
      : []),
    ...(canApprove ? ([["approvals", "Approvals"]] as Array<[Tab, string]>) : []),
  ];

  return (
    <DashboardShell
      title="Leave Management"
      subtitle="Apply for leave, track balances and decide requests"
    >
      <main className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        {canApply && balances.length > 0 && (
          <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {balances.map((balance) => (
              <div
                key={balance.leaveTypeId}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {balance.name}
                </p>
                <p className="mt-1 text-2xl font-black text-slate-950">
                  {balance.remaining === null ? "—" : balance.remaining}
                </p>
                <p className="text-xs text-slate-500">
                  {balance.used} used · {balance.pending} pending
                  {balance.annualQuota > 0
                    ? ` · quota ${balance.annualQuota}`
                    : ""}
                </p>
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

        {tab === "apply" && canApply && (
          <form
            onSubmit={handleApply}
            className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-2"
          >
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-600">
                Leave type
              </span>
              <select
                value={form.leaveTypeId}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, leaveTypeId: e.target.value }))
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
              >
                <option value="">Select a type</option>
                {types.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name} ({type.code})
                  </option>
                ))}
              </select>
            </label>
            <div />
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-600">From</span>
              <input
                type="date"
                value={form.fromDate}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, fromDate: e.target.value }))
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-600">To</span>
              <input
                type="date"
                value={form.toDate}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, toDate: e.target.value }))
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-slate-600">
                Reason
              </span>
              <textarea
                value={form.reason}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, reason: e.target.value }))
                }
                rows={3}
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>
            <div className="flex items-center gap-3 sm:col-span-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {submitting ? "Submitting…" : "Submit request"}
              </button>
              {formError && (
                <span className="text-sm text-red-600">{formError}</span>
              )}
            </div>
          </form>
        )}

        {tab === "mine" && canApply && (
          <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <select
              value={mineStatus}
              onChange={(e) => {
                setMinePage(1);
                setMineStatus(e.target.value as LeaveStatus | "");
              }}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">All statuses</option>
              {LEAVE_STATUSES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-2">Type</th>
                    <th>Dates</th>
                    <th>Days</th>
                    <th>Status</th>
                    <th>Note</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {mine.map((row) => (
                    <tr key={row.id}>
                      <td className="py-3 font-semibold text-slate-900">
                        {row.leaveType.name}
                      </td>
                      <td className="text-slate-600">
                        {day(row.fromDate)} → {day(row.toDate)}
                      </td>
                      <td className="text-slate-600">{row.days}</td>
                      <td>
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${STATUS_STYLES[row.status]}`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="text-slate-500">
                        {row.decisionNote || "—"}
                      </td>
                      <td className="py-3 text-right">
                        {row.status === "PENDING" && (
                          <button
                            type="button"
                            onClick={() => run(() => cancelLeaveRequest(row.id))}
                            className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {mine.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-500">
                        You have not applied for leave yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>
                Page {minePage} of {mineTotalPages}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={minePage <= 1}
                  onClick={() => setMinePage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={minePage >= mineTotalPages}
                  onClick={() => setMinePage((p) => p + 1)}
                  className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </section>
        )}

        {tab === "approvals" && canApprove && (
          <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-2">Applicant</th>
                    <th>Type</th>
                    <th>Dates</th>
                    <th>Days</th>
                    <th>Reason</th>
                    <th className="text-right">Decision</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {approvals.map((row) => (
                    <tr key={row.id}>
                      <td className="py-3 font-semibold text-slate-900">
                        {row.applicant.firstName} {row.applicant.lastName}
                        <span className="block text-xs font-normal text-slate-400">
                          {row.applicant.roles.join(", ")}
                        </span>
                      </td>
                      <td className="text-slate-600">{row.leaveType.name}</td>
                      <td className="text-slate-600">
                        {day(row.fromDate)} → {day(row.toDate)}
                      </td>
                      <td className="text-slate-600">{row.days}</td>
                      <td className="max-w-xs truncate text-slate-500">
                        {row.reason}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              run(() => decideLeaveRequest(row.id, "APPROVED"))
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
                      </td>
                    </tr>
                  ))}
                  {approvals.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-500">
                        No pending leave requests in your scope.
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
                      await decideLeaveRequest(rejectFor, "REJECTED", rejectNote);
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
                Page {approvalPage} of {approvalTotalPages}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={approvalPage <= 1}
                  onClick={() => setApprovalPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={approvalPage >= approvalTotalPages}
                  onClick={() => setApprovalPage((p) => p + 1)}
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

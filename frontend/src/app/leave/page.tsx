"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { AuthRequiredError } from "@/lib/auth";
import {
  LEAVE_STATUSES,
  LeaveRequest,
  LeaveStatus,
  decideLeaveRequest,
  listLeaveApprovals,
} from "@/lib/leaveApi";

type ViewState = "loading" | "ready" | "error";

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusTone(
  status: LeaveStatus
): "warning" | "success" | "danger" | "neutral" {
  if (status === "APPROVED") return "success";
  if (status === "REJECTED") return "danger";
  if (status === "PENDING") return "warning";
  return "neutral";
}

export default function LeaveApprovalsPage() {
  const router = useRouter();

  const [state, setState] = useState<ViewState>("loading");
  const [status, setStatus] = useState<LeaveStatus>("PENDING");
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");
  const [rejectingId, setRejectingId] = useState("");
  const [rejectNote, setRejectNote] = useState("");

  const load = useCallback(async () => {
    setState("loading");
    setError("");

    try {
      const result = await listLeaveApprovals({
        status,
        page: 1,
        pageSize: 50,
      });

      setRequests(result.items);
      setTotal(result.total);
      setState("ready");
    } catch (err) {
      if (err instanceof AuthRequiredError) {
        router.replace("/login");
        return;
      }

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load leave requests."
      );
      setState("error");
    }
  }, [router, status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(
    request: LeaveRequest,
    decision: "APPROVED" | "REJECTED"
  ) {
    setBusyId(request.id);
    setError("");
    setNotice("");

    try {
      await decideLeaveRequest(
        request.id,
        decision,
        decision === "REJECTED" ? rejectNote.trim() || undefined : undefined
      );

      setNotice(
        `${request.applicant.firstName} ${request.applicant.lastName}'s leave was ${decision.toLowerCase()}.`
      );
      setRejectingId("");
      setRejectNote("");
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to record the decision."
      );
    } finally {
      setBusyId("");
    }
  }

  return (
    <DashboardShell
      title="Leave"
      subtitle="Review and decide staff and student leave requests"
      allowedRoles={["HR"]}
    >
      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-blue-600">
                People operations
              </p>

              <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                Leave approvals
              </h1>

              <p className="mt-2 text-sm text-slate-500">
                Decisions are recorded against your account and scoped
                by the backend to your institution.
              </p>
            </div>

            <label className="text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Status
              </span>

              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as LeaveStatus)
                }
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
              >
                {LEAVE_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {notice && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-800">
            {notice}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4"
          >
            <p className="text-sm font-bold text-red-900">{error}</p>
          </div>
        )}

        <DashboardCard
          title={`${total} request${total === 1 ? "" : "s"}`}
        >
          {state === "loading" && (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="acadlyx-skeleton h-16 w-full rounded-xl"
                />
              ))}
            </div>
          )}

          {state === "error" && (
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
            >
              Try again
            </button>
          )}

          {state === "ready" && requests.length === 0 && (
            <div className="py-10 text-center">
              <p className="font-bold text-slate-900">
                Nothing to review
              </p>

              <p className="mt-1 text-sm text-slate-500">
                There are no {status.toLowerCase()} leave requests.
              </p>
            </div>
          )}

          {state === "ready" && requests.length > 0 && (
            <ul className="divide-y divide-slate-100">
              {requests.map((request) => (
                <li key={request.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-900">
                          {request.applicant.firstName}{" "}
                          {request.applicant.lastName}
                        </p>

                        <StatusBadge tone={statusTone(request.status)}>
                          {request.status}
                        </StatusBadge>
                      </div>

                      <p className="mt-1 text-sm text-slate-600">
                        {request.leaveType.name} · {request.days} day
                        {request.days === 1 ? "" : "s"} ·{" "}
                        {formatDate(request.fromDate)} –{" "}
                        {formatDate(request.toDate)}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {request.reason}
                      </p>
                    </div>

                    {request.status === "PENDING" && (
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          disabled={busyId === request.id}
                          onClick={() => void decide(request, "APPROVED")}
                          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                        >
                          Approve
                        </button>

                        <button
                          type="button"
                          disabled={busyId === request.id}
                          onClick={() => {
                            setRejectingId(request.id);
                            setRejectNote("");
                          }}
                          className="rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>

                  {rejectingId === request.id && (
                    <div className="mt-3 rounded-xl border border-red-100 bg-red-50 p-3">
                      <label className="text-xs font-semibold uppercase tracking-wide text-red-700">
                        Rejection note (optional)
                      </label>

                      <textarea
                        value={rejectNote}
                        onChange={(event) =>
                          setRejectNote(event.target.value)
                        }
                        rows={2}
                        className="mt-1 w-full rounded-lg border border-red-200 px-3 py-2 text-sm"
                      />

                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          disabled={busyId === request.id}
                          onClick={() => void decide(request, "REJECTED")}
                          className="rounded-lg bg-red-700 px-3 py-1.5 text-sm font-bold text-white hover:bg-red-800 disabled:opacity-50"
                        >
                          Confirm rejection
                        </button>

                        <button
                          type="button"
                          onClick={() => setRejectingId("")}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </DashboardCard>
      </div>
    </DashboardShell>
  );
}

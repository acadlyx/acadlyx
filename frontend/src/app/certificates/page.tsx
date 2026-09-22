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
  CERTIFICATE_TYPES,
  Certificate,
  CertificateStatus,
  CertificateType,
  VerificationResult,
  issueCertificate,
  listCertificates,
  listMyCertificates,
  rejectCertificate,
  requestCertificate,
  verifyCertificate,
} from "@/lib/certificatesApi";

type ViewState = "loading" | "ready" | "error";
type Tab = "mine" | "queue" | "verify";

const STATUS_STYLES: Record<CertificateStatus, string> = {
  REQUESTED: "bg-amber-100 text-amber-700",
  ISSUED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
};

const day = (value: string | null) =>
  value ? new Date(value).toLocaleDateString() : "—";

export default function CertificatesPage() {
  const router = useRouter();
  const [state, setState] = useState<ViewState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [actionError, setActionError] = useState("");

  const [user, setUser] = useState<AuthUser | null>(null);
  const [tab, setTab] = useState<Tab>("mine");

  const [mine, setMine] = useState<Certificate[]>([]);
  const [queue, setQueue] = useState<Certificate[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<CertificateStatus | "">("REQUESTED");
  const [typeFilter, setTypeFilter] = useState<CertificateType | "">("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [form, setForm] = useState({
    certificateType: "BONAFIDE" as CertificateType,
    purpose: "",
    studentId: "",
  });
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const [verifyNumber, setVerifyNumber] = useState("");
  const [verifyResult, setVerifyResult] = useState<VerificationResult | null>(
    null
  );
  const [verifyError, setVerifyError] = useState("");

  const canRequest = user?.permissions.includes("certificates.request") ?? false;
  const canRead = user?.permissions.includes("certificates.read") ?? false;
  const canIssue = user?.permissions.includes("certificates.issue") ?? false;

  const load = useCallback(async () => {
    try {
      const me = await getCurrentUser();
      setUser(me);

      const request = me.permissions.includes("certificates.request");
      const read = me.permissions.includes("certificates.read");

      if (request) {
        setMine(await listMyCertificates());
      }

      if (read) {
        const list = await listCertificates({
          page,
          status: status || undefined,
          certificateType: typeFilter || undefined,
          search: search || undefined,
        });
        setQueue(list.items);
        setSummary(list.summary);
        setTotalPages(list.meta.totalPages);
        if (!request) setTab("queue");
      }

      setState("ready");
    } catch (err) {
      if (err instanceof AuthRequiredError) {
        router.replace("/login");
        return;
      }
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to load certificates"
      );
      setState("error");
    }
  }, [page, status, typeFilter, search, router]);

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

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!form.purpose) {
      setFormError("A purpose is required.");
      return;
    }
    setSubmitting(true);
    try {
      await requestCertificate({
        certificateType: form.certificateType,
        purpose: form.purpose,
        studentId: form.studentId || undefined,
      });
      setForm({ certificateType: "BONAFIDE", purpose: "", studentId: "" });
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setVerifyError("");
    setVerifyResult(null);
    try {
      setVerifyResult(await verifyCertificate(verifyNumber.trim()));
    } catch (err) {
      setVerifyError(
        err instanceof Error ? err.message : "Verification request failed"
      );
    }
  }

  if (state === "loading") {
    return (
      <DashboardShell title="Certificates" subtitle="Requests and issuance">
        <div className="p-8 text-sm text-slate-500">Loading certificates…</div>
      </DashboardShell>
    );
  }

  if (state === "error") {
    return (
      <DashboardShell title="Certificates" subtitle="Requests and issuance">
        <div className="m-8 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {errorMessage}
        </div>
      </DashboardShell>
    );
  }

  const tabs: Array<[Tab, string]> = [
    ...(canRequest ? ([["mine", "My certificates"]] as Array<[Tab, string]>) : []),
    ...(canRead ? ([["queue", "Requests"]] as Array<[Tab, string]>) : []),
    ["verify", "Verify"],
  ];

  return (
    <DashboardShell
      title="Certificates"
      subtitle="Request, issue and verify institutional certificates"
    >
      <main className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
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

        {tab === "mine" && canRequest && (
          <>
            <form
              onSubmit={handleRequest}
              className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-3"
            >
              <label className="text-sm">
                <span className="mb-1 block font-medium text-slate-600">
                  Certificate type
                </span>
                <select
                  value={form.certificateType}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      certificateType: e.target.value as CertificateType,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2"
                >
                  {CERTIFICATE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="mb-1 block font-medium text-slate-600">
                  Purpose
                </span>
                <input
                  value={form.purpose}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, purpose: e.target.value }))
                  }
                  placeholder="Bank account opening, visa application, …"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2"
                />
              </label>
              {canRead && (
                <label className="text-sm sm:col-span-2">
                  <span className="mb-1 block font-medium text-slate-600">
                    Raise on behalf of (student user ID, optional)
                  </span>
                  <input
                    value={form.studentId}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, studentId: e.target.value }))
                    }
                    placeholder="Leave blank to request for yourself"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2"
                  />
                </label>
              )}
              <div className="flex items-center gap-3 sm:col-span-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  {submitting ? "Submitting…" : "Request certificate"}
                </button>
                {formError && (
                  <span className="text-sm text-red-600">{formError}</span>
                )}
              </div>
            </form>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="py-2">Type</th>
                      <th>Purpose</th>
                      <th>Number</th>
                      <th>Issued</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {mine.map((row) => (
                      <tr key={row.id}>
                        <td className="py-3 font-semibold text-slate-900">
                          {row.certificateType.replace("_", " ")}
                        </td>
                        <td className="text-slate-600">{row.purpose || "—"}</td>
                        <td className="font-mono text-xs text-slate-600">
                          {row.certificateNumber || "—"}
                        </td>
                        <td className="text-slate-600">{day(row.issuedAt)}</td>
                        <td>
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-semibold ${STATUS_STYLES[row.status]}`}
                          >
                            {row.status}
                          </span>
                          {row.remarks && (
                            <span className="block text-xs text-slate-400">
                              {row.remarks}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {mine.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-6 text-center text-slate-500"
                        >
                          You have not requested any certificates.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {tab === "queue" && canRead && (
          <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-3">
                <input
                  value={search}
                  onChange={(e) => {
                    setPage(1);
                    setSearch(e.target.value);
                  }}
                  placeholder="Search student or number"
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
                <select
                  value={status}
                  onChange={(e) => {
                    setPage(1);
                    setStatus(e.target.value as CertificateStatus | "");
                  }}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">All statuses</option>
                  <option value="REQUESTED">Requested</option>
                  <option value="ISSUED">Issued</option>
                  <option value="REJECTED">Rejected</option>
                </select>
                <select
                  value={typeFilter}
                  onChange={(e) => {
                    setPage(1);
                    setTypeFilter(e.target.value as CertificateType | "");
                  }}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">All types</option>
                  {CERTIFICATE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-sm text-slate-500">
                {Object.entries(summary)
                  .map(([key, value]) => `${key}: ${value}`)
                  .join(" · ") || "No certificate records yet"}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-2">Student</th>
                    <th>Type</th>
                    <th>Purpose</th>
                    <th>Number</th>
                    <th>Status</th>
                    <th className="text-right">Action</th>
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
                        {row.certificateType.replace("_", " ")}
                      </td>
                      <td className="max-w-xs truncate text-slate-500">
                        {row.purpose || "—"}
                      </td>
                      <td className="font-mono text-xs text-slate-600">
                        {row.certificateNumber || "—"}
                      </td>
                      <td>
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${STATUS_STYLES[row.status]}`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        {row.status === "REQUESTED" && canIssue && (
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => run(() => issueCertificate(row.id))}
                              className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white"
                            >
                              Issue
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
                      await rejectCertificate(rejectFor, rejectNote);
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

        {tab === "verify" && (
          <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <form onSubmit={handleVerify} className="flex flex-wrap items-end gap-3">
              <label className="flex-1 text-sm">
                <span className="mb-1 block font-medium text-slate-600">
                  Certificate number
                </span>
                <input
                  value={verifyNumber}
                  onChange={(e) => setVerifyNumber(e.target.value)}
                  placeholder="BON-2026-00001"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono"
                />
              </label>
              <button
                type="submit"
                disabled={!verifyNumber.trim()}
                className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
              >
                Verify
              </button>
            </form>

            {verifyError && (
              <p className="text-sm text-red-600">{verifyError}</p>
            )}

            {verifyResult && (
              <div
                className={`rounded-2xl p-5 ${
                  verifyResult.valid
                    ? "bg-emerald-50 text-emerald-900"
                    : "bg-red-50 text-red-900"
                }`}
              >
                <p className="text-lg font-bold">
                  {verifyResult.valid
                    ? "Certificate is genuine"
                    : "No valid certificate found for that number"}
                </p>
                {verifyResult.valid && (
                  <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="font-semibold">Student</dt>
                      <dd>{verifyResult.studentName}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold">Institution</dt>
                      <dd>{verifyResult.institution}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold">Type</dt>
                      <dd>{verifyResult.certificateType?.replace("_", " ")}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold">Issued</dt>
                      <dd>{day(verifyResult.issuedAt ?? null)}</dd>
                    </div>
                  </dl>
                )}
              </div>
            )}
          </section>
        )}
      </main>
    </DashboardShell>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuthRequiredError, getCurrentUser } from "@/lib/auth";
import { approveFeeStructure, listFeeStructures, rejectFeeStructure, type FeeStructure } from "@/lib/erpApi";

export default function DirectorFeeApprovalsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<FeeStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [canApprove, setCanApprove] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const user = await getCurrentUser({ force: true });
      if (!user.permissions.includes("fees.structure.approve")) {
        setCanApprove(false);
        setRows([]);
        return;
      }
      setCanApprove(true);
      setRows(await listFeeStructures({ status: "PENDING_APPROVAL" }));
    } catch (e) {
      if (e instanceof AuthRequiredError) router.replace("/login");
      else setError("Campus fee approvals could not be loaded. Please retry.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  async function approve(row: FeeStructure) {
    if (busyId || !window.confirm(`Approve “${row.name}” within your assigned campus scope?`)) return;
    setBusyId(row.id);
    setError("");
    try { await approveFeeStructure(row.id); await load(); }
    catch { setError("This fee structure could not be approved. Refresh the queue and review its current status."); }
    finally { setBusyId(null); }
  }

  async function reject(row: FeeStructure) {
    if (busyId) return;
    const reason = window.prompt("Enter the rejection reason (at least 3 characters):");
    if (reason === null) return;
    if (reason.trim().length < 3) { setError("Enter a rejection reason of at least 3 characters."); return; }
    setBusyId(row.id);
    setError("");
    try { await rejectFeeStructure(row.id, reason); await load(); }
    catch { setError("This fee structure could not be rejected. Refresh the queue and review its current status."); }
    finally { setBusyId(null); }
  }

  return <DashboardShell title="Campus Fee Approvals" subtitle="Review pending fee structures within your assigned campus scope" allowedRoles={["DIRECTOR"]}>
    <main className="mx-auto max-w-6xl space-y-5">
      <header className="rounded-2xl border bg-white p-6">
        <h1 className="text-2xl font-black text-slate-900">Pending campus fee approvals</h1>
        <p className="mt-2 text-sm text-slate-600">Only fee structures linked to programs in your assigned campuses are returned by the server. Approval and rejection are independently checked against campus scope and maker-checker rules.</p>
      </header>
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
      {loading ? <div className="rounded-xl border bg-white p-8 text-sm text-slate-500">Loading campus approval queue…</div> :
        !canApprove ? null :
        rows.length === 0 ? <div className="rounded-xl border bg-white p-8 text-sm text-slate-500">There are no fee structures awaiting approval in your assigned campus scope.</div> :
        <div className="space-y-4">{rows.map(row => <article key={row.id} className="rounded-2xl border bg-white p-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div><h2 className="text-lg font-bold text-slate-900">{row.name}</h2><p className="mt-1 text-xs text-slate-500">Academic year: {row.academicYearId || "Not specified"} · Program: {row.programId || "Not specified"} · Semester: {row.semesterId || "Not specified"}</p><p className="mt-2 text-sm font-semibold">Total: {new Intl.NumberFormat("en-IN", { style: "currency", currency: row.currency || "INR" }).format(row.totalAmount)}</p></div>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">Pending approval</span>
          </div>
          <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-xs text-slate-500"><th className="py-2 pr-3">Fee head</th><th className="py-2 pr-3">Installment</th><th className="py-2 text-right">Amount</th></tr></thead><tbody>{row.items.map(item => <tr key={item.id} className="border-b last:border-0"><td className="py-2 pr-3">{item.feeHeadName}</td><td className="py-2 pr-3">{item.installmentNumber}</td><td className="py-2 text-right">{new Intl.NumberFormat("en-IN", { style: "currency", currency: row.currency || "INR" }).format(item.amount)}</td></tr>)}</tbody></table></div>
          {row.notes && <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">Notes: {row.notes}</p>}
          <div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={busyId !== null || loading} onClick={() => void approve(row)} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{busyId === row.id ? "Processing…" : "Approve for campus"}</button><button type="button" disabled={busyId !== null || loading} onClick={() => void reject(row)} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-bold text-red-700 disabled:cursor-not-allowed disabled:opacity-50">{busyId === row.id ? "Processing…" : "Reject with reason"}</button></div>
        </article>)}</div>}
    </main>
  </DashboardShell>;
}

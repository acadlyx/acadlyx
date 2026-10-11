"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuthRequiredError, getCurrentUser } from "@/lib/auth";
import { listFeeStructures, type FeeStructure } from "@/lib/erpApi";

export default function ChairmanFeesPage() {
  const router = useRouter();
  const [rows, setRows] = useState<FeeStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [canRead, setCanRead] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const user = await getCurrentUser({ force: true });
      if (!user.permissions.includes("fees.structure.read")) { setCanRead(false); setRows([]); return; }
      setCanRead(true);
      setRows(await listFeeStructures());
    } catch (e) {
      if (e instanceof AuthRequiredError) router.replace("/login");
      else setError("Institution fee structures could not be loaded. Retry to refresh the current server result.");
    } finally { setLoading(false); }
  }, [router]);
  useEffect(() => { void load(); }, [load]);
  return <DashboardShell title="Chairman Finance Oversight" subtitle="Institution-wide fee structure and publication visibility" allowedRoles={["CHAIRMAN"]}>
    <main className="mx-auto max-w-7xl space-y-5">
      <header className="rounded-3xl border border-amber-100 bg-[#faf7ef] p-7"><p className="text-xs font-black uppercase tracking-widest text-slate-500">Finance governance</p><h1 className="mt-2 text-3xl font-black text-slate-950">Institution fee structures</h1><p className="mt-2 text-sm leading-6 text-slate-700">Review institution-wide fee structures, create drafts and publish finalized structures for Accounts to assign to students.</p><div className="mt-4 flex flex-wrap gap-3"><Link href="/chairman/fees/structures" className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white">Create / publish fee structures</Link><Link href="/chairman/operations" className="rounded-xl border bg-white px-4 py-2 text-sm font-bold text-slate-800">Back to operations</Link></div></header>
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}<button type="button" onClick={() => void load()} className="ml-3 font-bold underline">Retry</button></div>}
      {loading ? <div className="rounded-xl border bg-white p-6 text-sm text-slate-500">Loading institutional fee structures…</div> : !canRead ? null : rows.length === 0 ? <div className="rounded-xl border bg-white p-8 text-sm text-slate-500">No fee structures were returned for the current institution.</div> : <div className="overflow-x-auto rounded-2xl border bg-white"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-4">Structure</th><th className="p-4">Academic year</th><th className="p-4">Status</th><th className="p-4 text-right">Total</th></tr></thead><tbody className="divide-y">{rows.map(row => <tr key={row.id}><td className="p-4"><p className="font-bold text-slate-900">{row.name}</p><p className="mt-1 text-xs text-slate-500">{row.items.length} fee line(s)</p></td><td className="p-4 text-slate-600">{row.academicYearId || "Not specified"}</td><td className="p-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{row.status.replaceAll("_", " ")}</span></td><td className="p-4 text-right font-bold">{new Intl.NumberFormat("en-IN", {style:"currency",currency:row.currency || "INR"}).format(row.totalAmount)}</td></tr>)}</tbody></table></div>}
    </main>
  </DashboardShell>;
}

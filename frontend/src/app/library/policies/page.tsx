"use client";
import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { getCurrentUser, AuthRequiredError } from "@/lib/auth";
import { getLibraryPolicy, updateLibraryPolicy, LibraryPolicy } from "@/lib/libraryApi";
import { useRouter } from "next/navigation";

export default function LibraryPoliciesPage() {
  const router = useRouter();
  const [policy, setPolicy] = useState<LibraryPolicy | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  useEffect(() => { void (async () => { try {
    const me = await getCurrentUser();
    if (!me.permissions.includes("library.manage")) throw new Error("You do not have access to manage library policy.");
    setPolicy(await getLibraryPolicy());
  } catch (e) {
    if (e instanceof AuthRequiredError) { router.replace("/login"); return; }
    setError(e instanceof Error ? e.message : "Unable to load policy");
  } })(); }, [router]);
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!policy) return;
    setError(""); setSaved("");
    try {
      const { id, institutionId, ...input } = policy;
      void id; void institutionId;
      setPolicy(await updateLibraryPolicy(input));
      setSaved("Library policy saved. Existing loans retain their historical terms.");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save policy"); }
  }
  if (!policy && !error) return <DashboardShell title="Library Policies" subtitle="Institutional circulation rules"><div className="p-8 text-sm text-slate-500">Loading policy…</div></DashboardShell>;
  const numberFields: Array<[keyof LibraryPolicy, string, boolean]> = [
    ["maxActiveLoans","Maximum books per member",false],["defaultLoanDays","Default loan duration (days)",false],["maxRenewals","Maximum renewals",false],["gracePeriodDays","Grace period (days)",false],
    ["dailyFine","Daily late fine",true],["fineCap","Fine cap",true],["lostAdministrativeCharge","Lost-book administrative charge",true],
    ["damagedChargePercent","Damage charge percentage",true],["damagedFixedCharge","Fixed damage charge",true],["reservationHoldDays","Reservation hold (days)",false],
  ];
  return <DashboardShell title="Library Policies" subtitle="Institutional circulation rules">
    <main className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8">
      <form onSubmit={save} className="grid gap-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-2">
        {error && <div className="sm:col-span-2 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        {saved && <div className="sm:col-span-2 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">{saved}</div>}
        <label className="text-sm font-medium text-slate-700"><span className="mb-1 block">Policy name</span><input value={policy?.name ?? ""} onChange={e => policy && setPolicy({...policy,name:e.target.value})} className="w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
        {numberFields.map(([key,label,decimal]) => <label key={String(key)} className="text-sm font-medium text-slate-700"><span className="mb-1 block">{label}</span><input type="number" min="0" step={decimal ? "0.01" : "1"} value={String(policy?.[key] ?? "")} onChange={e => policy && setPolicy({...policy,[key]:Number(e.target.value)})} className="w-full rounded-xl border border-slate-200 px-3 py-2" /></label>)}
        <label className="text-sm font-medium text-slate-700"><span className="mb-1 block">Lost-book charge basis</span><select value={policy?.lostChargeType ?? "REPLACEMENT_VALUE"} onChange={e => policy && setPolicy({...policy,lostChargeType:e.target.value})} className="w-full rounded-xl border border-slate-200 px-3 py-2"><option value="REPLACEMENT_VALUE">Replacement value</option><option value="CURRENT_VALUE">Current value</option><option value="FIXED">Fixed amount</option></select></label>
        <label className="text-sm font-medium text-slate-700"><span className="mb-1 block">Damage charge basis</span><select value={policy?.damagedChargeType ?? "PERCENTAGE"} onChange={e => policy && setPolicy({...policy,damagedChargeType:e.target.value})} className="w-full rounded-xl border border-slate-200 px-3 py-2"><option value="PERCENTAGE">Percentage of value</option><option value="FIXED">Fixed amount</option><option value="NONE">No automatic charge</option></select></label>
        <div className="sm:col-span-2 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">These are defaults for new transactions. Librarians can override authorized transaction terms, and the resulting terms are stored on the loan.</div>
        <div className="sm:col-span-2 flex justify-end"><button type="submit" className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white">Save policy</button></div>
      </form>
    </main>
  </DashboardShell>;
}

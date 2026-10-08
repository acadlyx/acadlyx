"use client";
import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { getCurrentUser, AuthRequiredError } from "@/lib/auth";
import { listBookCopies, LibraryBookCopy } from "@/lib/libraryApi";
import { useRouter } from "next/navigation";

export default function LibraryCopiesPage() {
  const router = useRouter();
  const [items, setItems] = useState<LibraryBookCopy[]>([]);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { void (async () => { try {
    const me = await getCurrentUser();
    if (!me.permissions.includes("library.manage")) throw new Error("You do not have access to manage physical copies.");
    const result = await listBookCopies({ status: status || undefined, search: search || undefined });
    setItems(result.items);
  } catch (e) { if (e instanceof AuthRequiredError) { router.replace("/login"); return; } setError(e instanceof Error ? e.message : "Unable to load copies"); } finally { setLoading(false); } })(); }, [router, status, search]);
  return <DashboardShell title="Book Copies" subtitle="Physical inventory, accession and valuation">
    <main className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search accession, barcode or title" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        <select value={status} onChange={e => setStatus(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="">All statuses</option>{["AVAILABLE","ISSUED","RESERVED","LOST","DAMAGED","MAINTENANCE","WITHDRAWN"].map(s => <option key={s}>{s}</option>)}</select>
      </section>
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-4">Accession</th><th>Book</th><th>Location</th><th>Acquisition</th><th>Current value</th><th>Condition</th><th>Status</th></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {loading ? <tr><td colSpan={7} className="p-6 text-center text-slate-500">Loading physical inventory…</td></tr> : items.map(copy => <tr key={copy.id}><td className="p-4 font-semibold text-slate-900">{copy.accessionNumber}<span className="block text-xs font-normal text-slate-400">{copy.barcode || "No barcode"}</span></td><td>{copy.book.title}</td><td>{copy.location || copy.shelf || "—"}</td><td>{copy.acquisitionCost == null ? "—" : `₹${copy.acquisitionCost.toFixed(2)}`}</td><td>{copy.currentValue == null ? "—" : `₹${copy.currentValue.toFixed(2)}`}</td><td>{copy.condition}</td><td><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">{copy.status}</span></td></tr>)}
          {!loading && items.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-slate-500">No physical copies match the current filter.</td></tr>}
        </tbody></table></div></section>
    </main>
  </DashboardShell>;
}
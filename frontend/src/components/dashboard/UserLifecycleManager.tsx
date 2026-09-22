"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardShell } from "./DashboardShell";
import { AuthRequiredError } from "@/lib/auth";
import { ErpUser, listUsers, setUserActive } from "@/lib/erpApi";
import { useRouter } from "next/navigation";

function roleLabel(user: ErpUser) {
  return user.roles?.map((role) => role.name.replace(/_/g, " ")).join(", ") || "No role";
}

export function UserLifecycleManager() {
  const router = useRouter();
  const [users, setUsers] = useState<ErpUser[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    listUsers().then(setUsers).catch((reason: Error) => {
      if (reason instanceof AuthRequiredError) router.replace("/login");
      else setError(reason.message || "Unable to load users.");
    }).finally(() => setLoading(false));
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return term ? users.filter((user) => `${user.firstName} ${user.lastName} ${user.email} ${roleLabel(user)}`.toLocaleLowerCase().includes(term)) : users;
  }, [query, users]);

  async function toggle(user: ErpUser) {
    const isActive = user.isActive !== false;
    const action = isActive ? "deactivate" : "reactivate";
    if (!window.confirm(`${isActive ? "Deactivate" : "Reactivate"} ${user.firstName} ${user.lastName}? ${isActive ? "They will be signed out immediately. Academic, financial and audit records will be retained." : "They will be able to sign in again."}`)) return;
    setPendingId(user.id); setError("");
    try {
      const updated = await setUserActive(user.id, !isActive);
      setUsers((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
    } catch (reason) { setError(reason instanceof Error ? reason.message : `Unable to ${action} user.`); }
    finally { setPendingId(null); }
  }

  return <DashboardShell title="User Lifecycle" subtitle="Tenant-scoped account activation and access control" allowedRoles={["INSTITUTION_ADMIN", "SUPER_ADMIN"]}>
    <main className="mx-auto max-w-6xl space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white p-5"><h1 className="text-lg font-semibold">People and access</h1><p className="mt-1 text-sm text-slate-500">Deactivate accounts to remove access safely. Records are retained for institutional continuity and auditability.</p><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email, or role" className="mt-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500" /></section>
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}<button onClick={load} className="ml-3 font-semibold underline">Retry</button></div>}
      {loading && <div className="h-64 animate-pulse rounded-lg bg-slate-200" />}
      {!loading && !error && <section className="overflow-hidden rounded-lg border border-slate-200 bg-white"><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">User</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{filtered.map((user) => { const active = user.isActive !== false; return <tr key={user.id}><td className="px-4 py-4"><p className="font-medium text-slate-900">{user.firstName} {user.lastName}</p><p className="text-slate-500">{user.email}</p></td><td className="px-4 py-4 text-slate-600">{roleLabel(user)}</td><td className="px-4 py-4"><span className={`rounded-full px-2 py-1 text-xs font-medium ${active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{active ? "Active" : "Deactivated"}</span></td><td className="px-4 py-4 text-right"><button disabled={pendingId === user.id} onClick={() => void toggle(user)} className={`rounded-md border px-3 py-2 text-xs font-semibold disabled:opacity-50 ${active ? "border-red-200 text-red-700 hover:bg-red-50" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"}`}>{pendingId === user.id ? "Saving…" : active ? "Deactivate" : "Reactivate"}</button></td></tr>; })}</tbody></table></div>{filtered.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No users match this search.</p>}</section>}
    </main>
  </DashboardShell>;
}

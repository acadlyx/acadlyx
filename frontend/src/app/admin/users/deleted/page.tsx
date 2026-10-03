"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DeletedAdminUser, listDeletedAdminUsers, recoverAdminUser, requestAdminUserPermanentDeletion } from "@/lib/adminApi";

function date(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function DeletedUsersPage() {
  const [users, setUsers] = useState<DeletedAdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [expiringSoon, setExpiringSoon] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError("");
    try { setUsers((await listDeletedAdminUsers({ search, expiringSoon, pageSize: 100 })).items); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to load deleted users."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [expiringSoon]); // search is submitted explicitly

  async function permanentlyDelete(user: DeletedAdminUser) {
    if (user.daysRemaining > 0) {
      setError("Permanent deletion is available only after the 90-day recovery window expires.");
      return;
    }

    if (!window.confirm(`Permanently delete ${user.firstName} ${user.lastName}? This cannot be undone.`)) {
      return;
    }

    const reason = window.prompt("Optional permanent-deletion reason:", "")?.trim() || undefined;
    setBusyId(user.id);
    setError("");
    setMessage("");

    try {
      const result = await requestAdminUserPermanentDeletion(user.id, reason);
      if (result.permanentlyDeleted) {
        setUsers((current) => current.filter((item) => item.id !== user.id));
        setMessage("User permanently deleted.");
      } else {
        setMessage(result.message || "Permanent deletion request submitted for approval.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to permanently delete user.");
    } finally {
      setBusyId(null);
    }
  }

  async function recover(user: DeletedAdminUser) {
    if (!window.confirm(`Recover ${user.firstName} ${user.lastName}? Their original user ID and institutional history will be preserved.`)) return;
    try {
      await recoverAdminUser(user.id, "Recovered from the ACADLYX recycle bin");
      setMessage("User recovered successfully.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to recover user."); }
  }

  return (
    <DashboardShell title="Deleted Users" subtitle="90-day recovery workspace for soft-deleted accounts.">
      <main className="acadlyx-page-container acadlyx-workspace-content">
        <header className="acadlyx-page-header">
          <div><p className="acadlyx-eyebrow">USER LIFECYCLE</p><h1 className="acadlyx-page-title">Deleted Users</h1><p className="acadlyx-page-description">Deleted accounts remain recoverable for 90 days. Protected institutional records are never cascade-deleted.</p></div>
          <div className="acadlyx-page-actions"><Link href="/admin/users" className="acadlyx-button-secondary">Active users</Link></div>
        </header>
        <section className="acadlyx-section-card mb-5">
          <div className="acadlyx-card-content flex flex-col gap-3 sm:flex-row">
            <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void load(); }} placeholder="Search name or email" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-3 text-sm"/>
            <button type="button" onClick={() => void load()} className="acadlyx-button-primary">Search</button>
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm"><input type="checkbox" checked={expiringSoon} onChange={(e) => setExpiringSoon(e.target.checked)}/> Expiring within 14 days</label>
          </div>
        </section>
        {message ? <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{message}</div> : null}
        {error ? <div className="mb-5 acadlyx-error-state">{error}</div> : null}
        {loading ? <div className="acadlyx-loading-state">Loading deleted users…</div> : users.length === 0 ? <div className="acadlyx-empty-state">No deleted users match the current filters.</div> : (
          <div className="acadlyx-section-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full text-left text-sm">
                <thead><tr className="border-b border-slate-200 bg-slate-50"><th className="px-4 py-3">User</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Deleted</th><th className="px-4 py-3">Recovery deadline</th><th className="px-4 py-3">Days remaining</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3">Actions</th></tr></thead>
                <tbody>{users.map((user) => (
                  <tr key={user.id} className="border-b border-slate-100">
                    <td className="px-4 py-4"><Link href={`/admin/users/${user.id}`} className="font-semibold text-indigo-700">{user.firstName} {user.lastName}</Link><div className="text-xs text-slate-500">{user.email}</div><div className="text-[11px] text-slate-400">{user.id}</div></td>
                    <td className="px-4 py-4">{user.roles?.map((r) => r.name).join(", ") || "—"}</td>
                    <td className="px-4 py-4">{date(user.deletedAt)}</td><td className="px-4 py-4">{date(user.recoveryDeadline)}</td>
                    <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${user.daysRemaining <= 14 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"}`}>{user.daysRemaining}</span></td>
                    <td className="max-w-[220px] px-4 py-4">{user.deletionReason || "—"}</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        {user.daysRemaining > 0 ? (
                          <button type="button" onClick={() => void recover(user)} className="acadlyx-button-primary">Recover</button>
                        ) : null}
                        {user.daysRemaining === 0 ? (
                          <button
                            type="button"
                            onClick={() => void permanentlyDelete(user)}
                            disabled={busyId === user.id}
                            className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                          >
                            {busyId === user.id ? "Deleting…" : "Delete permanently"}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </DashboardShell>
  );
}

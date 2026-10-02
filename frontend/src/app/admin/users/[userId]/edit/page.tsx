"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { getAdminUser, updateAdminUser, AdminUser } from "@/lib/adminApi";

export default function AdminEditUserPage({ params }: { params: Promise<{ userId: string }> }) {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [user, setUser] = useState<AdminUser | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    params.then(({ userId: resolvedId }) => {
      if (cancelled) return;
      setUserId(resolvedId);
      return getAdminUser(resolvedId).then((value) => { if (!cancelled) setUser(value); });
    }).catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Unable to load user."); });
    return () => { cancelled = true; };
  }, [params]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    setSaving(true); setError("");
    try {
      const form = new FormData(e.currentTarget);
      const updated = await updateAdminUser(user.id, {
        firstName: String(form.get("firstName") || "").trim(),
        lastName: String(form.get("lastName") || "").trim(),
        email: String(form.get("email") || "").trim(),
        phone: String(form.get("phone") || "").trim(),
      });
      setUser(updated);
      router.push(`/admin/users/${user.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update user.");
    } finally { setSaving(false); }
  }

  return (
    <DashboardShell title="Edit user" subtitle="Edit only fields permitted by the existing RBAC hierarchy.">
      <main className="acadlyx-page-container acadlyx-workspace-content">
        <div className="mb-5"><Link href={`/admin/users/${userId}`} className="text-sm font-semibold text-indigo-700">← User details</Link></div>
        <header className="acadlyx-page-header"><div><p className="acadlyx-eyebrow">USER MANAGEMENT</p><h1 className="acadlyx-page-title">Edit user</h1><p className="acadlyx-page-description">Role escalation and sensitive lifecycle operations remain server-authorized.</p></div></header>
        {error ? <div className="acadlyx-error-state mb-5">{error}</div> : null}
        {!user ? <div className="acadlyx-loading-state">Loading user…</div> : (
          <form onSubmit={submit} className="acadlyx-section-card">
            <div className="acadlyx-card-header"><h2>{user.firstName} {user.lastName}</h2></div>
            <div className="acadlyx-card-content grid gap-5 sm:grid-cols-2">
              <label><span className="mb-1.5 block text-xs font-semibold text-slate-600">First name</span><input name="firstName" defaultValue={user.firstName} required className="w-full rounded-xl border border-slate-200 px-3 py-3"/></label>
              <label><span className="mb-1.5 block text-xs font-semibold text-slate-600">Last name</span><input name="lastName" defaultValue={user.lastName} required className="w-full rounded-xl border border-slate-200 px-3 py-3"/></label>
              <label><span className="mb-1.5 block text-xs font-semibold text-slate-600">Login email</span><input name="email" type="email" defaultValue={user.email} required className="w-full rounded-xl border border-slate-200 px-3 py-3"/></label>
              <label><span className="mb-1.5 block text-xs font-semibold text-slate-600">Phone</span><input name="phone" defaultValue={user.phone || ""} className="w-full rounded-xl border border-slate-200 px-3 py-3"/></label>
              <div className="sm:col-span-2 flex flex-wrap gap-3 pt-2">
                <button disabled={saving} className="acadlyx-button-primary" type="submit">{saving ? "Saving…" : "Save changes"}</button>
                <Link href={`/admin/users/${user.id}`} className="acadlyx-button-secondary">Cancel</Link>
              </div>
            </div>
          </form>
        )}
      </main>
    </DashboardShell>
  );
}

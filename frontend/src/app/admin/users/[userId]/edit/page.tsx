"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import {
  getAdminUser,
  updateAdminUser,
  listAdminDepartments,
  listAdminCampuses,
  AdminUser,
} from "@/lib/adminApi";

const EDITABLE_ROLES = [
  "INSTITUTION_ADMIN", "CHAIRMAN", "DIRECTOR", "DEAN", "REGISTRAR", "HOD",
  "FACULTY", "ACCOUNTS", "HR", "ADMISSIONS", "EXAMINATION", "LIBRARIAN",
  "PLACEMENT", "IT", "STAFF",
] as const;

function roleLabel(role: string) {
  return role.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function AdminEditUserPage({ params }: { params: Promise<{ userId: string }> }) {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [user, setUser] = useState<AdminUser | null>(null);
  const [selectedRole, setSelectedRole] = useState("");
  const [departments, setDepartments] = useState<Array<{ id: string; name: string; code?: string | null }>>([]);
  const [campuses, setCampuses] = useState<Array<{ id: string; name: string; code?: string | null }>>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingScope, setLoadingScope] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void params.then(async ({ userId: resolvedId }) => {
      if (cancelled) return;
      setUserId(resolvedId);
      setLoadingScope(true);
      try {
        const [value, departmentResult, campusResult] = await Promise.all([
          getAdminUser(resolvedId),
          listAdminDepartments().then((rows) => ({ rows })).catch(() => ({ rows: [] })),
          listAdminCampuses().then((rows) => ({ rows })).catch(() => ({ rows: [] })),
        ]);
        if (cancelled) return;
        setUser(value);
        setSelectedRole(value.roles[0]?.name || "");
        setDepartments(departmentResult.rows);
        setCampuses(campusResult.rows);
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to load user.");
      } finally {
        if (!cancelled) setLoadingScope(false);
      }
    }).catch((reason) => {
      if (!cancelled) {
        setError(reason instanceof Error ? reason.message : "Unable to load user.");
        setLoadingScope(false);
      }
    });
    return () => { cancelled = true; };
  }, [params]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    setSaving(true);
    setError("");
    try {
      const form = new FormData(event.currentTarget);
      const role = String(form.get("role") || "").toUpperCase();
      if (!EDITABLE_ROLES.includes(role as (typeof EDITABLE_ROLES)[number])) {
        throw new Error("Select a valid institutional role.");
      }
      const departmentId = String(form.get("departmentId") || "").trim();
      const departmentIds = role === "HOD" && departmentId ? [departmentId] : [];
      const campusIds = role === "DIRECTOR"
        ? form.getAll("campusIds").map((value) => String(value)).filter(Boolean)
        : [];

      if (role === "HOD" && departmentIds.length !== 1) {
        throw new Error("Select the department assigned to this HOD.");
      }
      if (role === "DIRECTOR" && campusIds.length === 0) {
        throw new Error("Select at least one campus assigned to this Director.");
      }

      const updated = await updateAdminUser(user.id, {
        firstName: String(form.get("firstName") || "").trim(),
        lastName: String(form.get("lastName") || "").trim(),
        email: String(form.get("email") || "").trim(),
        phone: String(form.get("phone") || "").trim(),
        role,
        departmentIds,
        campusIds,
      });
      setUser(updated);
      setSelectedRole(updated.roles[0]?.name || role);
      router.push(`/admin/users/${user.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update user.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardShell title="Edit user" subtitle="Update account details and the role's authorized scope.">
      <main className="acadlyx-page-container acadlyx-workspace-content">
        <div className="mb-5"><Link href={`/admin/users/${userId}`} className="text-sm font-semibold text-indigo-700">← User details</Link></div>
        <header className="acadlyx-page-header"><div><p className="acadlyx-eyebrow">USER MANAGEMENT</p><h1 className="acadlyx-page-title">Edit user</h1><p className="acadlyx-page-description">Role and scope changes are checked by the backend and recorded by the user-management workflow.</p></div></header>
        {error ? <div role="alert" className="acadlyx-error-state mb-5">{error}</div> : null}
        {!user ? <div className="acadlyx-loading-state">{error ? "User could not be loaded." : "Loading user…"}</div> : (
          <form onSubmit={submit} className="acadlyx-section-card">
            <div className="acadlyx-card-header"><h2>{user.firstName} {user.lastName}</h2></div>
            <div className="acadlyx-card-content grid gap-5 sm:grid-cols-2">
              <label><span className="mb-1.5 block text-xs font-semibold text-slate-600">First name</span><input name="firstName" defaultValue={user.firstName} required className="w-full rounded-xl border border-slate-200 px-3 py-3"/></label>
              <label><span className="mb-1.5 block text-xs font-semibold text-slate-600">Last name</span><input name="lastName" defaultValue={user.lastName} required className="w-full rounded-xl border border-slate-200 px-3 py-3"/></label>
              <label><span className="mb-1.5 block text-xs font-semibold text-slate-600">Login email</span><input name="email" type="email" defaultValue={user.email} required className="w-full rounded-xl border border-slate-200 px-3 py-3"/></label>
              <label><span className="mb-1.5 block text-xs font-semibold text-slate-600">Phone</span><input name="phone" defaultValue={user.phone || ""} className="w-full rounded-xl border border-slate-200 px-3 py-3"/></label>
              <label className="sm:col-span-2">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">Institutional role</span>
                <select name="role" value={selectedRole} onChange={(event) => setSelectedRole(event.target.value)} required className="w-full rounded-xl border border-slate-200 px-3 py-3">
                  {EDITABLE_ROLES.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}
                </select>
              </label>
              {selectedRole === "DIRECTOR" ? <label className="sm:col-span-2">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">Assigned campus scope (required)</span>
                <select name="campusIds" multiple defaultValue={user.campusAccesses?.map((access) => access.campusId) || []} disabled={loadingScope} className="min-h-32 w-full rounded-xl border border-slate-200 px-3 py-3">
                  {campuses.map((campus) => <option key={campus.id} value={campus.id}>{campus.code ? `${campus.code} — ` : ""}{campus.name}</option>)}
                </select>
                <span className="mt-1 block text-xs text-slate-500">Only assigned campuses are visible to this Director. Hold Ctrl/Command to select multiple campuses.</span>
              </label> : null}
              {selectedRole === "HOD" ? <label className="sm:col-span-2">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">Assigned department (required)</span>
                <select name="departmentId" defaultValue={user.departmentAccesses?.[0]?.departmentId || ""} disabled={loadingScope} className="w-full rounded-xl border border-slate-200 px-3 py-3">
                  <option value="">Select department</option>
                  {departments.map((department) => <option key={department.id} value={department.id}>{department.code ? `${department.code} — ` : ""}{department.name}</option>)}
                </select>
                <span className="mt-1 block text-xs text-slate-500">An HOD must be assigned exactly one department.</span>
              </label> : null}
              {selectedRole === "CHAIRMAN" ? <div className="sm:col-span-2 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">Chairman scope is institution-wide. Saving this role clears stale campus and department restrictions for this user.</div> : null}
              {selectedRole !== "DIRECTOR" && selectedRole !== "HOD" && selectedRole !== "CHAIRMAN" ? <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">This role uses its own backend authorization rules. Saving removes Director campus and HOD department assignments if this user is changing from one of those roles.</div> : null}
              <div className="sm:col-span-2 flex flex-wrap gap-3 border-t pt-4">
                <button disabled={saving || loadingScope} className="acadlyx-button-primary" type="submit">{saving ? "Saving…" : "Save changes"}</button>
                <Link href={`/admin/users/${user.id}`} className="acadlyx-button-secondary">Cancel</Link>
              </div>
            </div>
          </form>
        )}
      </main>
    </DashboardShell>
  );
}

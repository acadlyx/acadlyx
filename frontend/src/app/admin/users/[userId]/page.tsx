"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import {
  getAdminUserLifecycle,
  forceAdminUserPasswordChange,
  revokeAdminUserSessions,
  unlockAdminUser,
  adminResetUserPassword,
  AdminUserLifecycle,
} from "@/lib/adminApi";

function date(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="acadlyx-section-card">
      <div className="acadlyx-card-header"><h2>{title}</h2></div>
      <div className="acadlyx-card-content">{children}</div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><dt className="text-xs font-semibold text-slate-500">{label}</dt><dd className="mt-1 text-sm font-medium text-slate-900 break-words">{value || "—"}</dd></div>;
}

export default function AdminUserDetailsPage({ params }: { params: { userId: string } }) {
  const [user, setUser] = useState<AdminUserLifecycle | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    getAdminUserLifecycle(params.userId).then(setUser).catch((e) => setError(e instanceof Error ? e.message : "Unable to load user."));
  }, [params.userId]);

  return (
    <DashboardShell title="User details" subtitle="Authorized profile and safe account metadata.">
      <main className="acadlyx-page-container acadlyx-workspace-content">
        <div className="mb-5">
          <Link href="/admin/users" className="text-sm font-semibold text-indigo-700">← Users</Link>
        </div>
        {error ? <div className="acadlyx-error-state">{error}</div> : null}
        {!user && !error ? <div className="acadlyx-loading-state">Loading user…</div> : null}
        {user ? (
          <div className="space-y-5">
            <header className="acadlyx-page-header">
              <div>
                <p className="acadlyx-eyebrow">USER PROFILE</p>
                <h1 className="acadlyx-page-title">{user.firstName} {user.lastName}</h1>
                <p className="acadlyx-page-description">{user.email} · {user.roles.map((r) => r.name.replaceAll("_", " ")).join(", ")}</p>
              </div>
              <div className="acadlyx-page-actions">
                <Link href={`/admin/users/${user.id}/edit`} className="acadlyx-button-primary">Edit user</Link>
                <Link href={`/admin/users/deleted`} className="acadlyx-button-secondary">Recycle bin</Link>
              </div>
            </header>
            <Card title="Overview"><dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="User ID" value={user.id}/><Field label="Account status" value={user.authentication.accountStatus}/>
              <Field label="Role" value={user.roles.map((r) => r.name.replaceAll("_", " ")).join(", ")}/><Field label="Institution" value={user.institution?.name}/>
              <Field label="Created" value={date(user.createdAt)}/><Field label="Last updated" value={date(user.updatedAt)}/>
              <Field label="Last login" value={date(user.authentication.lastLogin)}/><Field label="Phone" value={user.phone}/>
            </dl></Card>
            <Card title="Personal details"><dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Full name" value={`${user.firstName} ${user.lastName}`}/><Field label="Email" value={user.email}/><Field label="Phone" value={user.phone}/>
              <Field label="Date of birth" value={date(String(user.profile?.dateOfBirth || ""))}/><Field label="Gender" value={String(user.profile?.gender || "—")}/>
              <Field label="Address" value={String(user.profile?.address || "—")}/><Field label="City" value={String(user.profile?.city || "—")}/>
              <Field label="State" value={String(user.profile?.state || "—")}/><Field label="Postal code" value={String(user.profile?.postalCode || "—")}/>
              <Field label="Guardian" value={String(user.profile?.guardianName || "—")}/><Field label="Guardian phone" value={String(user.profile?.guardianPhone || "—")}/>
              <Field label="Emergency contact" value={String(user.profile?.emergencyContactName || "—")}/><Field label="Emergency phone" value={String(user.profile?.emergencyContactPhone || "—")}/>
            </dl></Card>
            <Card title="Academic details"><div className="space-y-3">
              {user.studentEnrollments?.length ? user.studentEnrollments.map((enrollment: any) => (
                <div key={String(enrollment.id)} className="rounded-xl border border-slate-200 p-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label="Program" value={String(enrollment.program?.name || "—")}/><Field label="Academic year" value={String(enrollment.academicYear?.name || "—")}/>
                    <Field label="Semester" value={String(enrollment.semester?.name || "—")}/><Field label="Section" value={String(enrollment.section?.name || "—")}/>
                    <Field label="Roll number" value={enrollment.rollNumber}/><Field label="Enrollment status" value={enrollment.status}/>
                  </div>
                </div>
              )) : <p className="text-sm text-slate-500">No student enrollment records.</p>}
            </div></Card>
            {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{message}</div> : null}
            <Card title="Account & login security">
              <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Login email" value={user.authentication.loginEmail}/><Field label="Account ID" value={user.authentication.accountId}/>
                <Field label="Email verification" value={user.authentication.emailVerificationStatus}/><Field label="MFA" value={user.authentication.mfaEnabled ? "Enabled" : "Disabled"}/>
                <Field label="Last login" value={date(user.authentication.lastLogin)}/><Field label="Last login IP" value={user.authentication.lastLoginIp}/>
                <Field label="Last password change" value={date(user.authentication.lastPasswordChange)}/><Field label="Failed login count" value={user.authentication.failedLoginCount}/>
                <Field label="Lock status" value={user.authentication.lockedUntil ? `Locked until ${date(user.authentication.lockedUntil)}` : "Not locked"}/><Field label="Active sessions" value={user.authentication.activeSessionCount}/>
                <Field label="Force password change" value={user.authentication.forcePasswordChange ? "Required" : "No"}/>
              </dl>
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={async () => { if (!window.confirm("Send a password-reset link to this user's login email?")) return; setBusy(true); try { await adminResetUserPassword(user.id); setMessage("Password reset link issued through the configured email provider."); } catch (e) { setError(e instanceof Error ? e.message : "Unable to issue password reset."); } finally { setBusy(false); } }} className="acadlyx-button-secondary">Reset password</button>
              <button type="button" disabled={busy} onClick={async () => { if (!window.confirm("Force this user to change their password at next login?")) return; setBusy(true); try { await forceAdminUserPasswordChange(user.id); setMessage("Password change required on next login."); } catch (e) { setError(e instanceof Error ? e.message : "Unable to force password change."); } finally { setBusy(false); } }} className="acadlyx-button-secondary">Force password change</button>
              <button type="button" disabled={busy} onClick={async () => { if (!window.confirm("Revoke all active sessions for this user?")) return; setBusy(true); try { await revokeAdminUserSessions(user.id); setMessage("All active sessions revoked."); } catch (e) { setError(e instanceof Error ? e.message : "Unable to revoke sessions."); } finally { setBusy(false); } }} className="acadlyx-button-secondary">Revoke sessions</button>
              {user.authentication.lockedUntil ? <button type="button" disabled={busy} onClick={async () => { setBusy(true); try { await unlockAdminUser(user.id); setMessage("Account unlocked."); setUser(await getAdminUserLifecycle(user.id)); } catch (e) { setError(e instanceof Error ? e.message : "Unable to unlock account."); } finally { setBusy(false); } }} className="acadlyx-button-secondary">Unlock account</button> : null}
            </div>
              <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-800">Authentication secrets are intentionally never returned: no password, password hash, access token, refresh token, MFA secret, recovery code, API key, or session secret is exposed.</p>
            </Card>
            {user.deletedAt ? <Card title="Deletion & recovery"><dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Deleted at" value={date(user.deletedAt)}/><Field label="Recovery deadline" value={date(user.recoveryDeadline)}/>
              <Field label="Reason" value={user.deletionReason}/><Field label="Note" value={user.deletionNote}/>
            </dl></Card> : null}
          </div>
        ) : null}
      </main>
    </DashboardShell>
  );
}

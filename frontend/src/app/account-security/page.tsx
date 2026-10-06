"use client";

import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuthRequiredError, clearTokens } from "@/lib/auth";
import {
  beginMfaEnrollment,
  changePassword,
  confirmMfaEnrollment,
  disableMfa,
  getLoginActivity,
  getMfaStatus,
  getSecuritySessions,
  revokeOtherSecuritySessions,
  revokeSecuritySession,
  type LoginActivityEntry,
  type SecuritySession,
  type MfaStatus,
} from "@/lib/securityApi";

const MIN_PASSWORD_LENGTH = 10;
const MAX_PASSWORD_LENGTH = 200;

function Card({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="text-base font-black text-slate-950">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p><div className="mt-5">{children}</div></section>;
}
function fmt(value: string) { const d = new Date(value); return Number.isNaN(d.getTime()) ? "Unknown" : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(d); }
function checks(value: string) { return [{ label: "10+ characters", ok: value.length >= MIN_PASSWORD_LENGTH }, { label: "Lowercase", ok: /[a-z]/.test(value) }, { label: "Uppercase", ok: /[A-Z]/.test(value) }, { label: "Number", ok: /\d/.test(value) }]; }
function activityLabel(action: string) { const map: Record<string,string> = { "auth.login":"Successful sign-in", "auth.login_failed":"Failed sign-in", "auth.logout":"Signed out", "auth.password_changed":"Password changed", "auth.password_change_failed":"Password change failed", "auth.password_reset_completed":"Password reset completed", "auth.refresh_token_reuse_detected":"Session security event" }; return map[action] || action.replace(/^auth\./, "").replace(/_/g, " "); }

export default function AccountSecurityPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SecuritySession[]>([]);
  const [activity, setActivity] = useState<LoginActivityEntry[]>([]);
  const [mfa, setMfa] = useState<MfaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [sessionBusy, setSessionBusy] = useState("");
  const [sessionMessage, setSessionMessage] = useState("");
  const [mfaBusy, setMfaBusy] = useState(false);
  const [mfaError, setMfaError] = useState("");
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [disablePassword, setDisablePassword] = useState("");

  async function load() {
    setLoading(true); setLoadError("");
    try {
      const [s, a, m] = await Promise.all([getSecuritySessions(), getLoginActivity(), getMfaStatus()]);
      setSessions(s); setActivity(a); setMfa(m);
    } catch (error) {
      if (error instanceof AuthRequiredError) { router.replace("/login"); return; }
      setLoadError(error instanceof Error ? error.message : "Unable to load account security.");
    } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  const passwordChecks = useMemo(() => checks(newPassword), [newPassword]);
  const validPassword = passwordChecks.every((item) => item.ok) && newPassword.length <= MAX_PASSWORD_LENGTH;

  async function submitPassword(event: FormEvent) {
    event.preventDefault(); setPasswordError(""); setPasswordSuccess("");
    if (!currentPassword) return setPasswordError("Current password is required.");
    if (!newPassword) return setPasswordError("New password is required.");
    if (!validPassword) return setPasswordError("New password does not meet the password requirements.");
    if (newPassword !== confirmPassword) return setPasswordError("New password and confirmation do not match.");
    if (newPassword === currentPassword) return setPasswordError("New password must be different from your current password.");
    setPasswordBusy(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordSuccess("Password changed successfully. Please sign in again.");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      window.setTimeout(() => { clearTokens(); router.replace("/login"); }, 900);
    } catch (error) {
      if (error instanceof AuthRequiredError) { clearTokens(); router.replace("/login"); return; }
      setPasswordError(error instanceof Error ? error.message : "Unable to change password.");
    } finally { setPasswordBusy(false); }
  }

  async function revokeSession(id: string) {
    setSessionBusy(id); setSessionMessage("");
    try {
      const result = await revokeSecuritySession(id);
      if (result.current) { clearTokens(); router.replace("/login"); return; }
      setSessions((items) => items.filter((item) => item.id !== id));
      setSessionMessage("Session signed out.");
    } catch (error) { setSessionMessage(error instanceof Error ? error.message : "Unable to sign out session."); }
    finally { setSessionBusy(""); }
  }

  async function revokeOthers() {
    setSessionBusy("others"); setSessionMessage("");
    try { const result = await revokeOtherSecuritySessions(); setSessionMessage(result.revoked ? result.revoked + " other session(s) signed out." : "No other active sessions."); await load(); }
    catch (error) { setSessionMessage(error instanceof Error ? error.message : "Unable to sign out other sessions."); }
    finally { setSessionBusy(""); }
  }

  async function startMfa() {
    setMfaBusy(true); setMfaError("");
    try { setSetup(await beginMfaEnrollment()); } catch (error) { setMfaError(error instanceof Error ? error.message : "Unable to start 2FA setup."); }
    finally { setMfaBusy(false); }
  }

  async function confirmMfa(event: FormEvent) {
    event.preventDefault(); setMfaBusy(true); setMfaError("");
    try { const result = await confirmMfaEnrollment(mfaCode); setRecoveryCodes(result.recoveryCodes); setSetup(null); setMfaCode(""); setMfa(await getMfaStatus()); }
    catch (error) { setMfaError(error instanceof Error ? error.message : "Unable to enable 2FA."); }
    finally { setMfaBusy(false); }
  }

  async function turnOffMfa(event: FormEvent) {
    event.preventDefault(); setMfaBusy(true); setMfaError("");
    try { await disableMfa(disablePassword); setDisablePassword(""); setMfa(await getMfaStatus()); }
    catch (error) { setMfaError(error instanceof Error ? error.message : "Unable to disable 2FA."); }
    finally { setMfaBusy(false); }
  }

  return <DashboardShell title="Account Security" subtitle="Manage your password, sessions, and account security.">
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Personal security</p><h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Account Security</h1><p className="mt-1 text-sm text-slate-600">Only your authenticated account is managed here. Role, department, campus, and institution permissions do not grant access to another user&apos;s security data.</p></div>
      {loadError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{loadError}</div>}

      <Card title="Password" description="Change the password for your own account.">
        <form onSubmit={submitPassword} className="max-w-2xl space-y-4">
          {[["Current password", currentPassword, setCurrentPassword],["New password", newPassword, setNewPassword],["Confirm new password", confirmPassword, setConfirmPassword]].map(([label,value,setter], index) =>
            <label key={String(label)} className="block"><span className="mb-1.5 block text-sm font-bold text-slate-700">{label}</span><div className="relative"><input required type={showPasswords ? "text" : "password"} value={String(value)} onChange={(e) => (setter as React.Dispatch<React.SetStateAction<string>>)(e.target.value)} autoComplete={index === 0 ? "current-password" : "new-password"} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 pr-16 text-sm text-slate-950 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"/><button type="button" onClick={() => setShowPasswords((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100">{showPasswords ? "Hide" : "Show"}</button></div></label>
          )}
          {newPassword && <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="grid grid-cols-4 gap-1">{passwordChecks.map((item) => <span key={item.label} className={item.ok ? "h-1.5 rounded-full bg-emerald-500" : "h-1.5 rounded-full bg-slate-200"} />)}</div><ul className="mt-3 grid gap-1 text-xs text-slate-600 sm:grid-cols-2">{passwordChecks.map((item) => <li key={item.label} className={item.ok ? "text-emerald-700" : ""}>{item.ok ? "✓" : "○"} {item.label}</li>)}</ul></div>}
          {passwordError && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{passwordError}</p>}
          {passwordSuccess && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{passwordSuccess}</p>}
          <button disabled={passwordBusy} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50">{passwordBusy ? "Changing password…" : "Change password"}</button>
        </form>
      </Card>

      <Card title="Active Sessions" description="Review active refresh-token sessions. Raw tokens are never exposed.">
        {loading ? <div className="h-24 animate-pulse rounded-xl bg-slate-100"/> : sessions.length === 0 ? <p className="text-sm text-slate-500">No active sessions found.</p> : <div className="space-y-3">{sessions.map((s) => <div key={s.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="font-bold text-slate-900">{s.browser} · {s.os}</p>{s.current && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800">Current session</span>}</div><p className="mt-1 text-xs text-slate-500">{s.device}{s.ipAddress ? " · " + s.ipAddress : ""}</p><p className="mt-1 text-xs text-slate-500">Last active {fmt(s.lastActiveAt)} · Expires {fmt(s.expiresAt)}</p></div><button disabled={!!sessionBusy} onClick={() => void revokeSession(s.id)} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-black text-slate-700 disabled:opacity-50">{sessionBusy === s.id ? "Signing out…" : "Sign out"}</button></div>)}<div className="flex flex-wrap items-center gap-3 pt-2"><button disabled={!!sessionBusy} onClick={() => void revokeOthers()} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700 disabled:opacity-50">{sessionBusy === "others" ? "Signing out…" : "Sign out other sessions"}</button>{sessionMessage && <span role="status" className="text-xs font-semibold text-slate-600">{sessionMessage}</span>}</div></div>}
      </Card>

      <Card title="Login Activity" description="Recent authentication events for your account.">
        {loading ? <div className="h-24 animate-pulse rounded-xl bg-slate-100"/> : activity.length === 0 ? <p className="text-sm text-slate-500">No recent activity is available.</p> : <div className="overflow-x-auto"><div className="min-w-[680px] divide-y divide-slate-100">{activity.map((a) => <div key={a.id} className="grid grid-cols-[1.5fr_1fr_1fr] gap-4 py-3 text-sm"><div><p className="font-bold text-slate-800">{activityLabel(a.action)}</p><p className="text-xs text-slate-500">{fmt(a.createdAt)}</p></div><div className="text-slate-600">{a.browser} · {a.os}</div><div className="text-slate-500">{a.ipAddress || "IP not recorded"}</div></div>)}</div></div>}
      </Card>

      <Card title="Account Recovery" description="Use the existing password-recovery mechanism if you lose access to your password.">
        <div className="flex flex-col gap-3 rounded-xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold text-slate-800">Password reset</p><p className="mt-1 text-sm text-slate-500">Recovery requests do not reveal whether an account exists.</p></div><a href="/forgot-password" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-center text-xs font-black text-slate-700">Open recovery</a></div>
      </Card>

      {mfa && <Card title="Two-Factor Authentication" description="ACADLYX already has TOTP-based MFA infrastructure, so this section uses the existing implementation.">
        {recoveryCodes.length > 0 ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="font-black text-amber-900">Save your recovery codes</p><p className="mt-1 text-sm text-amber-800">They are shown only once.</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{recoveryCodes.map((code) => <code key={code} className="rounded-lg bg-white px-3 py-2 font-bold">{code}</code>)}</div><button type="button" onClick={() => setRecoveryCodes([])} className="mt-4 rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white">I saved them</button></div> : setup ? <form onSubmit={confirmMfa} className="space-y-4"><p className="text-sm text-slate-600">Add ACADLYX to your authenticator app using the setup key below, then enter the six-digit code.</p><code className="block break-all rounded-xl bg-slate-50 p-4 text-sm font-black tracking-wider text-slate-900">{setup.secret}</code><details><summary className="cursor-pointer text-xs font-bold text-slate-600">Show setup URI</summary><code className="mt-2 block break-all rounded-xl bg-slate-50 p-3 text-[10px] text-slate-600">{setup.otpauthUrl}</code></details><input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} placeholder="123456" className="w-full max-w-xs rounded-xl border border-slate-300 px-3 py-2.5 font-mono text-lg tracking-[0.3em]"/><div className="flex gap-2"><button disabled={mfaBusy} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50">{mfaBusy ? "Verifying…" : "Enable 2FA"}</button><button type="button" onClick={() => setSetup(null)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold">Cancel</button></div></form> : mfa.mfaEnabled ? <div className="space-y-4"><div className="rounded-xl bg-emerald-50 p-4"><p className="font-bold text-emerald-900">2FA is enabled</p><p className="text-xs text-emerald-800">{mfa.recoveryCodesRemaining} recovery code(s) remaining.</p></div><form onSubmit={turnOffMfa} className="flex flex-col gap-2 sm:flex-row sm:items-end"><label className="flex-1"><span className="mb-1 block text-xs font-bold text-slate-600">Confirm password to disable</span><input required type="password" value={disablePassword} onChange={(e) => setDisablePassword(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"/></label><button disabled={mfaBusy} className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-black text-red-700 disabled:opacity-50">Disable 2FA</button></form>{mfaError && <p role="alert" className="text-sm font-semibold text-red-700">{mfaError}</p>}</div> : <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold text-slate-800">2FA is not enabled</p><p className="text-sm text-slate-500">Protect sign-in with an authenticator app.</p></div><button type="button" disabled={mfaBusy} onClick={() => void startMfa()} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50">{mfaBusy ? "Starting…" : "Set up 2FA"}</button></div>}
        {mfaError && !mfa.mfaEnabled && !setup && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{mfaError}</p>}
      </Card>}
    </div>
  </DashboardShell>;
}

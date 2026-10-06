"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { resetPassword } from "@/lib/securityApi";

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [token, setToken] = useState(params.get("token") ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!token.trim()) {
      setError("Reset token is required.");
      return;
    }
    if (password.length < 10 || password.length > 200 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
      setError("Password must be 10–200 characters and include a lowercase letter, uppercase letter, and digit.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await resetPassword(token.trim(), password);
      setDone(true);
      window.setTimeout(() => router.replace("/login"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Choose a new password</h1>
        {done ? (
          <p role="status" className="mt-6 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Password updated. All other sessions have been signed out. Taking you to sign in…
          </p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            {!params.get("token") && (
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-600">Reset token</span>
                <input required value={token} onChange={(event) => setToken(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs" />
              </label>
            )}
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">New password</span>
              <div className="relative">
                <input required type={showPasswords ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 pr-16" autoComplete="new-password" aria-describedby="reset-password-policy" />
                <button type="button" onClick={() => setShowPasswords((value) => !value)} aria-label={showPasswords ? "Hide password" : "Show password"} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100">{showPasswords ? "Hide" : "Show"}</button>
              </div>
              <span id="reset-password-policy" className="mt-1 block text-xs text-slate-500">10–200 characters, with uppercase, lowercase, and a digit.</span>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">Confirm password</span>
              <div className="relative">
                <input required type={showPasswords ? "text" : "password"} value={confirm} onChange={(event) => setConfirm(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 pr-16" autoComplete="new-password" />
                <button type="button" onClick={() => setShowPasswords((value) => !value)} aria-label={showPasswords ? "Hide password" : "Show password"} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100">{showPasswords ? "Hide" : "Show"}</button>
              </div>
            </label>
            {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
            <button type="submit" disabled={busy} className="w-full rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">{busy ? "Updating…" : "Update password"}</button>
          </form>
        )}
        <Link href="/login" className="mt-6 block text-center text-sm font-semibold text-slate-600">Back to sign in</Link>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return <Suspense fallback={<main className="grid min-h-screen place-items-center bg-slate-50 text-sm text-slate-500">Loading…</main>}><ResetPasswordForm /></Suspense>;
}

"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { resetPassword } from "@/lib/securityApi";

/**
 * Completes a password reset. On success the backend also revokes every
 * existing session for the account, so a stolen session cannot outlive
 * the password change.
 */
function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [token, setToken] = useState(params.get("token") ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setError("The two passwords do not match");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await resetPassword(token.trim(), password);
      setDone(true);
      setTimeout(() => router.replace("/login"), 2000);
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
          <p className="mt-6 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Password updated. All other sessions have been signed out. Taking
            you to sign in…
          </p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            {!params.get("token") && (
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-600">
                  Reset token
                </span>
                <input
                  required
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs"
                />
              </label>
            )}
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">
                New password
              </span>
              <input
                required
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
              />
              <span className="mt-1 block text-xs text-slate-500">
                At least 10 characters, with upper case, lower case and a digit.
              </span>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">
                Confirm password
              </span>
              <input
                required
                type="password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>
            {error && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
            >
              {busy ? "Updating…" : "Update password"}
            </button>
          </form>
        )}

        <Link
          href="/login"
          className="mt-6 block text-center text-sm font-semibold text-slate-600"
        >
          Back to sign in
        </Link>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}

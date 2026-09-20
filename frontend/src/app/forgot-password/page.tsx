"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

import { requestPasswordReset } from "@/lib/securityApi";

/**
 * Password reset request.
 *
 * The response is identical whether or not the address exists, so this
 * page cannot be used to discover who holds an account. When the server
 * has no mailer configured it returns the token directly, which the UI
 * surfaces so a self-hosted institution can still complete the flow.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    message: string;
    expiresInMinutes: number;
    resetToken?: string;
  } | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      setResult(await requestPasswordReset(email.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Reset your password</h1>
        <p className="mt-2 text-sm text-slate-600">
          Enter the email address on your account and we will send a reset link.
        </p>

        {result ? (
          <div className="mt-6 space-y-4">
            <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {result.message} The link is valid for {result.expiresInMinutes}{" "}
              minutes.
            </p>
            {result.resetToken && (
              <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <p className="font-semibold">No mailer is configured</p>
                <p className="mt-1 break-all font-mono text-xs">
                  {result.resetToken}
                </p>
                <Link
                  href={`/reset-password?token=${result.resetToken}`}
                  className="mt-2 inline-block font-semibold underline"
                >
                  Continue to reset →
                </Link>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">
                Email
              </span>
              <input
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
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
              {busy ? "Sending…" : "Send reset link"}
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

"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuthRequiredError } from "@/lib/auth";
import {
  MfaStatus,
  beginMfaEnrollment,
  confirmMfaEnrollment,
  disableMfa,
  getMfaStatus,
  revokeAllSessions,
} from "@/lib/securityApi";

/**
 * Account security.
 *
 * Enrolment is two-step on purpose: the secret is stored first, but the
 * factor only becomes required once the user proves they can generate a
 * code from it — so a mis-scanned QR can never lock anyone out. The
 * recovery codes are shown exactly once.
 */
export default function AccountSecurityPage() {
  const router = useRouter();
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [enrollment, setEnrollment] = useState<{
    secret: string;
    otpauthUrl: string;
  } | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const run = useCallback(
    async (fn: () => Promise<void>) => {
      setBusy(true);
      setError("");
      setNotice("");
      try {
        await fn();
      } catch (err) {
        if (err instanceof AuthRequiredError) {
          router.replace("/login");
          return;
        }
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setBusy(false);
      }
    },
    [router]
  );

  useEffect(() => {
    void run(async () => setStatus(await getMfaStatus()));
  }, [run]);

  return (
    <DashboardShell
      title="Account security"
      subtitle="Two-factor authentication and active sessions"
    >
      <div className="mx-auto max-w-3xl space-y-6">
        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}
        {notice && (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {notice}
          </p>
        )}

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">
            Two-factor authentication
          </h2>

          {status?.mfaEnabled ? (
            <>
              <p className="mt-2 text-sm text-slate-600">
                Enabled
                {status.mfaEnrolledAt
                  ? ` on ${new Date(status.mfaEnrolledAt).toLocaleDateString()}`
                  : ""}
                . {status.recoveryCodesRemaining} unused recovery code(s)
                remaining.
              </p>
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-slate-600">
                    Confirm your password to disable
                  </span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-64 rounded-xl border border-slate-200 px-3 py-2"
                  />
                </label>
                <button
                  type="button"
                  disabled={busy || password.length === 0}
                  onClick={() =>
                    run(async () => {
                      await disableMfa(password);
                      setPassword("");
                      setStatus(await getMfaStatus());
                      setNotice("Two-factor authentication disabled");
                    })
                  }
                  className="rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-40"
                >
                  Disable
                </button>
              </div>
            </>
          ) : enrollment ? (
            <>
              <p className="mt-2 text-sm text-slate-600">
                Add this account to your authenticator app, then enter the
                six-digit code it shows.
              </p>
              <p className="mt-3 break-all rounded-xl bg-slate-50 px-4 py-3 font-mono text-sm">
                {enrollment.secret}
              </p>
              <p className="mt-2 break-all text-xs text-slate-400">
                {enrollment.otpauthUrl}
              </p>
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-slate-600">
                    Code from the app
                  </span>
                  <input
                    value={code}
                    inputMode="numeric"
                    onChange={(event) => setCode(event.target.value)}
                    placeholder="123456"
                    className="w-40 rounded-xl border border-slate-200 px-3 py-2 tracking-widest"
                  />
                </label>
                <button
                  type="button"
                  disabled={busy || code.trim().length !== 6}
                  onClick={() =>
                    run(async () => {
                      const result = await confirmMfaEnrollment(code.trim());
                      setRecoveryCodes(result.recoveryCodes);
                      setEnrollment(null);
                      setCode("");
                      setStatus(await getMfaStatus());
                      setNotice("Two-factor authentication enabled");
                    })
                  }
                  className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
                >
                  Confirm
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-slate-600">
                Not enabled. Adding a second factor protects the account even
                if the password is stolen.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  run(async () => setEnrollment(await beginMfaEnrollment()))
                }
                className="mt-4 rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
              >
                Set up authenticator
              </button>
            </>
          )}
        </section>

        {recoveryCodes && (
          <section className="rounded-3xl border border-amber-300 bg-amber-50 p-6">
            <h2 className="text-lg font-bold text-slate-900">
              Save your recovery codes
            </h2>
            <p className="mt-1 text-sm text-slate-700">
              These are shown once and never again. Each works a single time if
              you lose your authenticator.
            </p>
            <ul className="mt-4 grid grid-cols-2 gap-2 font-mono text-sm sm:grid-cols-5">
              {recoveryCodes.map((recoveryCode) => (
                <li
                  key={recoveryCode}
                  className="rounded-lg bg-white px-3 py-2 text-center"
                >
                  {recoveryCode}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setRecoveryCodes(null)}
              className="mt-4 text-sm font-semibold text-slate-700"
            >
              I have saved them
            </button>
          </section>
        )}

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Active sessions</h2>
          <p className="mt-2 text-sm text-slate-600">
            Signing out everywhere revokes every refresh token on this account,
            including the one this browser is using.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const result = await revokeAllSessions();
                setNotice(
                  `Revoked ${result.revoked} session(s). Sign in again to continue.`
                );
                setTimeout(() => router.replace("/login"), 1500);
              })
            }
            className="mt-4 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
          >
            Sign out everywhere
          </button>
        </section>
      </div>
    </DashboardShell>
  );
}

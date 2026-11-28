"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { completeMfaLogin, login } from "@/lib/auth";
import { workspaceHome } from "@/lib/navigation";

type LoginStep = "credentials" | "mfa";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<LoginStep>("credentials");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [challengeToken, setChallengeToken] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleCredentialsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const result = await login(identifier.trim(), password);

      if (result.mfaRequired) {
        setChallengeToken(result.challengeToken);
        setStep("mfa");
        return;
      }

      router.replace(workspaceHome(result.user.roles));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMfaSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const code = mfaCode.trim();
    if (!challengeToken) {
      setError("Your verification session is missing. Please sign in again.");
      setStep("credentials");
      return;
    }

    if (code.length < 6 || code.length > 20) {
      setError("Enter the verification code from your authenticator.");
      return;
    }

    setSubmitting(true);
    try {
      const user = await completeMfaLogin(challengeToken, code);
      router.replace(workspaceHome(user.roles));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function returnToCredentials() {
    setStep("credentials");
    setChallengeToken("");
    setMfaCode("");
    setError("");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f8f6] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-7 text-center">
          <Link href="/" aria-label="ACADLYX home" className="inline-flex items-center justify-center">
            <Image
              src="/branding/acadlyx-logo.png"
              alt="ACADLYX"
              width={52}
              height={52}
              priority
              className="h-12 w-12 object-contain"
            />
          </Link>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">
            {step === "credentials" ? "Sign in to ACADLYX" : "Verify your identity"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {step === "credentials"
              ? "Access your institution's workspace."
              : "Enter the verification code from your authenticator app."}
          </p>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {step === "credentials" ? (
            <form onSubmit={handleCredentialsSubmit} className="space-y-5">
              <label className="block text-sm font-medium text-slate-700">
                Email or user ID
                <input
                  name="identifier"
                  type="text"
                  autoComplete="username"
                  required
                  autoFocus
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  placeholder="Enter your email or user ID"
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#126243] focus:ring-2 focus:ring-[#d9eae1]"
                />
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Password
                <div className="relative mt-2">
                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 pr-16 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#126243] focus:ring-2 focus:ring-[#d9eae1]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </label>

              <div className="flex justify-end">
                <Link href="/forgot-password" className="text-sm font-semibold text-[#126243] hover:underline">
                  Forgot password?
                </Link>
              </div>

              {error ? (
                <p role="alert" aria-live="polite" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-[#126243] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0a4a32] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Signing in…" : "Sign in"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleMfaSubmit} className="space-y-5">
              <label className="block text-sm font-medium text-slate-700">
                Verification code
                <input
                  name="mfaCode"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  required
                  value={mfaCode}
                  onChange={(event) => setMfaCode(event.target.value.replace(/\s/g, ""))}
                  placeholder="Enter your verification code"
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-base tracking-widest text-slate-950 outline-none transition placeholder:tracking-normal placeholder:text-slate-400 focus:border-[#126243] focus:ring-2 focus:ring-[#d9eae1]"
                />
              </label>

              {error ? (
                <p role="alert" aria-live="polite" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-[#126243] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0a4a32] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Verifying…" : "Verify and continue"}
              </button>

              <button
                type="button"
                onClick={returnToCredentials}
                disabled={submitting}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                Back to sign in
              </button>
            </form>
          )}
        </section>

        <p className="mt-6 text-center text-sm text-slate-600">
          Your workspace is selected according to your assigned ACADLYX role.
        </p>
        <p className="mt-4 text-center text-sm">
          <Link href="/" className="font-semibold text-[#126243] hover:underline">
            Back to website
          </Link>
        </p>
      </div>
    </main>
  );
}

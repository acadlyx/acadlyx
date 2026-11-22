"use client";

import Image from "next/image";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { completeMfaLogin, login } from "@/lib/auth";
import { workspaceHome } from "@/lib/navigation";
import Link from "next/link";

export function InlineLogin() {
  const router = useRouter();
  const identifierRef = useRef<HTMLInputElement>(null);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [mfa, setMfa] = useState("");
  const [challenge, setChallenge] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!challenge) identifierRef.current?.focus();
  }, [challenge]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      if (challenge) {
        const user = await completeMfaLogin(challenge, mfa.trim());
        router.replace(workspaceHome(user.roles));
        return;
      }
      const result = await login(identifier.trim(), password);
      if (result.mfaRequired) {
        setChallenge(result.challengeToken);
        return;
      }
      router.replace(workspaceHome(result.user.roles));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="public-login-card">
      <div className="public-login-card-heading">
        <Image src="/branding/acadlyx-logo.png" alt="" width={42} height={42} className="public-login-logo" />
        <div>
          <p className="public-login-kicker">Institutional access</p>
          <h2>{challenge ? "Verify your sign-in" : "Sign in to ACADLYX"}</h2>
        </div>
      </div>

      <p className="public-login-description">
        {challenge
          ? "Enter the verification code from your authenticator."
          : "Use your ID number, email or roll number with your password."}
      </p>

      <form onSubmit={submit} className="public-login-form">
        {challenge ? (
          <label className="public-form-field">
            <span>Verification code</span>
            <input value={mfa} onChange={(event) => setMfa(event.target.value)} inputMode="numeric" autoComplete="one-time-code" placeholder="Enter verification code" required autoFocus className="public-form-input" />
          </label>
        ) : (
          <>
            <label className="public-form-field">
              <span>ID number, email or roll number</span>
              <input ref={identifierRef} value={identifier} onChange={(event) => setIdentifier(event.target.value)} autoComplete="username" required className="public-form-input" />
            </label>
            <label className="public-form-field">
              <span>Password</span>
              <span className="public-password-control">
                <input value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? "text" : "password"} autoComplete="current-password" required className="public-form-input" />
                <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} className="public-password-toggle">
                  {showPassword ? "Hide" : "Show"}
                </button>
              </span>
              <Link href="/forgot-password" className="public-forgot-password">Forgot password?</Link>
            </label>
          </>
        )}

        {error ? <div role="alert" className="public-login-error">{error}</div> : null}

        <button type="submit" disabled={busy} aria-busy={busy} className="public-primary-action public-login-submit">
          {busy ? "Signing in…" : challenge ? "Verify and continue" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

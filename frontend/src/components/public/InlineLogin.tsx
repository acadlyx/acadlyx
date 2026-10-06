"use client";

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
    <div className="flex min-h-[616px] h-full flex-col rounded-[25px] bg-white p-5 text-slate-950 sm:min-h-[672px] sm:p-8 lg:min-h-[712px]">
      <div className="flex w-full flex-1 flex-col justify-center">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-950 text-sm font-black text-white">A</div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">Secure access</p>
            <h2 className="mt-1 text-xl font-black sm:text-2xl">{challenge ? "Verify your sign-in" : "Sign in to ACADLYX"}</h2>
          </div>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-500">{challenge ? "Enter the verification code from your authenticator." : "Use your ID number, email or roll number with your password."}</p>
        <form onSubmit={submit} className="mt-5 space-y-3.5 sm:mt-6 sm:space-y-4">
          {challenge ? (
            <input value={mfa} onChange={(event) => setMfa(event.target.value)} inputMode="numeric" autoComplete="one-time-code" placeholder="Verification code" required autoFocus className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
          ) : (
            <>
              <label className="block"><span className="text-xs font-black text-slate-600">ID number / email / roll number</span><input ref={identifierRef} value={identifier} onChange={(event) => setIdentifier(event.target.value)} autoComplete="username" required className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
              <label className="block"><span className="text-xs font-black text-slate-600">Password</span><div className="relative mt-1.5"><input value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? "text" : "password"} autoComplete="current-password" required className="w-full rounded-xl border border-slate-300 px-4 py-3 pr-16 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100">{showPassword ? "Hide" : "Show"}</button></div><Link href="/forgot-password" className="mt-2 inline-flex text-xs font-bold text-blue-700 hover:underline">Forgot password?</Link></label>
            </>
          )}
          {error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
          <button type="submit" disabled={busy} className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60">{busy ? "Signing in…" : challenge ? "Verify and continue" : "Sign in"}</button>
        </form>
      </div>
    </div>
  );
}

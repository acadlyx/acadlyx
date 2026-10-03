"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { completeMfaLogin, login } from "@/lib/auth";
import { workspaceHome } from "@/lib/navigation";

export function InlineLogin({ onClose }: { onClose?: () => void }) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [mfa, setMfa] = useState("");
  const [challenge, setChallenge] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
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
    <section id="login" className="border-y border-slate-900/10 bg-slate-950 px-5 py-16 text-white sm:px-8">
      <div className="mx-auto max-w-xl">
        <div className="rounded-[30px] border border-white/10 bg-white p-6 text-slate-950 shadow-2xl sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">Secure access</p><h2 className="mt-2 text-2xl font-black">{challenge ? "Verify your sign-in" : "Sign in to ACADLYX"}</h2></div>
            {onClose ? <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black">Close</button> : null}
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-500">{challenge ? "Enter the verification code from your authenticator." : "Use your ID number, email or roll number with your password."}</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            {challenge ? <input value={mfa} onChange={(e) => setMfa(e.target.value)} inputMode="numeric" autoComplete="one-time-code" placeholder="Verification code" required className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500" /> : <>
              <label className="block"><span className="text-xs font-black text-slate-600">ID number / email / roll number</span><input value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" required className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500" /></label>
              <label className="block"><span className="text-xs font-black text-slate-600">Password</span><input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" required className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500" /></label>
            </>}
            {error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
            <button disabled={busy} className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:opacity-50">{busy ? "Signing in…" : challenge ? "Verify and continue" : "Sign in"}</button>
          </form>
        </div>
      </div>
    </section>
  );
}

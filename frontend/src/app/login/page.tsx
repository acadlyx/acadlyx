"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { completeMfaLogin, login } from "@/lib/auth";
import { apiUrl } from "@/lib/api";

function getDashboardRoute(roles: string[]): string {
  // Platform administrator gets the platform dashboard.
  if (roles.includes("SUPER_ADMIN")) {
    return "/superadmin";
  }

  // Institution administrator gets the actual ERP administration area.
  if (roles.includes("INSTITUTION_ADMIN")) {
    return "/admin";
  }

  // Executive institutional roles.
  if (roles.includes("DIRECTOR")) {
    return "/director";
  }

  if (roles.includes("MANAGEMENT")) {
    return "/management";
  }

  if (roles.includes("HOD")) {
    return "/hod";
  }

  // Faculty workspace.
  if (roles.includes("FACULTY")) {
    return "/faculty";
  }

  // Parent workspace.
  if (roles.includes("PARENT")) {
    return "/parent";
  }

  // Staff workspace.
  if (roles.includes("STAFF")) {
    return "/staff";
  }

  if (roles.includes("CMS")) {
    return "/site-content";
  }

  if (roles.includes("STUDENT")) {
    return "/student";
  }

  return "/login";
}

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [institutions, setInstitutions] = useState<{id:string;name:string;adminOfficeEmail:string|null}[]>([]);
  const [institutionId, setInstitutionId] = useState("");
  // Set once the password is accepted but a second factor is required.
  const [mfaChallenge, setMfaChallenge] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");

  useEffect(() => { if (forgotOpen && !institutions.length) fetch(apiUrl("/auth/recovery-institutions")).then(r=>r.json()).then(b=>setInstitutions(b.data || [])).catch(()=>setInstitutions([])); }, [forgotOpen, institutions.length]);
  const selectedInstitution = institutions.find((institution) => institution.id === institutionId);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError(null);
    setSubmitting(true);

    try {
      const result = await login(email.trim(), password);

      if (result.mfaRequired) {
        // No tokens were issued; ask for the authenticator code.
        setMfaChallenge(result.challengeToken);
        setMfaCode("");
        return;
      }

      router.replace(getDashboardRoute(result.user.roles));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to sign in. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMfaSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!mfaChallenge) return;

    setError(null);
    setSubmitting(true);

    try {
      const user = await completeMfaLogin(mfaChallenge, mfaCode.trim());
      router.replace(getDashboardRoute(user.roles));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Verification failed. Try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (mfaChallenge) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#07111f] px-4 py-10">
        <div className="w-full max-w-md">
          <form
            onSubmit={handleMfaSubmit}
            className="rounded-3xl border border-white/15 bg-white p-6 shadow-2xl shadow-slate-950/40"
          >
            <h2 className="text-lg font-semibold text-slate-950">
              Two-factor verification
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Enter the 6-digit code from your authenticator app, or one of
              your recovery codes.
            </p>

            {error && (
              <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            )}

            <label className="mt-5 block text-sm">
              <span className="mb-1 block font-medium text-slate-600">
                Verification code
              </span>
              <input
                value={mfaCode}
                onChange={(event) => setMfaCode(event.target.value)}
                inputMode="text"
                autoComplete="one-time-code"
                autoFocus
                placeholder="123456"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 tracking-widest"
              />
            </label>

            <button
              type="submit"
              disabled={submitting || mfaCode.trim().length < 6}
              className="mt-5 w-full rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"
            >
              {submitting ? "Verifying…" : "Verify and sign in"}
            </button>

            <button
              type="button"
              onClick={() => {
                setMfaChallenge(null);
                setMfaCode("");
                setError(null);
              }}
              className="mt-3 w-full rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600"
            >
              Back to sign in
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#07111f] px-4 py-10">
      <div className="absolute -left-24 top-0 h-80 w-80 rounded-full bg-cyan-400/20 blur-3xl" /><div className="absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3">
            <Image src="/branding/acadlyx-logo.png" alt="ACADLYX" width={48} height={48} className="h-12 w-12 rounded-xl object-contain" priority />
          </div>

          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">Welcome to ACADLYX</h1>

          <p className="mt-1 text-sm text-slate-300">
            Education ERP & Institutional Intelligence
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="relative rounded-3xl border border-white/15 bg-white p-6 shadow-2xl shadow-slate-950/40"
        >
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-950">
              Sign in
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Access your ACADLYX workspace.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Email
              </label>

              <div className="relative"><input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Password
              </label>

              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 pr-24 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                placeholder="Enter your password"
              /><button type="button" onClick={()=>setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100">{showPassword ? "Hide" : "Show"}</button></div>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            <div className="flex justify-end"><button type="button" onClick={()=>setForgotOpen(true)} className="text-xs font-semibold text-cyan-700 hover:underline">Forgot password?</button></div><button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </div>
        </form>

        <div className="mt-5 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-center backdrop-blur">
          <p className="text-xs leading-5 text-slate-300">
            Your dashboard is selected automatically according to your
            assigned ACADLYX role.
          </p>
        </div>
      </div>{forgotOpen&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4"><section className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"><div className="flex justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-cyan-700">Password recovery</p><h2 className="mt-1 text-xl font-semibold">Contact your institution administrator</h2></div><button onClick={()=>setForgotOpen(false)} className="text-sm text-slate-500">Close</button></div><p className="mt-3 text-sm leading-6 text-slate-500">Select your institution to find its configured admin-office recovery contact. ACADLYX never reveals or resets passwords from this page.</p><select value={institutionId} onChange={e=>setInstitutionId(e.target.value)} className="mt-5 w-full rounded-xl border border-slate-300 p-3 text-sm"><option value="">Select institution</option>{institutions.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select>{selectedInstitution&&<div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm"><p className="font-semibold text-slate-900">{selectedInstitution.name}</p><p className="mt-1 text-slate-600">{selectedInstitution.adminOfficeEmail ? <>Email the admin office: <a className="font-semibold text-cyan-700 underline" href={`mailto:${selectedInstitution.adminOfficeEmail}`}>{selectedInstitution.adminOfficeEmail}</a></> : "Contact your institution administrator directly; no recovery email is configured."}</p></div>}</section></div>}
    </main>
  );
}

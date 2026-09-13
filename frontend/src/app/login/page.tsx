"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { login } from "@/lib/auth";

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

  // Default student workspace.
  return "/student";
}

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("student@aimt.acadlyx.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError(null);
    setSubmitting(true);

    try {
      const user = await login(email.trim(), password);

      const destination = getDashboardRoute(user.roles);

      router.replace(destination);
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

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-lg font-bold text-white shadow-sm">
            A
          </div>

          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">
            ACADLYX
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Education ERP & Institutional Intelligence
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
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

              <input
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
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                placeholder="Enter your password"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </div>
        </form>

        <div className="mt-5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-center">
          <p className="text-xs leading-5 text-slate-500">
            Your dashboard is selected automatically according to your
            assigned ACADLYX role.
          </p>
        </div>
      </div>
    </main>
  );
}

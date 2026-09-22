"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import {
  AuthRequiredError,
  AuthUser,
  getCachedCurrentUser,
  getCurrentUser,
} from "@/lib/auth";
import { canUseClubWorkspace } from "@/lib/authority";

export default function ClubPresidentPage() {
  const [user, setUser] = useState<AuthUser | null>(getCachedCurrentUser());
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    getCurrentUser({ background: true })
      .then((current) => {
        if (mounted) setUser(current);
      })
      .catch((err) => {
        if (!mounted) return;
        if (err instanceof AuthRequiredError) {
          window.location.href = "/login";
          return;
        }
        setError(err instanceof Error ? err.message : "Unable to load club workspace");
      });

    return () => {
      mounted = false;
    };
  }, []);

  const allowed = canUseClubWorkspace(user);

  return (
    <DashboardShell
      title="Club President Workspace"
      subtitle="Student club responsibility within the assigned club scope"
      allowedRoles={["CLUB_PRESIDENT"]}
    >
      <div className="space-y-6">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 px-6 py-8 text-white sm:px-8">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-300">
              Student club workspace
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
              Club President
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              This workspace is reserved for the single Club President responsibility.
              Club authority is separate from academic, finance, HR, admissions and institutional administration.
            </p>
          </div>

          <div className="grid gap-4 p-6 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                Authority boundary
              </p>
              <h2 className="mt-2 font-bold text-slate-900">Assigned club only</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Club permissions are scoped to the club responsibility and do not provide institution-wide student-management access.
              </p>
            </div>

            <Link
              href="/calendar"
              className="rounded-2xl border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-md"
            >
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                Available workspace tool
              </p>
              <h2 className="mt-2 font-bold text-slate-900">Club calendar</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Open the calendar using the permissions assigned to this responsibility.
              </p>
            </Link>
          </div>
        </section>

        {!allowed ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            This account is not currently authorized for the Club President workspace.
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
      </div>
    </DashboardShell>
  );
}

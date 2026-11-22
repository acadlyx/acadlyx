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
        <section className="border-b border-slate-200 pb-6">
          <div className="border-l-4 border-[#b38a59] bg-[#1b3027] px-6 py-7 text-white sm:px-8">
            
            <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
              Club President
            </h1>
            
          </div>

          <div className="grid gap-4 p-6 sm:grid-cols-2">
            <div className="border-b border-slate-200 bg-transparent py-5">
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
              className="border-b border-slate-200 py-5 transition-colors hover:bg-[#f6f1e8]"
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
        <div role="note" className="my-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">This workspace is reserved for the single Club President responsibility.
              Club authority is separate from academic, finance, HR, admissions and institutional administration.</div>

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

"use client";

import Link from "next/link";
import { useMemo } from "react";

import type { AuthUser } from "@/lib/auth";
import { hasAnyPermission } from "@/lib/authorization";

type Props = {
  user: AuthUser | null;
};

/**
 * Restores the dashboard-level Import / Export controls without exposing
 * import authority to users who do not have the server-side permission.
 *
 * The actual import/export endpoint remains protected by backend RBAC.
 * These buttons are only a navigation convenience.
 */
export function DashboardDataTransferActions({ user }: Props) {
  const canImport = useMemo(
    () => Boolean(user && hasAnyPermission(user, ["imports.manage"])),
    [user],
  );

  const canExport = useMemo(
    () => Boolean(user && hasAnyPermission(user, ["reports.read", "imports.manage"])),
    [user],
  );

  if (!canImport && !canExport) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
            Data tools
          </p>
          <p className="mt-1 text-sm font-bold text-slate-900">
            Import and export institutional data
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Open the controlled data center for spreadsheet imports and live-data exports.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {canImport ? (
            <Link
              href="/imports"
              className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800"
            >
              Import Data
            </Link>
          ) : null}

          {canExport ? (
            <Link
              href="/imports"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
            >
              Export Data
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default DashboardDataTransferActions;

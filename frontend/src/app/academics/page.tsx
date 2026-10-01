"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuthRequiredError } from "@/lib/auth";
import {
  ErpOffering,
  listAcademicYears,
  listDepartments,
  listOfferings,
  listPrograms,
} from "@/lib/erpApi";

type ViewState = "loading" | "ready" | "error";

interface Structure {
  departments: Array<{ id: string; name: string; code?: string }>;
  programs: Array<{ id: string; name: string; code?: string }>;
  academicYears: Array<{ id: string; name: string; isCurrent?: boolean }>;
  offerings: ErpOffering[];
}

export default function AcademicsPage() {
  const router = useRouter();

  const [state, setState] = useState<ViewState>("loading");
  const [structure, setStructure] = useState<Structure>({
    departments: [],
    programs: [],
    academicYears: [],
    offerings: [],
  });
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setState("loading");
    setError("");

    try {
      const [departments, programs, academicYears, offerings] =
        await Promise.all([
          listDepartments(),
          listPrograms(),
          listAcademicYears(),
          listOfferings(),
        ]);

      setStructure({
        departments,
        programs,
        academicYears,
        offerings,
      });
      setState("ready");
    } catch (err) {
      if (err instanceof AuthRequiredError) {
        router.replace("/login");
        return;
      }

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load the academic structure."
      );
      setState("error");
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const currentYear = structure.academicYears.find((year) => year.isCurrent);

  return (
    <DashboardShell
      title="Academics"
      subtitle="Departments, programmes and course offerings"
      allowedRoles={["DEAN"]}
    >
      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-blue-600">
            Academic leadership
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Academic structure
          </h1>

          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            A read-only view of the institution&apos;s academic
            configuration
            {currentYear ? ` for ${currentYear.name}` : ""}. Changes are
            made by institutional administration.
          </p>
        </section>

        {state === "loading" && (
          <div className="grid gap-4 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <DashboardCard key={index}>
                <div className="acadlyx-skeleton h-4 w-32 rounded" />
                <div className="acadlyx-skeleton mt-3 h-3 w-full rounded" />
                <div className="acadlyx-skeleton mt-2 h-3 w-2/3 rounded" />
              </DashboardCard>
            ))}
          </div>
        )}

        {state === "error" && (
          <div
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 p-5"
          >
            <p className="font-bold text-red-900">
              Academic structure could not be loaded
            </p>

            <p className="mt-1 text-sm text-red-700">{error}</p>

            <button
              type="button"
              onClick={() => void load()}
              className="mt-4 rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white hover:bg-red-800"
            >
              Try again
            </button>
          </div>
        )}

        {state === "ready" && (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <DashboardCard>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Departments
                </p>
                <p className="mt-1 text-3xl font-black text-slate-950">
                  {structure.departments.length}
                </p>
              </DashboardCard>

              <DashboardCard>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Programmes
                </p>
                <p className="mt-1 text-3xl font-black text-slate-950">
                  {structure.programs.length}
                </p>
              </DashboardCard>

              <DashboardCard>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Course offerings
                </p>
                <p className="mt-1 text-3xl font-black text-slate-950">
                  {structure.offerings.length}
                </p>
              </DashboardCard>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <DashboardCard title="Departments">
                {structure.departments.length === 0 ? (
                  <p className="py-4 text-sm text-slate-400">
                    No departments configured.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {structure.departments.map((department) => (
                      <li
                        key={department.id}
                        className="flex items-center justify-between gap-3 py-2.5"
                      >
                        <span className="text-sm font-semibold text-slate-800">
                          {department.name}
                        </span>

                        {department.code && (
                          <span className="text-xs font-mono text-slate-400">
                            {department.code}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </DashboardCard>

              <DashboardCard title="Programmes">
                {structure.programs.length === 0 ? (
                  <p className="py-4 text-sm text-slate-400">
                    No programmes configured.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {structure.programs.map((program) => (
                      <li
                        key={program.id}
                        className="flex items-center justify-between gap-3 py-2.5"
                      >
                        <span className="text-sm font-semibold text-slate-800">
                          {program.name}
                        </span>

                        {program.code && (
                          <span className="text-xs font-mono text-slate-400">
                            {program.code}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </DashboardCard>
            </div>

            <DashboardCard title="Course offerings">
              {structure.offerings.length === 0 ? (
                <p className="py-4 text-sm text-slate-400">
                  No course offerings for the current cycle.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {structure.offerings.map((offering) => (
                    <li
                      key={offering.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                    >
                      <span className="text-sm font-semibold text-slate-800">
                        {offering.course?.code ?? "—"}
                        {offering.course?.name
                          ? ` — ${offering.course.name}`
                          : ""}
                      </span>

                      <span className="text-xs text-slate-400">
                        {offering.section?.name
                          ? `Section ${offering.section.name} · `
                          : ""}
                        {offering.semester?.name ?? ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </DashboardCard>
          </>
        )}
      </div>
    </DashboardShell>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuthRequiredError, authedFetch } from "@/lib/auth";

type FilterOption = {
  id: string;
  name: string;
  code?: string;
  departmentId?: string;
  programId?: string;
  semesterId?: string;
};

type ReportRow = {
  id: string;
  code: string;
  name: string;
  lmsStatus?: string;
  departmentName?: string;
  programName?: string;
  academicYearName?: string;
  semesterName?: string;
  sectionName?: string;
  analytics?: {
    rosterSize?: number;
    content?: { lessons?: number };
    assignments?: number;
    quizzes?: { quizzes?: number };
    internalMarks?: { avg?: number };
    examinations?: { avg?: number };
  };
};

type FilterOptions = {
  departments: FilterOption[];
  programs: FilterOption[];
  semesters: FilterOption[];
  sections: FilterOption[];
  academicYears: FilterOption[];
};

export default function LmsReportsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [options, setOptions] = useState<FilterOptions>({
    departments: [],
    programs: [],
    semesters: [],
    sections: [],
    academicYears: [],
  });
  const [meta, setMeta] = useState<{ page?: number; totalPages?: number }>();
  const [page, setPage] = useState(1);
  const [departmentId, setDepartmentId] = useState("");
  const [programId, setProgramId] = useState("");
  const [semesterId, setSemesterId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const response = await authedFetch<{ data: FilterOptions }>("/lms/filter-options");
        setOptions(response.data);
      } catch (e) {
        if (e instanceof AuthRequiredError) router.replace("/login");
        else setError(e instanceof Error ? e.message : "Unable to load filters");
      }
    })();
  }, [router]);

  useEffect(() => {
    void load();
  }, [page, departmentId, programId, semesterId, sectionId]);

  async function load() {
    try {
      setError("");
      const query = new URLSearchParams({
        page: String(page),
        pageSize: "20",
      });

      for (const [key, value] of Object.entries({
        departmentId,
        programId,
        semesterId,
        sectionId,
      })) {
        if (value) query.set(key, value);
      }

      const response = await authedFetch<{ data: ReportRow[]; meta?: { page?: number; totalPages?: number } }>(
        `/lms/reports?${query.toString()}`,
      );
      setRows(response.data ?? []);
      setMeta(response.meta);
    } catch (e) {
      if (e instanceof AuthRequiredError) router.replace("/login");
      else setError(e instanceof Error ? e.message : "Report unavailable");
    }
  }

  const programs = options.programs.filter(
    (item) => !departmentId || item.departmentId === departmentId,
  );

  const semesters = options.semesters.filter(
    (item) =>
      (!programId || item.programId === programId) &&
      (!departmentId ||
        options.programs.some(
          (program) =>
            program.id === item.programId && program.departmentId === departmentId,
        )),
  );

  const sections = options.sections.filter(
    (item) => !semesterId || item.semesterId === semesterId,
  );

  return (
    <DashboardShell
      title="LMS Reports"
      subtitle="Scope-aware course, content, assessment and learning analytics."
    >
      <div className="mx-auto max-w-7xl space-y-5">
        {error && (
          <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        <section className="grid gap-3 rounded-2xl border bg-white p-5 md:grid-cols-4">
          <select
            value={departmentId}
            onChange={(e) => {
              setPage(1);
              setDepartmentId(e.target.value);
              setProgramId("");
              setSemesterId("");
              setSectionId("");
            }}
            className="rounded-xl border p-3"
          >
            <option value="">All departments</option>
            {options.departments.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} · {item.name}
              </option>
            ))}
          </select>

          <select
            value={programId}
            onChange={(e) => {
              setPage(1);
              setProgramId(e.target.value);
              setSemesterId("");
              setSectionId("");
            }}
            className="rounded-xl border p-3"
          >
            <option value="">All programs</option>
            {programs.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} · {item.name}
              </option>
            ))}
          </select>

          <select
            value={semesterId}
            onChange={(e) => {
              setPage(1);
              setSemesterId(e.target.value);
              setSectionId("");
            }}
            className="rounded-xl border p-3"
          >
            <option value="">All semesters</option>
            {semesters.map((item) => (
              <option key={item.id} value={item.id}>
                Semester {item.name}
              </option>
            ))}
          </select>

          <select
            value={sectionId}
            onChange={(e) => {
              setPage(1);
              setSectionId(e.target.value);
            }}
            className="rounded-xl border p-3"
          >
            <option value="">All sections</option>
            {sections.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {rows.length ? (
            rows.map((row) => (
              <article key={row.id} className="rounded-2xl border bg-white p-5">
                <div className="flex justify-between gap-3">
                  <h2 className="font-black">
                    {row.code} · {row.name}
                  </h2>
                  <span className="text-xs font-bold">{row.lmsStatus ?? "—"}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {[row.departmentName, row.programName, row.academicYearName, row.semesterName, row.sectionName]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                  <span>Students {row.analytics?.rosterSize ?? 0}</span>
                  <span>Lessons {row.analytics?.content?.lessons ?? 0}</span>
                  <span>Assignments {row.analytics?.assignments ?? 0}</span>
                  <span>Quizzes {row.analytics?.quizzes?.quizzes ?? 0}</span>
                  <span>Internal {Math.round(row.analytics?.internalMarks?.avg ?? 0)}%</span>
                  <span>Exams {Math.round(row.analytics?.examinations?.avg ?? 0)}%</span>
                </div>
              </article>
            ))
          ) : (
            <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500 md:col-span-2">
              No LMS reports are available for the selected scope.
            </p>
          )}
        </section>

        <div className="flex items-center justify-between rounded-2xl border bg-white p-4">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((current) => current - 1)}
            className="rounded-lg border px-3 py-2 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-sm">
            Page {meta?.page ?? page} / {meta?.totalPages ?? 1}
          </span>
          <button
            type="button"
            disabled={!meta || page >= (meta.totalPages ?? 1)}
            onClick={() => setPage((current) => current + 1)}
            className="rounded-lg border px-3 py-2 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </DashboardShell>
  );
}

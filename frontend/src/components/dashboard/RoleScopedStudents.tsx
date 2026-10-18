"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuthRequiredError, authedFetch, HttpRequestError } from "@/lib/auth";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Student = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  profile?: { admissionNumber?: string | null } | null;
};
type Envelope = { success: boolean; data: Student[] };
type FilterOption = { id: string; name: string };
type CriteriaOptions = { campuses: FilterOption[]; departments: FilterOption[]; programs: FilterOption[]; batches: FilterOption[]; semesters: FilterOption[]; academicYears: FilterOption[] };

export function RoleScopedStudents({
  role,
  title,
  subtitle,
  detailBasePath = "/students",
  apiBasePath = "/students",
  placementFilters = false,
}: {
  role: string;
  title: string;
  subtitle: string;
  detailBasePath?: string | null;
  apiBasePath?: string;
  placementFilters?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [criteria, setCriteria] = useState<CriteriaOptions | null>(null);
  const [filters, setFilters] = useState(() => ({
    campusId: placementFilters ? searchParams.get("campusId") || "" : "",
    departmentId: placementFilters ? searchParams.get("departmentId") || "" : "",
    programId: placementFilters ? searchParams.get("programId") || "" : "",
    batchId: placementFilters ? searchParams.get("batchId") || "" : "",
    semesterId: placementFilters ? searchParams.get("semesterId") || "" : "",
    academicYearId: placementFilters ? searchParams.get("academicYearId") || "" : "",
    sectionId: placementFilters ? searchParams.get("sectionId") || "" : "",
  }));
  const pageSize = 25;

  function updateWorkspaceFilter(key: keyof typeof filters, value: string) {
    const next = { ...filters, [key]: value };
    const dependents: Partial<Record<keyof typeof filters, Array<keyof typeof filters>>> = {
      campusId: ["departmentId", "programId", "batchId", "semesterId", "sectionId"],
      departmentId: ["programId", "semesterId", "sectionId"],
      programId: ["batchId", "semesterId", "sectionId"],
      academicYearId: ["semesterId", "sectionId"],
      semesterId: ["sectionId"],
    };
    for (const child of dependents[key] || []) next[child] = "";
    setFilters(next);
    setPage(1);
    const params = new URLSearchParams(searchParams.toString());
    for (const contextKey of ["campusId", "departmentId", "programId", "academicYearId", "batchId", "semesterId", "sectionId"] as const) {
      const contextValue = next[contextKey];
      if (contextValue) params.set(contextKey, contextValue);
      else params.delete(contextKey);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (search) query.set("search", search);
      for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
      const response = await authedFetch<Envelope>(apiBasePath + "?" + query.toString());
      setStudents(response.data ?? []);
    } catch (reason) {
      if (reason instanceof AuthRequiredError) {
        router.replace("/login");
        return;
      }
      setError(reason instanceof HttpRequestError
        ? reason.message
        : "Unable to load students in the current authorized scope.");
    } finally {
      setLoading(false);
    }
  }, [apiBasePath, page, pageSize, search, filters, router]);

  useEffect(() => {
    if (!placementFilters) return;
    setFilters({
      campusId: searchParams.get("campusId") || "",
      departmentId: searchParams.get("departmentId") || "",
      programId: searchParams.get("programId") || "",
      batchId: searchParams.get("batchId") || "",
      semesterId: searchParams.get("semesterId") || "",
      academicYearId: searchParams.get("academicYearId") || "",
      sectionId: searchParams.get("sectionId") || "",
    });
    setPage(1);
  }, [searchParams, placementFilters]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!placementFilters) return;
    authedFetch<{ data: CriteriaOptions }>("/placements/criteria-options")
      .then((response) => setCriteria(response.data))
      .catch((reason) => {
        if (reason instanceof AuthRequiredError) router.replace("/login");
        else setError(reason instanceof HttpRequestError ? reason.message : "Unable to load academic filters.");
      });
  }, [placementFilters, router]);

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  return (
    <DashboardShell title={title} subtitle={subtitle} allowedRoles={[role]}>
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">{role} workspace</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Students</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{subtitle}</p>
        </section>

        <form onSubmit={submitSearch} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row">
          <label htmlFor="student-search" className="sr-only">Search students</label>
          <input id="student-search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search by student name, admission number or email" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm" />
          <button type="submit" className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white">Search</button>
          <button type="button" onClick={() => { setSearchInput(""); setSearch(""); setFilters({ campusId: "", departmentId: "", programId: "", batchId: "", semesterId: "", academicYearId: "", sectionId: "" }); setPage(1); const params = new URLSearchParams(searchParams.toString()); for (const key of ["campusId", "departmentId", "programId", "academicYearId", "batchId", "semesterId", "sectionId"]) params.delete(key); const query = params.toString(); router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }); }} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold">Reset</button>
          {placementFilters && <div className="grid w-full gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2 lg:grid-cols-3">
            {([
              ["campusId", "Campus", criteria?.campuses ?? []],
              ["departmentId", "Department", criteria?.departments ?? []],
              ["programId", "Programme", criteria?.programs ?? []],
              ["batchId", "Admission batch", criteria?.batches ?? []],
              ["semesterId", "Semester", criteria?.semesters ?? []],
              ["academicYearId", "Academic year / session", criteria?.academicYears ?? []],
            ] as Array<[keyof typeof filters, string, FilterOption[]]>).map(([key, label, options]) => <label key={key} className="flex flex-col gap-1 text-xs font-bold text-slate-600">{label}
              <select value={filters[key]} onChange={(event) => updateWorkspaceFilter(key, event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal"><option value="">All {label.toLowerCase()}s</option>{options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select>
            </label>)}
          </div>}
        </form>

        {error ? (
          <section role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            <p>{error}</p>
            <button type="button" onClick={() => void load()} disabled={loading} className="mt-3 rounded-lg border border-red-300 px-3 py-2 font-bold disabled:opacity-50">Retry</button>
          </section>
        ) : loading ? (
          <section role="status" className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">Loading students…</section>
        ) : students.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            {search ? `No authorized students match “${search}”. Try a different search or reset the filter.` : "No students are available in your authorised scope."}
          </section>
        ) : (
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
              <p className="text-sm font-semibold text-slate-600">{students.length} students on this page{search ? ` · Search: ${search}` : ""}</p>
              <button type="button" onClick={() => void load()} disabled={loading} className="text-sm font-bold text-emerald-700 disabled:opacity-50">Refresh</button>
            </div>
            <div className="divide-y divide-slate-100">
              {students.map((student) => {
                const rowContent = (
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-bold text-slate-950">{student.firstName} {student.lastName}</p>
                      <p className="text-xs text-slate-500">{student.profile?.admissionNumber || student.email}</p>
                    </div>
                    {detailBasePath ? (
                      <span className="text-xs font-semibold text-emerald-700">
                        {placementFilters ? "View placement profile →" : "View student profile →"}
                      </span>
                    ) : null}
                  </div>
                );

                return detailBasePath ? (
                  <Link
                    key={student.id}
                    href={`${detailBasePath}/${encodeURIComponent(student.id)}`}
                    className="block px-5 py-4 transition hover:bg-slate-50 sm:px-6"
                  >
                    {rowContent}
                  </Link>
                ) : (
                  <div key={student.id} className="px-5 py-4 sm:px-6">
                    {rowContent}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4 sm:px-6">
              <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-40">Previous</button>
              <span className="text-sm text-slate-500">Page {page}</span>
              <button type="button" disabled={students.length < pageSize || loading} onClick={() => setPage((value) => value + 1)} className="rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-40">Next</button>
            </div>
          </section>
        )}
      </div>
    </DashboardShell>
  );
}

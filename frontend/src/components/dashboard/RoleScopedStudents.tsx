"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuthRequiredError, authedFetch, HttpRequestError } from "@/lib/auth";
import { useRouter } from "next/navigation";

type Student = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  profile?: { admissionNumber?: string | null } | null;
};
type Envelope = { success: boolean; data: Student[] };

export function RoleScopedStudents({
  role,
  title,
  subtitle,
  detailBasePath = "/students",
}: {
  role: string;
  title: string;
  subtitle: string;
  detailBasePath?: string;
}) {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (search) query.set("search", search);
      const response = await authedFetch<Envelope>(`/students?${query.toString()}`);
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
  }, [page, pageSize, search, router]);

  useEffect(() => { void load(); }, [load]);

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
          <button type="button" onClick={() => { setSearchInput(""); setSearch(""); setPage(1); }} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold">Reset</button>
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
              {students.map((student) => (
                <Link key={student.id} href={`${detailBasePath}/${encodeURIComponent(student.id)}`} className="block px-5 py-4 transition hover:bg-slate-50 sm:px-6">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-bold text-slate-950">{student.firstName} {student.lastName}</p>
                      <p className="text-xs text-slate-500">{student.profile?.admissionNumber || student.email}</p>
                    </div>
                    <span className="text-xs font-semibold text-emerald-700">View placement profile →</span>
                  </div>
                </Link>
              ))}
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

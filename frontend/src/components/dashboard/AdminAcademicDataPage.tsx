"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuthRequiredError, authedFetch } from "@/lib/auth";

type ModuleKey =
  | "departments" | "programs" | "academic-years" | "semesters"
  | "sections" | "courses" | "course-offerings" | "campuses";

type Row = Record<string, unknown>;

const CONFIG: Record<ModuleKey, { title: string; endpoint: string; fields: string[] }> = {
  departments: { title: "Departments", endpoint: "/departments?page=1&pageSize=500", fields: ["name", "code", "isActive"] },
  programs: { title: "Programs", endpoint: "/programs?page=1&pageSize=500", fields: ["name", "code", "level", "durationYears", "isActive"] },
  "academic-years": { title: "Academic Years", endpoint: "/academic-years?page=1&pageSize=500", fields: ["name", "startDate", "endDate", "isCurrent"] },
  semesters: { title: "Semesters", endpoint: "/semesters?page=1&pageSize=500", fields: ["name", "number", "isActive"] },
  sections: { title: "Sections", endpoint: "/sections?page=1&pageSize=500", fields: ["name", "code", "capacity", "isActive"] },
  courses: { title: "Courses", endpoint: "/courses?page=1&pageSize=500", fields: ["name", "code", "credits", "isActive"] },
  "course-offerings": { title: "Course Offerings", endpoint: "/course-offerings?page=1&pageSize=500", fields: ["course", "program", "semester", "section", "faculty", "isActive"] },
  campuses: { title: "Campuses", endpoint: "/campuses?page=1&pageSize=500", fields: ["name", "code", "address", "isActive"] },
};

function normalizeRows(value: unknown): Row[] {
  if (Array.isArray(value)) return value as Row[];
  if (value && typeof value === "object" && Array.isArray((value as { items?: unknown }).items)) {
    return (value as { items: Row[] }).items;
  }
  return [];
}

function display(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") {
    const item = value as Record<string, unknown>;
    return String(item.name ?? item.code ?? item.title ?? item.id ?? "—");
  }
  return String(value);
}

export default function AdminAcademicDataPage({ module }: { module: ModuleKey }) {
  const router = useRouter();
  const config = CONFIG[module];
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await authedFetch<{ data: unknown }>(config.endpoint);
      setRows(normalizeRows(response.data));
    } catch (reason) {
      if (reason instanceof AuthRequiredError) {
        router.replace("/login");
        return;
      }
      setError(reason instanceof Error ? reason.message : "Unable to load records.");
    } finally {
      setLoading(false);
    }
  }, [config.endpoint, router]);

  useEffect(() => { void load(); }, [load]);

  return (
    <DashboardShell title={config.title} subtitle="Institution-scoped live data from the canonical backend" allowedRoles={["INSTITUTION_ADMIN"]}>
      <main className="mx-auto w-full max-w-7xl space-y-5 p-4 sm:p-6 lg:p-8">
        <section className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">Live data pipeline</p>
            <h1 className="mt-1 text-2xl font-black text-slate-950">{config.title}</h1>
            <p className="mt-1 text-sm text-slate-500">{loading ? "Loading…" : rows.length + " records returned from the institution API."}</p>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{loading ? "Refreshing…" : "Refresh data"}</button>
        </section>

        {error ? <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700"><p className="font-bold">Data could not be loaded</p><p className="mt-1">{error}</p><button type="button" onClick={() => void load()} className="mt-3 font-bold underline">Retry</button></section> : null}

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          {loading ? <div className="p-10 text-center text-sm text-slate-500">Loading live records…</div> :
           rows.length === 0 ? <div className="p-10 text-center text-sm text-slate-500">No records are currently configured.</div> :
           <div className="overflow-x-auto"><table className="min-w-full text-left text-sm">
             <thead className="border-b border-slate-200 bg-slate-50"><tr><th className="px-4 py-3 font-black text-slate-600">Record</th>{config.fields.map((field) => <th key={field} className="px-4 py-3 font-black capitalize text-slate-600">{field.replace(/([A-Z])/g, " $1")}</th>)}</tr></thead>
             <tbody className="divide-y divide-slate-100">{rows.map((row, index) => <tr key={String(row.id ?? index)} className="hover:bg-slate-50">
               <td className="px-4 py-3 font-bold text-slate-900">{display(row.name ?? row.title ?? row.code ?? row.id)}</td>
               {config.fields.map((field) => <td key={field} className="px-4 py-3 text-slate-600">{display(row[field])}</td>)}
             </tr>)}</tbody>
           </table></div>}
        </section>
      </main>
    </DashboardShell>
  );
}

"use client";

import { useRef, useState } from "react";
import { commitImport, commitPartialStudentImport, DataType, exportData, getImportJob, previewImport } from "@/lib/dataTransferApi";

const labels: Record<DataType, string> = {
  users: "Users", students: "Students", faculty: "Faculty", campuses: "Campuses", departments: "Departments",
  programs: "Programs", "academic-years": "Academic Years", semesters: "Semesters", sections: "Sections",
  courses: "Courses", "course-offerings": "Course Offerings", exams: "Exams", marks: "Marks", attendance: "Attendance",
  fees: "Fees", "fee-payments": "Fee Payments", "fee-structures": "Fee Structures", notices: "Notices",
  timetable: "Timetable", "parent-links": "Parent Links",
};

export default function DataTransferActions({ type, compact = false }: { type: DataType; compact?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Array<{ row?: number; message: string }>>([]);

  async function waitForJob(jobId: string) {
    for (;;) {
      const job = await getImportJob(jobId);
      if (job.status === "COMPLETED") return job.result ?? {};
      if (job.status === "FAILED" || job.status === "CANCELLED") throw new Error(job.errorMessage || "The import job did not complete.");
      setMessage("Importing " + (job.processed + job.failed) + " of " + (job.total || "…") + " row(s) (" + job.progress + "%).");
      await new Promise((resolve) => window.setTimeout(resolve, 1200));
    }
  }

  async function onFile(file: File) {
    setBusy(true); setMessage(""); setErrors([]);
    try {
      if (file.size > 15 * 1024 * 1024) throw new Error("Import file must be 15 MB or smaller.");
      const preview = await previewImport(type, file);
      const ok = window.confirm(`Preview ${preview.totalRows} row(s) for ${labels[type]}. Import these rows now?`);
      if (!ok) return;
      const result = type === "students" ? await commitPartialStudentImport(file) : await commitImport(type, file);
      if (type === "students" && result.incomplete?.length) {
        const ids = result.incomplete.map((item) => item.id).join(",");
        window.location.href = `/imports/students/complete?ids=${encodeURIComponent(ids)}`;
        return;
      }
      setMessage((result.failed ?? 0) > 0 ? `${result.imported ?? 0} row(s) imported; ${result.failed} row(s) failed. Review the errors below.` : `${result.imported ?? 0} row(s) imported successfully.`);
      window.setTimeout(() => setMessage(""), 4000);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed.");
    } finally { setBusy(false); if (inputRef.current) inputRef.current.value = ""; }
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? "" : "rounded-2xl border border-slate-300 bg-slate-100/80 p-3"}`}>
      <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) void onFile(file); }} />
      <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-xs font-black text-slate-800 hover:border-blue-300 hover:bg-blue-50 disabled:opacity-50">
        {busy ? "Importing…" : `Import ${labels[type]}`}
      </button>
      <button type="button" disabled={busy} onClick={() => void exportData(type, "xlsx").catch((e) => setMessage(e.message))} className="rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-xs font-black text-slate-800 hover:border-blue-300 hover:bg-blue-50 disabled:opacity-50">Export XLSX</button>
      <button type="button" disabled={busy} onClick={() => void exportData(type, "csv").catch((e) => setMessage(e.message))} className="rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-xs font-black text-slate-800 hover:border-blue-300 hover:bg-blue-50 disabled:opacity-50">Export CSV</button>
      {message && <span role="status" className="basis-full text-xs text-slate-600">{message}</span>}
      {errors.length > 0 && <div className="basis-full rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700"><p className="font-black">Row-level errors</p><ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">{errors.slice(0, 100).map((item, index) => <li key={`${item.row ?? "row"}-${index}`}>Row {item.row ?? "?"}: {item.message}</li>)}</ul>{errors.length > 100 && <p className="mt-2 font-semibold">Showing the first 100 errors.</p>}</div>}
    </div>
  );
}

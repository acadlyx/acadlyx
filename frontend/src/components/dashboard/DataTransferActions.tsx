"use client";

import { useRef, useState } from "react";
import { commitImport, DataType, exportData, previewImport } from "@/lib/dataTransferApi";

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

  async function onFile(file: File) {
    setBusy(true); setMessage("");
    try {
      const preview = await previewImport(type, file);
      const ok = window.confirm(`Preview ${preview.totalRows} row(s) for ${labels[type]}. Import these rows now?`);
      if (!ok) return;
      const result = await commitImport(type, file);
      setMessage(`${result.imported} row(s) imported successfully.`);
      window.setTimeout(() => setMessage(""), 4000);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed.");
    } finally { setBusy(false); if (inputRef.current) inputRef.current.value = ""; }
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? "" : "rounded-xl border border-slate-200 bg-slate-50 p-3"}`}>
      <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) void onFile(file); }} />
      <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50">
        {busy ? "Importing…" : `Import ${labels[type]}`}
      </button>
      <button type="button" disabled={busy} onClick={() => void exportData(type, "xlsx").catch((e) => setMessage(e.message))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50">Export XLSX</button>
      <button type="button" disabled={busy} onClick={() => void exportData(type, "csv").catch((e) => setMessage(e.message))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50">Export CSV</button>
      {message && <span className="basis-full text-xs text-slate-500">{message}</span>}
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import { commitImport, commitPartialStudentImport, DataType, exportData, getImportJob, previewImport, printExport } from "@/lib/dataTransferApi";

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
  const [pendingJobId, setPendingJobId] = useState("");
  const [completionUrl, setCompletionUrl] = useState("");
  const MAX_IMPORT_STATUS_CHECKS = 300;

  async function waitForJob(jobId: string): Promise<Awaited<ReturnType<typeof commitPartialStudentImport>>> {
    for (let attempt = 0; attempt < MAX_IMPORT_STATUS_CHECKS; attempt += 1) {
      const job = await getImportJob(jobId);
      if (job.status === "COMPLETED" || job.status === "PARTIAL") {
        if (!job.result || typeof job.result.imported !== "number") {
          setPendingJobId("");
          throw new Error(`Import job ${job.status.toLowerCase()} without a verifiable result summary (job ID: ${jobId}). Check the job record before retrying the file.`);
        }
        setPendingJobId("");
        return job.result;
      }
      if (job.status === "FAILED" || job.status === "CANCELLED") {
        setPendingJobId("");
        throw new Error(`Import ${job.status.toLowerCase()}: ${job.errorMessage || "The import job did not complete."} (job ID: ${jobId})`);
      }
      setMessage(`Import job ${jobId}: ${job.processed + job.failed} of ${job.total || "…"} row(s) processed (${job.progress}%).`);
      await new Promise((resolve) => window.setTimeout(resolve, 1200));
    }
    throw new Error(`The import is still processing. Job ID: ${jobId}. Use “Check import status” below; do not upload the same file again.`);
  }

  function showImportResult(result: { imported: number; failed?: number; errors?: Array<{ row?: number; message: string }>; failedRows?: Array<{ row: number; message: string }>; rolledBack?: boolean }) {
    const rowErrors = result.errors?.length ? result.errors : (result.failedRows ?? []);
    setErrors(rowErrors.map((item) => ({ row: item.row, message: item.message })));
    if (result.rolledBack) {
      setMessage(`Import was rolled back; no rows were saved. ${result.failed ?? 0} row(s) failed. Review the error details below.`);
    } else if ((result.failed ?? 0) > 0) {
      setMessage(`${result.imported} row(s) imported; ${result.failed} row(s) failed. Review the errors below.`);
    } else if (result.imported > 0) {
      setMessage(`${result.imported} row(s) imported successfully.`);
    } else {
      setMessage("The import job finished without a verifiable non-zero row count. Verify the job record before trying the file again.");
    }
  }

  async function checkPendingJob() {
    if (!pendingJobId) return;
    setBusy(true);
    setMessage("Checking the import job status…");
    try {
      const result = await waitForJob(pendingJobId);
      showImportResult(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not verify the import job status.");
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File) {
    setBusy(true); setMessage(""); setErrors([]); setCompletionUrl("");
    try {
      if (file.size > 15 * 1024 * 1024) throw new Error("Import file must be 15 MB or smaller.");
      const preview = await previewImport(type, file);
      const ok = window.confirm(`Preview ${preview.totalRows} row(s) for ${labels[type]}. Import these rows now?`);
      if (!ok) return;

      if (type === "students") {
        const result = await commitPartialStudentImport(file);
        if (result.incomplete?.length) {
          const ids = result.incomplete.map((item) => item.id).join(",");
          setCompletionUrl(`/imports/students/complete?ids=${encodeURIComponent(ids)}`);
        }
        showImportResult(result);
      } else {
        const queued = await commitImport(type, file);
        setPendingJobId(queued.jobId);
        setMessage(`Import queued as job ${queued.jobId}. Waiting for the server to confirm its result…`);
        const result = await waitForJob(queued.jobId);
        showImportResult(result);
      }
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
      <button type="button" disabled={busy} onClick={() => void exportData(type, "docx").catch((e) => setMessage(e.message))} className="rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-xs font-black text-slate-800 hover:border-blue-300 hover:bg-blue-50 disabled:opacity-50">Export DOCX</button>
      <button type="button" disabled={busy} onClick={() => void exportData(type, "pdf").catch((e) => setMessage(e.message))} className="rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-xs font-black text-slate-800 hover:border-blue-300 hover:bg-blue-50 disabled:opacity-50">Export PDF</button>
      <button type="button" disabled={busy} onClick={() => void exportData(type, "json").catch((e) => setMessage(e.message))} className="rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-xs font-black text-slate-800 hover:border-blue-300 hover:bg-blue-50 disabled:opacity-50">Export JSON</button>
      <button type="button" disabled={busy} onClick={() => void printExport(type).catch((e) => setMessage(e.message))} className="rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-xs font-black text-slate-800 hover:border-blue-300 hover:bg-blue-50 disabled:opacity-50">Print</button>
      {message && <span role="status" className="basis-full text-xs text-slate-600">{message}</span>}
      {pendingJobId && <button type="button" disabled={busy} onClick={() => void checkPendingJob()} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50">Check import status</button>}
      {completionUrl && <a href={completionUrl} className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">Complete imported student details</a>}
      {errors.length > 0 && <div className="basis-full rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700"><p className="font-black">Row-level errors</p><ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">{errors.slice(0, 100).map((item, index) => <li key={`${item.row ?? "row"}-${index}`}>Row {item.row ?? "?"}: {item.message}</li>)}</ul>{errors.length > 100 && <p className="mt-2 font-semibold">Showing the first 100 errors.</p>}</div>}
    </div>
  );
}

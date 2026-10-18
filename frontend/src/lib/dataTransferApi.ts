import { authedBlobFetch, authedFetch } from "./auth";

export const DATA_TYPES = [
  "users", "students", "faculty", "campuses", "departments", "programs",
  "academic-years", "semesters", "sections", "courses", "course-offerings", "exams",
  "marks", "attendance", "fees", "fee-payments", "fee-structures", "notices",
  "timetable", "parent-links",
] as const;

export type DataType = typeof DATA_TYPES[number];
export type ExportType = DataType | "paid-fees" | "outstanding-dues" | "fee-heads" | "fee-receipts" | "fee-transactions" | "fee-refunds" | "fee-concessions" | "fee-audit" | "assignments" | "assignment-submissions" | "library-books" | "library-copies" | "library-issues" | "library-fines" | "admission-applications" | "employees" | "leave-requests" | "calendar-events" | "institutional-events" | "event-media" | "placement-companies" | "placement-drives" | "placement-openings" | "placement-applications" | "placement-offers" | "placement-visits" | "placement-tests" | "placement-interviews";
export type ExportFormat = "xlsx" | "csv" | "docx" | "pdf" | "json";
export interface ExportOptions {
  selection?: "all-filtered" | "current-page" | "selected";
  ids?: string[];
  page?: number;
  pageSize?: number;
  filters?: Record<string, string>;
}
function exportUrl(type: ExportType, format: ExportFormat, options: ExportOptions = {}): string {
  const params = new URLSearchParams({ format, selection: options.selection || "all-filtered" });
  if (options.page !== undefined) params.set("page", String(options.page));
  if (options.pageSize !== undefined) params.set("pageSize", String(options.pageSize));
  for (const id of options.ids || []) params.append("ids", id);
  for (const [key, value] of Object.entries(options.filters || {})) params.set("filter_" + key, value);
  return "/exports/" + encodeURIComponent(type) + "?" + params.toString();
}

export interface BackgroundExportJob {
  jobId: string;
  status: string;
  progress: number;
  processed: number;
  failed: number;
  total: number;
  errorMessage: string | null;
  result?: { fileId?: string; filename?: string; rowCount?: number; contentType?: string } | null;
}
export interface ExportJobSubmission {
  jobId: string;
  status: string;
  type: ExportType;
  format: ExportFormat;
}
const EXPORT_JOB_STATUSES = new Set([
  "QUEUED", "PROCESSING", "COMPLETED", "PARTIAL",
  "FAILED", "CANCEL_REQUESTED", "CANCELLED",
]);

export async function getExportJob(jobId: string): Promise<BackgroundExportJob> {
  const response = await authedFetch<{ data: { id: string; status: string; progress: number; processed: number; failed: number; total: number; errorMessage: string | null; result?: BackgroundExportJob["result"] } }>(`/exports/jobs/${encodeURIComponent(jobId)}`);
  const job = response.data;
  if (!job || typeof job.id !== "string" || !EXPORT_JOB_STATUSES.has(job.status)) throw new Error("The server did not return a valid export job state.");
  return { jobId: job.id, status: job.status, progress: job.progress || 0, processed: job.processed || 0, failed: job.failed || 0, total: job.total || 0, errorMessage: job.errorMessage || null, result: job.result || null };
}

export async function cancelExportJob(jobId: string): Promise<BackgroundExportJob> {
  const response = await authedFetch<{ data: { id: string; status: string; progress: number; processed: number; failed: number; total: number; errorMessage: string | null; result?: BackgroundExportJob["result"] } }>(`/exports/jobs/${encodeURIComponent(jobId)}/cancel`, { method: "POST" });
  const job = response.data;
  if (!job || typeof job.id !== "string" || !EXPORT_JOB_STATUSES.has(job.status)) throw new Error("The server did not return a valid export cancellation state.");
  return { jobId: job.id, status: job.status, progress: job.progress || 0, processed: job.processed || 0, failed: job.failed || 0, total: job.total || 0, errorMessage: job.errorMessage || null, result: job.result || null };
}

async function enqueueExport(type: ExportType, format: ExportFormat, options: ExportOptions): Promise<ExportJobSubmission> {
  const response = await authedFetch<{ data: ExportJobSubmission }>(`/exports/${encodeURIComponent(type)}/jobs`, {
    method: "POST",
    body: JSON.stringify({
      format,
      selection: options.selection || "all-filtered",
      ...(options.ids ? { ids: options.ids } : {}),
      ...(options.page !== undefined ? { page: options.page } : {}),
      ...(options.pageSize !== undefined ? { pageSize: options.pageSize } : {}),
      ...(options.filters ? { filters: options.filters } : {}),
    }),
  });
  const job = response.data;
  if (!job || typeof job.jobId !== "string" || !job.jobId.trim() || job.type !== type || job.format !== format || !EXPORT_JOB_STATUSES.has(job.status)) throw new Error("The server did not return a valid export job receipt.");
  return job;
}

export interface ImportPreviewResult {
  totalRows: number;
  validRows?: number;
  invalidRows?: number;
  errors?: Array<{ row?: number; message: string }>;
  [key: string]: unknown;
}

export interface IncompleteStudentImport {
  id: string;
  row: number;
  name: string;
  missingFields: string[];
}

export interface ImportCommitResult {
  imported: number;
  skipped?: number;
  failed?: number;
  errors?: Array<{ row?: number; message: string }>;
  incomplete?: IncompleteStudentImport[];
  complete?: IncompleteStudentImport[];
  failedRows?: Array<{ row: number; message: string }>;
  [key: string]: unknown;
}

export async function previewImport(type: DataType, file: File): Promise<ImportPreviewResult> {
  const form = new FormData();
  form.append("file", file);
  const body = await authedFetch<{ data: ImportPreviewResult }>(`/imports/${type}/preview`, {
    method: "POST",
    body: form,
  });
  return body.data;
}

export async function commitPartialStudentImport(file: File): Promise<ImportCommitResult & { incomplete?: Array<{ id: string; row: number; name: string; missingFields: string[] }>; complete?: Array<{ id: string; row: number; name: string; missingFields: string[] }>; failedRows?: Array<{ row: number; message: string }> }> {
  const form = new FormData();
  form.append("file", file);
  const body = await authedFetch<{ data: ImportCommitResult & { incomplete?: Array<{ id: string; row: number; name: string; missingFields: string[] }>; complete?: Array<{ id: string; row: number; name: string; missingFields: string[] }>; failedRows?: Array<{ row: number; message: string }> } }>(`/imports/students/commit-partial`, { method: "POST", body: form });
  return body.data;
}
export interface ImportJobSubmission {
  jobId: string;
  status: string;
  type: DataType;
  mode: "partial" | "atomic";
}

const IMPORT_JOB_STATUSES = new Set([
  "QUEUED", "PROCESSING", "COMPLETED", "PARTIAL",
  "FAILED", "CANCEL_REQUESTED", "CANCELLED",
]);

export async function commitImport(type: DataType, file: File): Promise<ImportJobSubmission> {
  const form = new FormData();
  form.append("file", file);
  const body = await authedFetch<{ data: unknown }>(`/imports/${type}/commit`, {
    method: "POST",
    body: form,
  });
  const submission = body.data as Partial<ImportJobSubmission> | null | undefined;
  if (
    !submission ||
    typeof submission.jobId !== "string" ||
    !submission.jobId.trim() ||
    typeof submission.status !== "string" ||
    !IMPORT_JOB_STATUSES.has(submission.status) ||
    submission.type !== type ||
    (submission.mode !== "atomic" && submission.mode !== "partial")
  ) {
    throw new Error("The server did not return a valid import job receipt. No import success is confirmed.");
  }
  return submission as ImportJobSubmission;
}

export async function getImportJob(jobId: string) {
  const body = await authedFetch<{ data: { id: string; status: string; progress: number; processed: number; failed: number; total: number; errorMessage: string | null; result: ImportCommitResult | null } }>(`/imports/jobs/${encodeURIComponent(jobId)}`);
  return body.data;
}

export async function exportData(
  type: ExportType,
  format: ExportFormat,
  options: ExportOptions = {},
  onBackgroundProgress?: (job: BackgroundExportJob) => void,
): Promise<void> {
  let response = await authedBlobFetch(exportUrl(type, format, options));
  if (response.status === 413) {
    const submission = await enqueueExport(type, format, options);
    let job = await getExportJob(submission.jobId);
    const startedAt = Date.now();
    onBackgroundProgress?.(job);
    while (!["COMPLETED", "PARTIAL", "FAILED", "CANCELLED"].includes(job.status)) {
      if (Date.now() - startedAt > 30 * 60 * 1000) {
        throw new Error("The export is still processing. Reopen the job to check its state; no completion is confirmed.");
      }
      await new Promise<void>((resolve) => window.setTimeout(resolve, 1500));
      job = await getExportJob(submission.jobId);
      onBackgroundProgress?.(job);
    }
    onBackgroundProgress?.(job);
    if (job.status === "CANCELLED") throw new Error("The export job was cancelled.");
    if (job.status === "FAILED") throw new Error(job.errorMessage || "The background export failed.");
    if (!job.result?.fileId) throw new Error("The completed export job has no downloadable artifact.");
    response = await authedBlobFetch(`/exports/jobs/${encodeURIComponent(submission.jobId)}/download`);
  }
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.error?.message || "Export failed (" + response.status + ")");
  }
  const blob = await response.blob();
  if (blob.size === 0) throw new Error("The server returned an empty export file. No download was created.");
  const expectedTypes: Record<ExportFormat, string> = {
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    csv: "text/csv",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    pdf: "application/pdf",
    json: "application/json",
  };
  const expectedType = expectedTypes[format];
  const actualType = blob.type.split(";")[0].toLowerCase();
  if (actualType && actualType !== expectedType) {
    throw new Error("The server returned an unexpected file type. The export was not downloaded.");
  }
  const disposition = response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?([^";]+)"?/i);
  const filename = match?.[1] || ("acadlyx-" + type + "." + format);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Open the authorized server export in a print-friendly browser document. */
export async function printExport(type: ExportType, options: ExportOptions = {}): Promise<void> {
  const response = await authedBlobFetch(exportUrl(type, "json", options));
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error?.message || `Print export failed (${response.status})`);
  }
  const rows = await response.json() as Array<Record<string, unknown>>;
  if (!Array.isArray(rows)) throw new Error("The server returned an invalid print dataset.");
  const escapeHtml = (value: unknown) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
  const columns = rows.length ? Object.keys(rows[0]) : [];
  const table = columns.length
    ? "<table><thead><tr>" + columns.map((key) => "<th>" + escapeHtml(key) + "</th>").join("") + "</tr></thead><tbody>" + rows.map((row) => "<tr>" + columns.map((key) => "<td>" + escapeHtml(row[key]) + "</td>").join("") + "</tr>").join("") + "</tbody></table>"
    : "<p>No records matched the export.</p>";
  const popup = window.open("", "_blank");
  if (!popup) throw new Error("Allow pop-ups to open the print view.");
  popup.document.write("<!doctype html><html><head><meta charset=\"utf-8\"><title>ACADLYX export</title><style>body{font:12px Arial,sans-serif;margin:24px;color:#172033}h1{font-size:18px}table{border-collapse:collapse;width:100%;font-size:10px}th,td{border:1px solid #bbb;padding:5px;text-align:left;overflow-wrap:anywhere}th{background:#eee}thead{display:table-header-group}tr{break-inside:avoid}@media print{body{margin:10mm}}</style></head><body><h1>ACADLYX — " + escapeHtml(type) + " export</h1><p>" + rows.length + " record(s) · Generated " + escapeHtml(new Date().toLocaleString()) + "</p>" + table + "<script>window.onload=function(){window.print()}</script></body></html>");
  popup.document.close();
}

import { authedBlobFetch, authedFetch } from "./auth";

export const DATA_TYPES = [
  "users", "students", "faculty", "campuses", "departments", "programs",
  "academic-years", "semesters", "sections", "courses", "course-offerings", "exams",
  "marks", "attendance", "fees", "fee-payments", "fee-structures", "notices",
  "timetable", "parent-links",
] as const;

export type DataType = typeof DATA_TYPES[number];

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
export async function commitImport(type: DataType, file: File): Promise<ImportCommitResult & { jobId?: string; status?: string }> {
  const form = new FormData();
  form.append("file", file);
  const body = await authedFetch<{ data: ImportCommitResult }>(`/imports/${type}/commit`, {
    method: "POST",
    body: form,
  });
  return body.data;
}

export async function getImportJob(jobId: string) {
  const body = await authedFetch<{ data: { id: string; status: string; progress: number; processed: number; failed: number; total: number; errorMessage: string | null; result: ImportCommitResult | null } }>(`/imports/jobs/${encodeURIComponent(jobId)}`);
  return body.data;
}

export async function exportData(type: DataType, format: "xlsx" | "csv" | "json") {
  const response = await authedBlobFetch(`/exports/${type}?format=${format}`);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error?.message || `Export failed (${response.status})`);
  }

  const blob = await response.blob();
  if (blob.size === 0) {
    throw new Error("The server returned an empty export file. No download was created.");
  }

  const expectedType = format === "xlsx"
    ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    : format === "csv" ? "text/csv" : "application/json";
  const actualType = blob.type.split(";")[0].toLowerCase();
  if (actualType && actualType !== expectedType) {
    throw new Error("The server returned an unexpected file type. The export was not downloaded.");
  }

  const disposition = response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?([^";]+)"?/i);
  const filename = match?.[1] || `acadlyx-${type}.${format}`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Open the authorized server export in a print-friendly browser document. */
export async function printExport(type: DataType): Promise<void> {
  const response = await authedBlobFetch(`/exports/${type}?format=json`);
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

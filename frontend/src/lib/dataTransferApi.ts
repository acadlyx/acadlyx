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
export async function commitImport(type: DataType, file: File): Promise<ImportCommitResult> {
  const form = new FormData();
  form.append("file", file);
  const body = await authedFetch<{ data: ImportCommitResult }>(`/imports/${type}/commit`, {
    method: "POST",
    body: form,
  });
  return body.data;
}

export async function exportData(type: DataType, format: "xlsx" | "csv") {
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
    : "text/csv";
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

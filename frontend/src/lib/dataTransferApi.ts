import { API_BASE_URL, API_VERSION } from "./api";
import { getAccessToken } from "./auth";

export const DATA_TYPES = [
  "users", "students", "faculty", "campuses", "departments", "programs",
  "academic-years", "semesters", "sections", "courses", "course-offerings", "exams",
  "marks", "attendance", "fees", "fee-payments", "fee-structures", "notices",
  "timetable", "parent-links",
] as const;

export type DataType = typeof DATA_TYPES[number];

export async function previewImport(type: DataType, file: File) {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${API_BASE_URL}/api/${API_VERSION}/imports/${type}/preview`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getAccessToken() || ""}` },
    body: form,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error?.message || `Import preview failed (${response.status})`);
  return body.data;
}

export async function commitImport(type: DataType, file: File) {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${API_BASE_URL}/api/${API_VERSION}/imports/${type}/commit`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getAccessToken() || ""}` },
    body: form,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error?.message || `Import failed (${response.status})`);
  return body.data;
}

export async function exportData(type: DataType, format: "xlsx" | "csv") {
  const response = await fetch(`${API_BASE_URL}/api/${API_VERSION}/exports/${type}?format=${format}`, {
    headers: { Authorization: `Bearer ${getAccessToken() || ""}` },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error?.message || `Export failed (${response.status})`);
  }
  const blob = await response.blob();
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

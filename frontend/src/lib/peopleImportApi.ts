import { authedFetch } from "./auth";
import type { Envelope } from "./httpShared";

export type PeopleImportType = "students" | "faculty" | "staff";

export interface PeopleImportPreview {
  type: PeopleImportType;
  totalRows: number;
  validRows: number;
  errors: Array<{ row: number; message: string }>;
  canCommit: boolean;
  sample: Record<string, unknown>[];
}

async function request(type: PeopleImportType, action: "preview" | "commit", file: File) {
  const form = new FormData();
  form.append("file", file);
  const response = await authedFetch<Envelope<unknown>>(`/people-imports/${type}/${action}`, {
    method: "POST",
    body: form,
  });
  return response.data;
}

export function previewPeopleImport(type: PeopleImportType, file: File) {
  return request(type, "preview", file) as Promise<PeopleImportPreview>;
}

export function commitPeopleImport(type: PeopleImportType, file: File) {
  return request(type, "commit", file) as Promise<{ imported: number; failed: number; type: PeopleImportType }>;
}

export const PEOPLE_IMPORT_TEMPLATES: Record<PeopleImportType, string[]> = {
  students: ["email", "firstName", "lastName", "phone", "password", "admissionNumber", "rollNumber", "programCode", "academicYear", "section", "dateOfBirth", "gender", "bloodGroup", "nationality", "address", "city", "state", "postalCode", "guardianName", "guardianPhone", "guardianEmail", "admissionDate", "status"],
  faculty: ["email", "firstName", "lastName", "phone", "password", "employeeCode", "departmentCode", "designation", "employmentType", "joiningDate", "qualification", "address", "emergencyContactName", "emergencyContactPhone", "status"],
  staff: ["email", "firstName", "lastName", "phone", "password", "employeeCode", "departmentCode", "role", "designation", "employmentType", "joiningDate", "qualification", "address", "emergencyContactName", "emergencyContactPhone", "status"],
};

export function downloadPeopleTemplate(type: PeopleImportType) {
  const columns = PEOPLE_IMPORT_TEMPLATES[type];
  const csv = `${columns.join(",")}\n`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `acadlyx-${type}-import-template.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

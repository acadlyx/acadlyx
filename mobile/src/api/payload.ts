export type UnknownRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function toCollection(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return value === null || value === undefined ? [] : [{ value }];

  for (const key of ["items", "records", "results", "notifications", "students", "data"]) {
    const candidate = value[key];
    if (Array.isArray(candidate)) return candidate;
  }

  for (const candidate of Object.values(value)) {
    if (Array.isArray(candidate)) return candidate;
  }
  return Object.keys(value).length ? [value] : [];
}

export function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  try { return JSON.stringify(value); } catch { return "Available"; }
}

export function safeRecordEntries(value: unknown): Array<[string, unknown]> {
  if (!isRecord(value)) return [["Value", value]];
  return Object.entries(value).filter(([key]) => {
    if (/password|token|secret|credential|salt|hash/i.test(key)) return false;
    if (key === "id" || /Id$/.test(key) || /_id$/.test(key)) return false;
    return true;
  });
}

export function recordTitle(value: unknown, fallback: string): string {
  if (!isRecord(value)) return displayValue(value);
  for (const key of ["title", "name", "fullName", "displayName", "subject", "code", "email", "firstName"]) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }
  return fallback;
}
/** Canonical tenant modules. Feature keys are intentionally independent of RBAC permission keys. */
export const TENANT_FEATURES = [
  "students", "faculty", "attendance", "timetable", "exams", "results",
  "assignments", "fees", "payments", "parent_portal", "notices",
  "notifications", "reports", "import_export", "cms", "documents",
  "analytics", "intelligence", "placements",
  "admissions", "hr", "leave", "library", "calendar", "registration",
  "promotions", "certificates", "audit",
  "lms", "operations",
] as const;

export type TenantFeature = typeof TENANT_FEATURES[number];

export function isTenantFeature(value: string): value is TenantFeature {
  return (TENANT_FEATURES as readonly string[]).includes(value);
}

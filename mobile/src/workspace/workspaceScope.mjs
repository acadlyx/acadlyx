const DIMENSIONS = [
  "campusId", "departmentId", "programId", "academicYearId", "batchId", "semesterId", "sectionId"
];

let activeScope = {};
let previousScope = {};

export function setActiveWorkspaceContext(scope) {
  previousScope = activeScope;
  const next = {};
  if (scope && typeof scope === "object") {
    for (const key of DIMENSIONS) {
      const value = scope[key];
      if (typeof value === "string" && value.trim()) next[key] = value;
    }
  }
  activeScope = next;
}

/**
 * Adds only fields accepted by the exact list contract for the requested path.
 * Current workspace scope wins over an older query parameter. When a dimension
 * is cleared, remove a stale parameter only if it matches the prior scope,
 * preserving independent UI filters.
 */
export function applyWorkspaceContext(path, enabled) {
  if (!enabled || /^https?:\/\//i.test(path)) return path;

  const separator = path.indexOf("?");
  const pathname = separator >= 0 ? path.slice(0, separator) : path;
  const route = pathname.replace(/^\/+/, "").replace(/\/+$/, "");
  if (route === "auth" || route.startsWith("auth/") ||
      route === "workspace/context" || route.startsWith("workspace/context/")) return path;

  const acceptedFields = {
    departments: ["campusId"],
    programs: ["campusId", "departmentId"],
    courses: ["campusId", "departmentId"],
    "academic-years": ["campusId", "departmentId", "programId"],
    batches: ["campusId", "departmentId", "programId"],
    semesters: ["campusId", "programId", "departmentId", "academicYearId"],
    sections: ["campusId", "semesterId", "departmentId"],
    "course-offerings": ["campusId", "semesterId", "sectionId", "departmentId"],
    students: ["campusId", "departmentId", "programId", "academicYearId", "batchId", "semesterId", "sectionId"]
  };
  const routeParts = route.split("/");
  const fields = routeParts.length === 1 ? acceptedFields[routeParts[0]] : undefined;
  if (!fields) return path;

  const params = new URLSearchParams(separator >= 0 ? path.slice(separator + 1) : "");
  for (const key of fields) {
    const value = activeScope[key];
    if (typeof value === "string" && value) {
      params.set(key, value);
      continue;
    }
    const previous = previousScope[key];
    if (typeof previous === "string" && previous && params.get(key) === previous) {
      params.delete(key);
    }
  }
  const query = params.toString();
  return query ? pathname + "?" + query : pathname;
}

/**
 * Make changing scope an ordered cache transition:
 * cancel old in-flight reads, activate/persist the server-validated scope,
 * then reset all queries. Active screens refetch using the new scope; inactive
 * screens cannot render their previous cached records when reopened.
 */
export async function transitionWorkspaceContext(queryClient, activateScope, persistScope) {
  await queryClient.cancelQueries();
  activateScope();
  await persistScope();
  await queryClient.resetQueries();
}

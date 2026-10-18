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
    students: ["campusId", "departmentId", "programId", "academicYearId", "batchId", "semesterId", "sectionId"],
    assignments: ["campusId", "departmentId", "programId", "academicYearId", "batchId", "semesterId", "sectionId"],
    "attendance-sessions": ["campusId", "departmentId", "programId", "academicYearId", "batchId", "semesterId", "sectionId"],
    "internal-marks": ["campusId", "departmentId", "programId", "academicYearId", "batchId", "semesterId", "sectionId"],
    "erp/timetable": ["campusId", "departmentId", "programId", "academicYearId", "batchId", "semesterId", "sectionId"]
  };
  const routeParts = route.split("/");
  const fields = route === "erp/timetable" ? acceptedFields[route] :
    routeParts.length === 1 ? acceptedFields[routeParts[0]] : undefined;
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
  // Clear old record values while retaining active observers. Waiting to reset
  // until after SecureStore writes leaves a short window where the new scope
  // label can render above records from the previous scope.
  for (const query of queryClient.getQueryCache().getAll()) query.reset();
  activateScope();
  await persistScope();
  // Active observers refetch after the server-validated scope is active.
  await queryClient.invalidateQueries({ refetchType: "active" });
}

/** Stable cache-boundary key for account and effective-authority transitions. */
export function getAuthorizationShape(user) {
  if (!user) return "anonymous";
  return String(user.id || "anonymous") + ":" +
    (user.roles || []).slice().sort().join(",") + ":" +
    (user.permissions || []).slice().sort().join(",");
}

/**
 * The same QueryClient backs screens and the workspace provider. Clear both
 * its in-memory records and the module-level scope filter before the next
 * authorization shape is allowed to render.
 */
export async function resetAuthorizationState(queryClient, clearActiveScope) {
  await queryClient.cancelQueries();
  clearActiveScope();
  queryClient.clear();
}

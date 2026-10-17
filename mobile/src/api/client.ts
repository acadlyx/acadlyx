import * as SecureStore from "expo-secure-store";

const RAW_API_ORIGIN = process.env.EXPO_PUBLIC_API_URL || "https://acadlyx-api.onrender.com";
export const API_ORIGIN = RAW_API_ORIGIN.trim().replace(/\/+$/, "").replace(/\/api\/v1$/, "");
export const API_BASE_URL = API_ORIGIN + "/api/v1";

const ACCESS_TOKEN_KEY = "acadlyx_access_token";
const REFRESH_TOKEN_KEY = "acadlyx_refresh_token";
const DEFAULT_TIMEOUT_MS = 30000;

export type AuthTokens = { accessToken: string; refreshToken: string; expiresIn?: string };
export type WorkspaceContextIds = {
  campusId?: string | null;
  departmentId?: string | null;
  programId?: string | null;
  academicYearId?: string | null;
  batchId?: string | null;
  semesterId?: string | null;
  sectionId?: string | null;
};

let activeWorkspaceContext: WorkspaceContextIds = {};

export function setActiveWorkspaceContext(scope?: WorkspaceContextIds | null): void {
  activeWorkspaceContext = {};
  if (!scope) return;
  for (const key of ["campusId", "departmentId", "programId", "academicYearId", "batchId", "semesterId", "sectionId"] as const) {
    const value = scope[key];
    if (typeof value === "string" && value.trim()) activeWorkspaceContext[key] = value;
  }
}

function applyWorkspaceContext(path: string, enabled: boolean): string {
  if (!enabled || /^https?:\/\//i.test(path)) return path;
  const separator = path.indexOf("?");
  const pathname = separator >= 0 ? path.slice(0, separator) : path;
  const route = pathname.replace(/^\/+/, "").replace(/\/+$/, "");
  if (route === "auth" || route.startsWith("auth/") ||
      route === "workspace/context" || route.startsWith("workspace/context/")) return path;

  // Only propagate fields explicitly accepted by each strict list-query contract.
  // This avoids breaking unrelated endpoints with Zod strict query validation.
  const acceptedFields: Record<string, readonly (keyof WorkspaceContextIds)[]> = {
    departments: ["campusId"],
    programs: ["departmentId"],
    courses: ["departmentId"],
    batches: ["programId"],
    semesters: ["programId", "departmentId", "academicYearId"],
    sections: ["semesterId", "departmentId"],
    "course-offerings": ["semesterId", "sectionId", "departmentId"],
    students: ["departmentId", "programId", "academicYearId", "semesterId", "sectionId"]
  };
  const routeParts = route.split("/");
  const listRoute = routeParts.length === 1 ? routeParts[0] : "";
  const fields = acceptedFields[listRoute];
  if (!fields) return path;

  const params = new URLSearchParams(separator >= 0 ? path.slice(separator + 1) : "");
  for (const key of fields) {
    const value = activeWorkspaceContext[key];
    if (typeof value === "string" && value && !params.has(key)) params.set(key, value);
  }
  const query = params.toString();
  return query ? pathname + "?" + query : pathname;
}
type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  error?: { message?: string; code?: string; requestId?: string };
};
export type ApiRequestOptions = RequestInit & {
  auth?: boolean;
  timeoutMs?: number;
  retryOnUnauthorized?: boolean;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;
  constructor(message: string, status: number, code = "REQUEST_FAILED", requestId?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

let refreshInFlight: Promise<boolean> | null = null;

export async function getAccessToken(): Promise<string | null> {
  try { return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY); } catch { return null; }
}
export async function getRefreshToken(): Promise<string | null> {
  try { return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY); } catch { return null; }
}
export async function storeTokens(tokens: AuthTokens): Promise<void> {
  if (!tokens.accessToken || !tokens.refreshToken) throw new Error("The authentication service returned an incomplete session.");
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken)
  ]);
}
export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY).catch(() => undefined),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch(() => undefined)
  ]);
}

function parseJson(text: string): unknown {
  if (!text) return null;
  try { return JSON.parse(text) as unknown; } catch { return null; }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number, parentSignal?: AbortSignal | null): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onParentAbort = () => controller.abort();
  if (parentSignal?.aborted) controller.abort();
  else parentSignal?.addEventListener("abort", onParentAbort, { once: true });
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError("The server took too long to respond. Check your connection and try again.", 408, "TIMEOUT");
    }
    throw new ApiError("Could not reach ACADLYX. Check your connection and try again.", 0, "NETWORK_ERROR");
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener("abort", onParentAbort);
  }
}

function makeIdempotencyKey(): string {
  const randomPart = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  return "acadlyx-mobile-" + Date.now().toString(36) + "-" + randomPart;
}

async function refreshSession(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) { await clearTokens(); return false; }
    try {
      const response = await fetchWithTimeout(API_BASE_URL + "/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ refreshToken })
      }, 15000);
      const parsed = parseJson(await response.text()) as ApiEnvelope<{ tokens?: AuthTokens }> | null;
      const tokens = parsed?.data?.tokens;
      if (!response.ok || !tokens?.accessToken || !tokens?.refreshToken) {
        await clearTokens();
        return false;
      }
      await storeTokens(tokens);
      return true;
    } catch {
      await clearTokens();
      return false;
    }
  })().finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}

async function performRequest<T>(path: string, options: ApiRequestOptions, mayRefresh: boolean): Promise<T> {
  const { auth = true, timeoutMs = DEFAULT_TIMEOUT_MS, retryOnUnauthorized = true, signal: parentSignal, ...init } = options;
  const method = (init.method || "GET").toUpperCase();
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");

  if (init.body !== undefined && init.body !== null && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  if (auth) {
    const token = await getAccessToken();
    if (token) headers.set("Authorization", "Bearer " + token);
  }
  if (method !== "GET" && !headers.has("X-Idempotency-Key")) headers.set("X-Idempotency-Key", makeIdempotencyKey());

  const requestPath = applyWorkspaceContext(path, auth && method === "GET");
  const response = await fetchWithTimeout(
    API_BASE_URL + (requestPath.startsWith("/") ? requestPath : "/" + requestPath),
    { ...init, method, headers },
    timeoutMs,
    parentSignal
  );
  const parsed = parseJson(await response.text()) as ApiEnvelope<T> | null;

  if (response.status === 401 && auth && retryOnUnauthorized && mayRefresh) {
    if (await refreshSession()) return performRequest<T>(path, { ...options, retryOnUnauthorized: false }, false);
    await clearTokens();
  }

  if (!response.ok || parsed?.success === false) {
    const message = parsed?.error?.message || (
      response.status === 401 ? "Your session has expired. Please sign in again." :
      response.status === 403 ? "ACADLYX denied this request for your current permissions or scope." :
      response.status >= 500 ? "ACADLYX is temporarily unavailable. Please try again." :
      "The request could not be completed."
    );
    throw new ApiError(message, response.status, parsed?.error?.code || "REQUEST_FAILED", parsed?.error?.requestId);
  }

  if (parsed?.success === true && Object.prototype.hasOwnProperty.call(parsed, "data")) return parsed.data as T;
  return parsed as T;
}

export function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  return performRequest<T>(path, options, true);
}
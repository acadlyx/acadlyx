import * as SecureStore from "expo-secure-store";
import { File, Paths } from "expo-file-system";
import { applyWorkspaceContext, setActiveWorkspaceContext } from "../workspace/workspaceScope.mjs";
export { setActiveWorkspaceContext };
export type { WorkspaceContextIds } from "../workspace/workspaceScope.mjs";

const RAW_API_ORIGIN = process.env.EXPO_PUBLIC_API_URL || "https://acadlyx-api.onrender.com";
export const API_ORIGIN = RAW_API_ORIGIN.trim().replace(/\/+$/, "").replace(/\/api\/v1$/, "");
export const API_BASE_URL = API_ORIGIN + "/api/v1";

const ACCESS_TOKEN_KEY = "acadlyx_access_token";
const REFRESH_TOKEN_KEY = "acadlyx_refresh_token";
const DEFAULT_TIMEOUT_MS = 30000;

export type AuthTokens = { accessToken: string; refreshToken: string; expiresIn?: string };
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

  const isMultipartBody = typeof FormData !== "undefined" && init.body instanceof FormData;
  if (init.body !== undefined && init.body !== null && !headers.has("Content-Type") && !isMultipartBody) headers.set("Content-Type", "application/json");

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

/**
 * Download an authenticated PDF into the app cache. This uses the same
 * access-token refresh flow as JSON requests, and validates the response
 * before handing bytes to the native viewer.
 */
export async function apiDownloadPdf(path: string, filename: string): Promise<File> {
  const requestPath = applyWorkspaceContext(path, true);
  const url = API_BASE_URL + (requestPath.startsWith("/") ? requestPath : "/" + requestPath);

  const request = async (mayRefresh: boolean): Promise<Response> => {
    const token = await getAccessToken();
    const headers = new Headers({ Accept: "application/pdf" });
    if (token) headers.set("Authorization", "Bearer " + token);
    const response = await fetchWithTimeout(url, { method: "GET", headers }, DEFAULT_TIMEOUT_MS);
    if (response.status === 401 && mayRefresh) {
      if (await refreshSession()) return request(false);
      await clearTokens();
      throw new ApiError("Your session has expired. Please sign in again.", 401, "SESSION_EXPIRED");
    }
    return response;
  };

  const response = await request(true);
  if (!response.ok) {
    const parsed = parseJson(await response.text()) as ApiEnvelope<unknown> | null;
    const message = parsed?.error?.message || (
      response.status === 403 ? "ACADLYX denied this download for your current permissions or scope." :
      response.status >= 500 ? "ACADLYX is temporarily unavailable. Please try again." :
      "The PDF download could not be completed."
    );
    throw new ApiError(message, response.status, parsed?.error?.code || "DOWNLOAD_FAILED", parsed?.error?.requestId);
  }

  const contentType = (response.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
  if (contentType !== "application/pdf") {
    throw new ApiError("The server did not return a PDF document.", 502, "INVALID_DOWNLOAD_TYPE");
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length < 500 || String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) !== "%PDF") {
    throw new ApiError("The downloaded file is not a valid PDF.", 502, "INVALID_PDF");
  }

  const safeName = (filename || "ACADLYX_Marksheet.pdf").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
  const withExtension = safeName.toLowerCase().endsWith(".pdf") ? safeName : safeName + ".pdf";
  const file = new File(Paths.cache, Date.now().toString(36) + "_" + withExtension);
  file.create();
  await file.write(bytes);
  return file;
}

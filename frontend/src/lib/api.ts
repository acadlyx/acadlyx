/**
 * Central API configuration and fast client request layer.
 *
 * GET requests are briefly cached and de-duplicated in memory. Mutations
 * invalidate the cache and automatically receive an idempotency key so
 * retries from the same request are safe. Callers may provide a stable
 * X-Idempotency-Key when a user action can be retried across renders/network
 * recovery.
 */

const defaultApiUrl = process.env.NODE_ENV === "production" ? "https://acadlyx-api.onrender.com" : "http://localhost:5001";
export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || defaultApiUrl).replace(/\/$/, "");
export const API_VERSION = "v1";

const PUBLIC_REQUEST_TIMEOUT_MS = 30_000;
const GET_CACHE_TTL_MS = 5_000;

type CachedResponse = { expiresAt: number; value: unknown };
const getCache = new Map<string, CachedResponse>();
const getInflight = new Map<string, Promise<unknown>>();

function createIdempotencyKey(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto?.getRandomValues?.(bytes);
  const suffix = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  return `acadlyx-${Date.now().toString(36)}-${suffix || Math.random().toString(36).slice(2)}`;
}

export function createMutationKey(prefix = "mutation"): string {
  return `${prefix}:${createIdempotencyKey()}`;
}

export function apiUrl(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}/api/${API_VERSION}${cleanPath}`;
}

export interface ApiSuccess<T> {
  success: true;
  [key: string]: unknown;
  data?: T;
}

export interface ApiError {
  success: false;
  error: { message: string; requestId?: string };
}

export class ApiRequestTimeoutError extends Error {
  constructor(message = "The server took too long to respond. Please try again.") {
    super(message);
    this.name = "ApiRequestTimeoutError";
  }
}

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit, timeoutMs = PUBLIC_REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  let removeParentAbortListener: (() => void) | null = null;
  if (init?.signal) {
    if (init.signal.aborted) controller.abort();
    else {
      const handleParentAbort = () => controller.abort();
      init.signal.addEventListener("abort", handleParentAbort, { once: true });
      removeParentAbortListener = () => init.signal?.removeEventListener("abort", handleParentAbort);
    }
  }

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut && error instanceof Error && error.name === "AbortError") throw new ApiRequestTimeoutError();
    throw error;
  } finally {
    window.clearTimeout(timer);
    removeParentAbortListener?.();
  }
}

export function invalidateApiCache(pathPrefix?: string): void {
  if (!pathPrefix) {
    getCache.clear();
    return;
  }
  for (const key of getCache.keys()) {
    if (key.includes(pathPrefix)) getCache.delete(key);
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method || "GET").toUpperCase();
  const url = apiUrl(path);
  const cacheable = method === "GET" && !init?.body;
  const cacheKey = `${method}:${url}`;

  if (cacheable) {
    const cached = getCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value as T;
    if (cached) getCache.delete(cacheKey);

    const existing = getInflight.get(cacheKey);
    if (existing) return existing as Promise<T>;
  }

  const request = (async () => {
    const incomingHeaders = new Headers(init?.headers);
    if (!incomingHeaders.has("Content-Type") && init?.body) {
      incomingHeaders.set("Content-Type", "application/json");
    }

    if (!cacheable && !incomingHeaders.has("X-Idempotency-Key")) {
      incomingHeaders.set("X-Idempotency-Key", createIdempotencyKey());
    }

    const res = await fetchWithTimeout(url, {
      ...init,
      headers: incomingHeaders,
    });

    const body = (await res.json().catch(() => null)) as ApiError | null;
    if (!res.ok) throw new Error(body?.error?.message || `Request failed: ${res.status}`);

    if (!cacheable) invalidateApiCache();
    if (cacheable) getCache.set(cacheKey, { expiresAt: Date.now() + GET_CACHE_TTL_MS, value: body });
    return body as T;
  })();

  if (cacheable) {
    getInflight.set(cacheKey, request);
    try {
      return await request;
    } finally {
      getInflight.delete(cacheKey);
    }
  }

  return request;
}

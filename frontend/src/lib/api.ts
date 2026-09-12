/**
 * Central API configuration.
 * All future data-fetching code should build request URLs from
 * here instead of hard-coding the backend origin.
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export const API_VERSION = "v1";

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
  error: {
    message: string;
  };
}

/**
 * Minimal fetch wrapper. Auth headers / token refresh logic will be
 * added in Phase 1 without changing this function's call sites.
 */
export async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(apiUrl(path), {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiError | null;
    throw new Error(body?.error?.message || `Request failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

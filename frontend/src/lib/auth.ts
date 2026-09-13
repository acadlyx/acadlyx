import { apiUrl } from "./api";

/**
 * Token storage + the login/refresh/logout flow.
 *
 * Decision (deferred from Phase 1): tokens are kept in localStorage
 * for this MVP so the student portal is testable without a backend
 * session store. This is a known trade-off — an httpOnly cookie is
 * the production-appropriate home for the refresh token — tracked
 * for revisiting in Phase 14 (production hardening), not silently
 * treated as final.
 */

const ACCESS_TOKEN_KEY = "acadlyx_access_token";
const REFRESH_TOKEN_KEY = "acadlyx_refresh_token";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface AuthUser {
  id: string;
  institutionId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions: string[];
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export async function getCurrentUser(): Promise<AuthUser> {
  const response = await authedFetch<ApiEnvelope<AuthUser>>("/auth/me");
  if (!Array.isArray(response.data.roles) || !Array.isArray(response.data.permissions)) {
    throw new Error("Invalid authenticated user response");
  }
  return response.data;
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function getAccessToken(): string | null {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(tokens: AuthTokens): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export function clearTokens(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return getAccessToken() !== null;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await fetch(apiUrl("/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const body = (await res.json().catch(() => null)) as ApiEnvelope<{
    user: AuthUser;
    tokens: AuthTokens;
  }> | null;

  if (!res.ok || !body) {
    throw new Error(
      (body as unknown as { error?: { message?: string } })?.error?.message ||
        "Login failed"
    );
  }

  setTokens(body.data.tokens);
  return body.data.user;
}

export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  clearTokens();

  if (!refreshToken) return;

  try {
    await fetch(apiUrl("/auth/logout"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    // Logout is best-effort client-side once tokens are cleared locally.
  }
}

async function tryRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const res = await fetch(apiUrl("/auth/refresh"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      clearTokens();
      return false;
    }
    const body = (await res.json()) as ApiEnvelope<{ tokens: AuthTokens }>;
    setTokens(body.data.tokens);
    return true;
  } catch {
    clearTokens();
    return false;
  }
}

/**
 * Authenticated fetch wrapper: attaches the access token, and on a
 * 401 attempts exactly one silent refresh-and-retry before giving up.
 * Callers should catch AuthRequiredError and redirect to /login.
 */
export class AuthRequiredError extends Error {
  constructor() {
    super("Authentication required");
    this.name = "AuthRequiredError";
  }
}

export async function authedFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const performFetch = (token: string | null) =>
    fetch(apiUrl(path), {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers || {}),
      },
    });

  let token = getAccessToken();
  if (!token) throw new AuthRequiredError();

  let res = await performFetch(token);

  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (!refreshed) throw new AuthRequiredError();
    token = getAccessToken();
    res = await performFetch(token);
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(body?.error?.message || `Request failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

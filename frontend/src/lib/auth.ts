import { apiUrl } from "./api";

/**
 * Fast client-side authentication layer.
 *
 * Goals:
 * - Keep authentication isolated per browser tab.
 * - Never make page rendering wait for /auth/me when a trusted tab-local
 *   user snapshot is already available.
 * - Revalidate the user in the background so stale sessions are detected.
 * - Keep the access/refresh tokens out of localStorage.
 * - Cache successful read-only API responses in the browser Cache API so
 *   previously opened screens can render immediately while the database
 *   catches up in the background.
 */

const ACCESS_TOKEN_KEY = "acadlyx_access_token";
const REFRESH_TOKEN_KEY = "acadlyx_refresh_token";
const USER_CACHE_KEY = "acadlyx_current_user";
const TAB_ID_KEY = "acadlyx_tab_id";
const TAB_INITIALIZED_KEY = "acadlyx_tab_initialized";
const TAB_CHANNEL_NAME = "acadlyx_auth_tab_isolation";
const API_CACHE_NAME = "acadlyx-api-v1";
const API_CACHE_TTL_MS = 5 * 60 * 1000;
const API_CACHE_META_PREFIX = "acadlyx_api_cache_meta:";

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

interface CachedApiResponse {
  body: unknown;
  cachedAt: number;
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function getOrCreateTabId(): string | null {
  if (!isBrowser()) return null;

  let tabId = window.sessionStorage.getItem(TAB_ID_KEY);
  if (!tabId) {
    tabId = `${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2)}`;
    window.sessionStorage.setItem(TAB_ID_KEY, tabId);
  }
  return tabId;
}

function clearAuthStorage(): void {
  if (!isBrowser()) return;
  window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  window.sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  window.sessionStorage.removeItem(USER_CACHE_KEY);
}

function protectAgainstClonedSession(): void {
  if (!isBrowser()) return;

  const initialized =
    window.sessionStorage.getItem(TAB_INITIALIZED_KEY) === "1";
  const hasOpener = Boolean(window.opener);
  const copiedAccessToken = Boolean(
    window.sessionStorage.getItem(ACCESS_TOKEN_KEY)
  );

  if (!initialized && hasOpener && copiedAccessToken) {
    clearAuthStorage();
  }

  getOrCreateTabId();
  window.sessionStorage.setItem(TAB_INITIALIZED_KEY, "1");
}

if (isBrowser()) {
  protectAgainstClonedSession();

  try {
    const channel = new BroadcastChannel(TAB_CHANNEL_NAME);
    channel.addEventListener("message", (event) => {
      const currentTabId = getOrCreateTabId();
      if (!currentTabId) return;

      if (
        event.data?.type === "acadlyx-auth-cleared" &&
        event.data?.tabId !== currentTabId
      ) {
        // Do not sign another tab out. The channel exists only so future
        // authentication changes can be coordinated without sharing tokens.
      }
    });
  } catch {
    // BroadcastChannel is an optional optimization.
  }
}

export function getAccessToken(): string | null {
  if (!isBrowser()) return null;
  protectAgainstClonedSession();
  return window.sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (!isBrowser()) return null;
  protectAgainstClonedSession();
  return window.sessionStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(tokens: AuthTokens): void {
  if (!isBrowser()) return;
  protectAgainstClonedSession();
  window.sessionStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  window.sessionStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export function clearTokens(): void {
  if (!isBrowser()) return;

  clearAuthStorage();

  try {
    const channel = new BroadcastChannel(TAB_CHANNEL_NAME);
    channel.postMessage({
      type: "acadlyx-auth-cleared",
      tabId: getOrCreateTabId(),
    });
    channel.close();
  } catch {
    // Optional cross-tab notification only.
  }
}

export function isAuthenticated(): boolean {
  return getAccessToken() !== null;
}

export function getCachedCurrentUser(): AuthUser | null {
  if (!isBrowser()) return null;

  try {
    const raw = window.sessionStorage.getItem(USER_CACHE_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw) as AuthUser;

    if (
      !user ||
      typeof user.id !== "string" ||
      !Array.isArray(user.roles) ||
      !Array.isArray(user.permissions)
    ) {
      window.sessionStorage.removeItem(USER_CACHE_KEY);
      return null;
    }

    return user;
  } catch {
    window.sessionStorage.removeItem(USER_CACHE_KEY);
    return null;
  }
}

function cacheCurrentUser(user: AuthUser): void {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
  } catch {
    // A full/disabled sessionStorage must never block authentication.
  }
}

export async function getCurrentUser(options?: {
  background?: boolean;
}): Promise<AuthUser> {
  const cached = getCachedCurrentUser();

  if (options?.background && cached) {
    void revalidateCurrentUser();
    return cached;
  }

  const response = await authedFetch<ApiEnvelope<AuthUser>>("/auth/me", {
    cacheMode: "no-store",
  });

  if (
    !Array.isArray(response.data.roles) ||
    !Array.isArray(response.data.permissions)
  ) {
    throw new Error("Invalid authenticated user response");
  }

  cacheCurrentUser(response.data);
  return response.data;
}

async function revalidateCurrentUser(): Promise<void> {
  try {
    const response = await authedFetch<ApiEnvelope<AuthUser>>("/auth/me", {
      cacheMode: "no-store",
    });

    if (
      Array.isArray(response.data.roles) &&
      Array.isArray(response.data.permissions)
    ) {
      cacheCurrentUser(response.data);
    }
  } catch (error) {
    if (error instanceof AuthRequiredError && isBrowser()) {
      clearTokens();
      window.sessionStorage.removeItem(USER_CACHE_KEY);
      window.dispatchEvent(new CustomEvent("acadlyx-auth-invalid"));
    }
  }
}

export type LoginResult =
  | { mfaRequired: false; user: AuthUser }
  | { mfaRequired: true; challengeToken: string; expiresAt: string };

interface LoginPayload {
  mfaRequired?: boolean;
  challengeToken?: string;
  expiresAt?: string;
  user?: AuthUser;
  tokens?: AuthTokens;
}

export async function login(
  email: string,
  password: string
): Promise<LoginResult> {
  const res = await fetch(apiUrl("/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const body = (await res
    .json()
    .catch(() => null)) as ApiEnvelope<LoginPayload> | null;

  if (!res.ok || !body) {
    throw new Error(
      (body as unknown as { error?: { message?: string } })?.error?.message ||
        "Login failed"
    );
  }

  if (body.data.mfaRequired && body.data.challengeToken) {
    return {
      mfaRequired: true,
      challengeToken: body.data.challengeToken,
      expiresAt: body.data.expiresAt ?? "",
    };
  }

  if (!body.data.tokens || !body.data.user) {
    throw new Error("Login response was incomplete");
  }

  setTokens(body.data.tokens);
  cacheCurrentUser(body.data.user);

  return { mfaRequired: false, user: body.data.user };
}

export async function completeMfaLogin(
  challengeToken: string,
  code: string
): Promise<AuthUser> {
  const res = await fetch(apiUrl("/auth/mfa/verify"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ challengeToken, code }),
  });

  const body = (await res.json().catch(() => null)) as ApiEnvelope<{
    user: AuthUser;
    tokens: AuthTokens;
  }> | null;

  if (!res.ok || !body) {
    throw new Error(
      (body as unknown as { error?: { message?: string } })?.error?.message ||
        "Verification failed"
    );
  }

  setTokens(body.data.tokens);
  cacheCurrentUser(body.data.user);
  return body.data.user;
}

async function deleteApiCache(): Promise<void> {
  if (!isBrowser() || !("caches" in window)) return;

  try {
    await caches.delete(API_CACHE_NAME);
  } catch {
    // Cache cleanup is best-effort.
  }
}

export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  clearTokens();
  await deleteApiCache();

  if (!refreshToken) return;

  try {
    await fetch(apiUrl("/auth/logout"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      keepalive: true,
    });
  } catch {
    // Logout is best-effort after local credentials are removed.
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

    const body = (await res.json()) as ApiEnvelope<{
      tokens: AuthTokens;
    }>;

    setTokens(body.data.tokens);
    return true;
  } catch {
    clearTokens();
    return false;
  }
}

export class AuthRequiredError extends Error {
  constructor() {
    super("Authentication required");
    this.name = "AuthRequiredError";
  }
}

function isReadRequest(init?: RequestInit): boolean {
  return !init?.method || init.method.toUpperCase() === "GET";
}

function getCacheKey(path: string, token: string): string {
  // The access token is never written into the cache URL. A short stable
  // fingerprint is enough to prevent cached responses being mixed between
  // authenticated sessions.
  let hash = 5381;
  for (let index = 0; index < token.length; index += 1) {
    hash = (hash * 33) ^ token.charCodeAt(index);
  }
  const fingerprint = (hash >>> 0).toString(36);
  return `${apiUrl(path)}${path.includes("?") ? "&" : "?"}__acadlyx_cache=${fingerprint}`;
}

async function readCachedApi<T>(
  path: string,
  token: string
): Promise<T | null> {
  if (!isBrowser() || !("caches" in window)) return null;

  try {
    const cache = await caches.open(API_CACHE_NAME);
    const key = getCacheKey(path, token);
    const response = await cache.match(key);
    if (!response) return null;

    const meta = response.headers.get("x-acadlyx-cached-at");
    const cachedAt = Number(meta || 0);
    if (!cachedAt || Date.now() - cachedAt > API_CACHE_TTL_MS) {
      await cache.delete(key);
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function writeCachedApi<T>(
  path: string,
  token: string,
  body: T
): Promise<void> {
  if (!isBrowser() || !("caches" in window)) return;

  try {
    const cache = await caches.open(API_CACHE_NAME);
    const key = getCacheKey(path, token);
    const response = new Response(JSON.stringify(body), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "x-acadlyx-cached-at": String(Date.now()),
      },
    });
    await cache.put(key, response);
  } catch {
    // Cache is an optimization, never a source of request failure.
  }
}

async function performAuthenticatedFetch(
  path: string,
  token: string,
  init?: RequestInit
): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type") && !(init?.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("Authorization", `Bearer ${token}`);

  return fetch(apiUrl(path), {
    ...init,
    headers,
  });
}

export async function authedFetch<T = unknown>(
  path: string,
  init?: RequestInit & { cacheMode?: "default" | "no-store" }
): Promise<T> {
  const token = getAccessToken();
  if (!token) throw new AuthRequiredError();

  const { cacheMode, ...requestInit } = init || {};
  const shouldCache =
    cacheMode !== "no-store" && isReadRequest(requestInit);

  if (shouldCache) {
    const cached = await readCachedApi<T>(path, token);

    if (cached !== null) {
      // Refresh the cache without making the current screen wait for the DB.
      void (async () => {
        try {
          const freshResponse = await performAuthenticatedFetch(
            path,
            token,
            requestInit
          );

          if (freshResponse.status === 401) return;
          if (!freshResponse.ok) return;

          const freshBody = (await freshResponse.json()) as T;
          await writeCachedApi(path, token, freshBody);
        } catch {
          // Stale data remains usable until the next successful refresh.
        }
      })();

      return cached;
    }
  }

  let activeToken = token;
  let res = await performAuthenticatedFetch(
    path,
    activeToken,
    requestInit
  );

  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (!refreshed) throw new AuthRequiredError();

    activeToken = getAccessToken() || "";
    res = await performAuthenticatedFetch(
      path,
      activeToken,
      requestInit
    );
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(
      body?.error?.message || `Request failed: ${res.status}`
    );
  }

  const body = (await res.json()) as T;

  if (shouldCache) {
    void writeCachedApi(path, activeToken, body);
  }

  return body;
}

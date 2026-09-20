"use client";

const ACCESS_TOKEN_KEY = "acadlyx_access_token";
const REFRESH_TOKEN_KEY = "acadlyx_refresh_token";

const TAB_ID_KEY = "acadlyx_tab_id";
const TAB_INITIALIZED_KEY = "acadlyx_tab_initialized";

const TAB_CHANNEL_NAME = "acadlyx_auth_tab_isolation";

export interface AuthUser {
  id: string;
  institutionId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
}

export class AuthRequiredError extends Error {
  constructor(message = "Authentication required") {
    super(message);
    this.name = "AuthRequiredError";
  }
}

let protectionPromise: Promise<void> | null = null;
let protectionCompleted = false;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function getSessionStorage(): Storage | null {
  if (!isBrowser()) {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function getLocalStorage(): Storage | null {
  if (!isBrowser()) {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function createRandomId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function ensureTabId(): string {
  const storage = getSessionStorage();

  if (!storage) {
    return createRandomId();
  }

  try {
    const existing = storage.getItem(TAB_ID_KEY);

    if (existing) {
      return existing;
    }

    const id = createRandomId();
    storage.setItem(TAB_ID_KEY, id);

    return id;
  } catch {
    return createRandomId();
  }
}

function getStoredTabId(): string | null {
  const storage = getSessionStorage();

  if (!storage) {
    return null;
  }

  try {
    return storage.getItem(TAB_ID_KEY);
  } catch {
    return null;
  }
}

function getAccessTokenUnsafe(): string | null {
  const storage = getSessionStorage();

  if (!storage) {
    return null;
  }

  try {
    return storage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

function getRefreshTokenUnsafe(): string | null {
  const storage = getSessionStorage();

  if (!storage) {
    return null;
  }

  try {
    return storage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

function clearLegacyLocalStorageTokens(): void {
  const storage = getLocalStorage();

  if (!storage) {
    return;
  }

  try {
    /*
     * Older versions of the application stored authentication
     * tokens in localStorage.
     *
     * Remove ONLY authentication keys.
     * Do not clear unrelated application storage.
     */
    storage.removeItem(ACCESS_TOKEN_KEY);
    storage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    // Ignore storage access errors.
  }
}

function clearSessionTokens(): void {
  const storage = getSessionStorage();

  if (!storage) {
    return;
  }

  try {
    storage.removeItem(ACCESS_TOKEN_KEY);
    storage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    // Ignore storage access errors.
  }
}

function tokenFingerprint(token: string | null): string {
  if (!token) {
    return "";
  }

  /*
   * We do not need cryptographic hashing here.
   *
   * This value is only used as a short in-memory/tab
   * coordination identifier and is never sent to the server.
   */
  let hash = 2166136261;

  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (
    hash >>> 0
  ).toString(16);
}

function broadcastTabState(): void {
  if (!isBrowser()) {
    return;
  }

  try {
    if (typeof BroadcastChannel === "undefined") {
      return;
    }

    const channel = new BroadcastChannel(
      TAB_CHANNEL_NAME,
    );

    channel.postMessage({
      type: "acadlyx-auth-tab-ready",
      tabId: ensureTabId(),
      tokenFingerprint: tokenFingerprint(
        getAccessTokenUnsafe(),
      ),
      timestamp: Date.now(),
    });

    channel.close();
  } catch {
    // BroadcastChannel is optional.
  }
}

/**
 * Protect against the browser copying sessionStorage
 * from an opener into a newly opened tab.
 *
 * IMPORTANT:
 * sessionStorage itself is still the actual token store.
 * localStorage is never used for authentication.
 *
 * A tab opened with an opener can inherit the opener's
 * sessionStorage. In that situation, we deliberately
 * clear the inherited authentication state so the new
 * tab starts unauthenticated.
 */
async function protectAgainstClonedSession(): Promise<void> {
  if (!isBrowser()) {
    return;
  }

  const storage = getSessionStorage();

  if (!storage) {
    return;
  }

  clearLegacyLocalStorageTokens();

  try {
    const initialized = storage.getItem(
      TAB_INITIALIZED_KEY,
    );

    /*
     * window.opener is the strongest browser-level signal
     * available to us for a newly opened browsing context.
     *
     * If this tab has an opener and inherited an authenticated
     * session, do not allow that authentication to carry into
     * the new tab.
     */
    if (
      window.opener &&
      getAccessTokenUnsafe()
    ) {
      clearSessionTokens();

      storage.setItem(
        TAB_INITIALIZED_KEY,
        "1",
      );

      ensureTabId();

      protectionCompleted = true;
      broadcastTabState();

      return;
    }

    /*
     * A normal first load gets a fresh tab marker.
     *
     * If a browser duplicated sessionStorage without exposing
     * an opener, the application cannot reliably distinguish
     * that browser operation using sessionStorage alone.
     * The explicit opener check handles the standard new-tab /
     * window.open cloning path.
     */
    if (!initialized) {
      storage.setItem(
        TAB_INITIALIZED_KEY,
        "1",
      );
    }

    ensureTabId();

    protectionCompleted = true;
    broadcastTabState();
  } catch {
    /*
     * Authentication must remain functional even when browser
     * storage APIs are restricted.
     */
    protectionCompleted = true;
  }
}

async function ensureTabProtection(): Promise<void> {
  if (protectionCompleted) {
    return;
  }

  if (!protectionPromise) {
    protectionPromise =
      protectAgainstClonedSession().finally(() => {
        protectionPromise = null;
      });
  }

  await protectionPromise;
}

export function getAccessToken(): string | null {
  if (!isBrowser()) {
    return null;
  }

  /*
   * Never read authentication tokens from localStorage.
   */
  return getAccessTokenUnsafe();
}

export function getRefreshToken(): string | null {
  if (!isBrowser()) {
    return null;
  }

  return getRefreshTokenUnsafe();
}

export function setTokens(tokens: AuthTokens): void {
  const storage = getSessionStorage();

  if (!storage) {
    return;
  }

  try {
    storage.setItem(
      ACCESS_TOKEN_KEY,
      tokens.accessToken,
    );

    if (tokens.refreshToken) {
      storage.setItem(
        REFRESH_TOKEN_KEY,
        tokens.refreshToken,
      );
    } else {
      storage.removeItem(REFRESH_TOKEN_KEY);
    }

    /*
     * Keep old localStorage authentication data removed.
     */
    clearLegacyLocalStorageTokens();

    broadcastTabState();
  } catch {
    throw new Error(
      "Unable to securely store authentication state in this browser.",
    );
  }
}

export function clearTokens(): void {
  clearSessionTokens();
  clearLegacyLocalStorageTokens();
}

export function isAuthenticated(): boolean {
  return Boolean(getAccessToken());
}

async function parseResponse<T>(
  response: Response,
): Promise<T> {
  const contentType =
    response.headers.get("content-type") || "";

  if (
    contentType.includes("application/json")
  ) {
    return (await response.json()) as T;
  }

  const text = await response.text();

  if (!text) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return {
      message: text,
    } as T;
  }
}

function getApiUrl(): string {
  const configured =
    process.env.NEXT_PUBLIC_API_URL;

  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  return "";
}

export async function getCurrentUser(): Promise<AuthUser> {
  await ensureTabProtection();

  const token = getAccessToken();

  if (!token) {
    throw new AuthRequiredError();
  }

  const response = await fetch(
    `${getApiUrl()}/api/v1/auth/me`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      credentials: "include",
      cache: "no-store",
    },
  );

  if (
    response.status === 401 ||
    response.status === 403
  ) {
    clearTokens();
    throw new AuthRequiredError(
      "Your session has expired. Please sign in again.",
    );
  }

  if (!response.ok) {
    const data =
      await parseResponse<{
        message?: string;
      }>(response);

    throw new Error(
      data.message ||
        "Unable to load the current user.",
    );
  }

  return parseResponse<AuthUser>(response);
}

async function refreshAccessToken(): Promise<string | null> {
  await ensureTabProtection();

  const refreshToken =
    getRefreshToken();

  if (!refreshToken) {
    return null;
  }

  const response = await fetch(
    `${getApiUrl()}/api/v1/auth/refresh`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        refreshToken,
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    clearTokens();
    return null;
  }

  const data =
    await parseResponse<{
      accessToken?: string;
      refreshToken?: string;
      tokens?: {
        accessToken?: string;
        refreshToken?: string;
      };
    }>(response);

  const accessToken =
    data.accessToken ||
    data.tokens?.accessToken;

  const newRefreshToken =
    data.refreshToken ||
    data.tokens?.refreshToken;

  if (!accessToken) {
    clearTokens();
    return null;
  }

  setTokens({
    accessToken,
    refreshToken:
      newRefreshToken || refreshToken,
  });

  return accessToken;
}

export async function authedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  await ensureTabProtection();

  let token = getAccessToken();

  if (!token) {
    throw new AuthRequiredError();
  }

  const makeRequest = (
    accessToken: string,
  ) => {
    const headers = new Headers(
      init.headers,
    );

    headers.set(
      "Authorization",
      `Bearer ${accessToken}`,
    );

    headers.set(
      "Accept",
      "application/json",
    );

    return fetch(input, {
      ...init,
      headers,
      credentials:
        init.credentials || "include",
      cache:
        init.cache || "no-store",
    });
  };

  let response =
    await makeRequest(token);

  if (response.status !== 401) {
    return response;
  }

  /*
   * One refresh attempt only.
   */
  const refreshed =
    await refreshAccessToken();

  if (!refreshed) {
    clearTokens();

    throw new AuthRequiredError(
      "Your session has expired. Please sign in again.",
    );
  }

  token = refreshed;

  response =
    await makeRequest(token);

  if (response.status === 401) {
    clearTokens();

    throw new AuthRequiredError(
      "Your session has expired. Please sign in again.",
    );
  }

  return response;
}

export async function login(
  email: string,
  password: string,
): Promise<
  | {
      requiresMfa: true;
      challengeId?: string;
      message?: string;
    }
  | {
      requiresMfa?: false;
      user?: AuthUser;
      accessToken?: string;
      refreshToken?: string;
    }
> {
  await ensureTabProtection();

  const response = await fetch(
    `${getApiUrl()}/api/v1/auth/login`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        email: email.trim(),
        password,
      }),
      cache: "no-store",
    },
  );

  const data =
    await parseResponse<{
      requiresMfa?: boolean;
      challengeId?: string;
      message?: string;
      accessToken?: string;
      refreshToken?: string;
      user?: AuthUser;
      tokens?: {
        accessToken?: string;
        refreshToken?: string;
      };
    }>(response);

  if (!response.ok) {
    throw new Error(
      data.message ||
        "Unable to sign in.",
    );
  }

  if (data.requiresMfa) {
    return {
      requiresMfa: true,
      challengeId:
        data.challengeId,
      message: data.message,
    };
  }

  const accessToken =
    data.accessToken ||
    data.tokens?.accessToken;

  const refreshToken =
    data.refreshToken ||
    data.tokens?.refreshToken;

  if (!accessToken) {
    throw new Error(
      "Login succeeded but no access token was returned.",
    );
  }

  setTokens({
    accessToken,
    refreshToken,
  });

  return {
    requiresMfa: false,
    user: data.user,
    accessToken,
    refreshToken,
  };
}

export async function verifyMfa(
  challengeId: string,
  code: string,
): Promise<{
  user?: AuthUser;
  accessToken?: string;
  refreshToken?: string;
}> {
  await ensureTabProtection();

  const response = await fetch(
    `${getApiUrl()}/api/v1/auth/mfa/verify`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        challengeId,
        code: code.trim(),
      }),
      cache: "no-store",
    },
  );

  const data =
    await parseResponse<{
      message?: string;
      accessToken?: string;
      refreshToken?: string;
      user?: AuthUser;
      tokens?: {
        accessToken?: string;
        refreshToken?: string;
      };
    }>(response);

  if (!response.ok) {
    throw new Error(
      data.message ||
        "Unable to verify MFA.",
    );
  }

  const accessToken =
    data.accessToken ||
    data.tokens?.accessToken;

  const refreshToken =
    data.refreshToken ||
    data.tokens?.refreshToken;

  if (!accessToken) {
    throw new Error(
      "MFA verification succeeded but no access token was returned.",
    );
  }

  setTokens({
    accessToken,
    refreshToken,
  });

  return {
    user: data.user,
    accessToken,
    refreshToken,
  };
}

export async function logout(): Promise<void> {
  await ensureTabProtection();

  const token = getAccessToken();

  try {
    if (token) {
      await fetch(
        `${getApiUrl()}/api/v1/auth/logout`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          credentials: "include",
          cache: "no-store",
        },
      );
    }
  } catch {
    /*
     * Logout must still clear the local session if the
     * backend is temporarily unavailable.
     */
  } finally {
    clearTokens();
  }
}

/**
 * Utility for pages that need to require authentication
 * without duplicating redirect logic.
 */
export async function requireCurrentUser(): Promise<AuthUser> {
  return getCurrentUser();
}

/**
 * Useful when a component needs the current tab identity
 * for diagnostics without exposing tokens.
 */
export function getTabId(): string | null {
  return getStoredTabId();
}

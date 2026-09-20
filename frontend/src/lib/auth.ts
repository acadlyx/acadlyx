import { apiUrl } from "./api";

/**
 * Acadlyx authentication client
 *
 * Important security behavior:
 * - Access/refresh tokens are stored in sessionStorage, NOT localStorage.
 * - Every browser tab gets its own authentication storage.
 * - Legacy localStorage token values are removed.
 * - MFA tokens are only stored after successful verification.
 * - Authenticated requests automatically attempt one token refresh after 401.
 *
 * sessionStorage is intentionally used so separate tabs do not share the
 * active authenticated session.
 */

const ACCESS_TOKEN_KEY = "acadlyx_access_token";
const REFRESH_TOKEN_KEY = "acadlyx_refresh_token";

const LEGACY_ACCESS_TOKEN_KEY = "acadlyx_access_token";
const LEGACY_REFRESH_TOKEN_KEY = "acadlyx_refresh_token";

const TAB_ID_KEY = "acadlyx_tab_id";
const TAB_INITIALIZED_KEY = "acadlyx_tab_initialized";

const TAB_CHANNEL_NAME = "acadlyx_auth_tab_isolation";

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
  error?: {
    message?: string;
    code?: string;
  };
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/**
 * Generates a per-tab identifier.
 */
function generateTabId(): string {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Ensures this browser tab has its own identifier.
 *
 * sessionStorage is intentionally used here because it is scoped to the
 * individual tab.
 */
function ensureTabId(): string | null {
  if (!isBrowser()) return null;

  let tabId = window.sessionStorage.getItem(TAB_ID_KEY);

  if (!tabId) {
    tabId = generateTabId();
    window.sessionStorage.setItem(TAB_ID_KEY, tabId);
  }

  return tabId;
}

/**
 * Remove authentication tokens that may have been left behind by older
 * Acadlyx builds which used localStorage.
 *
 * We NEVER read authentication tokens from localStorage.
 */
function removeLegacyLocalStorageTokens(): void {
  if (!isBrowser()) return;

  try {
    window.localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
  } catch {
    // Ignore storage access failures.
  }
}

/**
 * Read an access token only from this tab's sessionStorage.
 */
function getAccessTokenUnsafe(): string | null {
  if (!isBrowser()) return null;

  try {
    return window.sessionStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Read a refresh token only from this tab's sessionStorage.
 */
function getRefreshTokenUnsafe(): string | null {
  if (!isBrowser()) return null;

  try {
    return window.sessionStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Clear only this tab's authentication state.
 */
function clearSessionTokens(): void {
  if (!isBrowser()) return;

  try {
    window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    window.sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    // Ignore storage access failures.
  }
}

/**
 * Best-effort protection against sessionStorage cloning.
 *
 * Browsers can initially clone sessionStorage when a new document is opened
 * from an existing document with window.opener.
 *
 * When that happens, the new document must not inherit the parent's active
 * authentication session.
 *
 * We deliberately do NOT use localStorage for authentication.
 */
function protectAgainstClonedSession(): void {
  if (!isBrowser()) return;

  removeLegacyLocalStorageTokens();

  const initialized = window.sessionStorage.getItem(TAB_INITIALIZED_KEY);

  /**
   * A page opened from another document may inherit sessionStorage.
   *
   * If this is a fresh document with an opener and it already contains
   * authentication data, clear that copied authentication state.
   */
  if (!initialized && window.opener && getAccessTokenUnsafe()) {
    clearSessionTokens();
  }

  ensureTabId();

  try {
    window.sessionStorage.setItem(TAB_INITIALIZED_KEY, "1");
  } catch {
    // Ignore storage failures.
  }
}

/**
 * Run tab protection before accessing authentication state.
 */
function ensureTabProtection(): void {
  if (!isBrowser()) return;

  protectAgainstClonedSession();
}

export function getAccessToken(): string | null {
  if (!isBrowser()) return null;

  ensureTabProtection();

  return getAccessTokenUnsafe();
}

export function getRefreshToken(): string | null {
  if (!isBrowser()) return null;

  ensureTabProtection();

  return getRefreshTokenUnsafe();
}

export function setTokens(tokens: AuthTokens): void {
  if (!isBrowser()) return;

  ensureTabProtection();

  try {
    window.sessionStorage.setItem(
      ACCESS_TOKEN_KEY,
      tokens.accessToken
    );

    window.sessionStorage.setItem(
      REFRESH_TOKEN_KEY,
      tokens.refreshToken
    );

    removeLegacyLocalStorageTokens();
  } catch {
    throw new Error(
      "Unable to securely store the authentication session in this browser."
    );
  }
}

export function clearTokens(): void {
  if (!isBrowser()) return;

  try {
    window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    window.sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    // Ignore storage failures.
  }

  removeLegacyLocalStorageTokens();
}

export function isAuthenticated(): boolean {
  if (!isBrowser()) return false;

  ensureTabProtection();

  return getAccessTokenUnsafe() !== null;
}

/**
 * Result of a sign-in attempt.
 *
 * Accounts requiring MFA return a challenge instead of authenticated
 * tokens. Tokens are not stored until MFA verification succeeds.
 */
export type LoginResult =
  | {
      mfaRequired: false;
      user: AuthUser;
    }
  | {
      mfaRequired: true;
      challengeToken: string;
      expiresAt: string;
    };

interface LoginPayload {
  mfaRequired?: boolean;
  challengeToken?: string;
  expiresAt?: string;
  user?: AuthUser;
  tokens?: AuthTokens;
}

/**
 * Standard email/password login.
 */
export async function login(
  email: string,
  password: string
): Promise<LoginResult> {
  if (!isBrowser()) {
    throw new Error("Login is only available in a browser.");
  }

  ensureTabProtection();

  const response = await fetch(apiUrl("/auth/login"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({
      email,
      password,
    }),
  });

  const body = (await response
    .json()
    .catch(() => null)) as ApiEnvelope<LoginPayload> | null;

  if (!response.ok || !body) {
    throw new Error(
      body?.error?.message ||
        "Login failed. Please check your credentials and try again."
    );
  }

  const payload = body.data;

  if (
    payload.mfaRequired &&
    payload.challengeToken
  ) {
    return {
      mfaRequired: true,
      challengeToken: payload.challengeToken,
      expiresAt: payload.expiresAt ?? "",
    };
  }

  if (!payload.tokens || !payload.user) {
    throw new Error("Login response was incomplete.");
  }

  setTokens(payload.tokens);

  return {
    mfaRequired: false,
    user: payload.user,
  };
}

/**
 * Complete an MFA login.
 *
 * This function is intentionally exported because the login page imports
 * completeMfaLogin directly.
 */
export async function completeMfaLogin(
  challengeToken: string,
  code: string
): Promise<AuthUser> {
  if (!isBrowser()) {
    throw new Error("MFA verification is only available in a browser.");
  }

  ensureTabProtection();

  const response = await fetch(
    apiUrl("/auth/mfa/verify"),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        challengeToken,
        code,
      }),
    }
  );

  const body = (await response
    .json()
    .catch(() => null)) as ApiEnvelope<{
      user: AuthUser;
      tokens: AuthTokens;
    }> | null;

  if (!response.ok || !body) {
    throw new Error(
      body?.error?.message ||
        "Verification failed. Please check the code and try again."
    );
  }

  if (!body.data?.tokens || !body.data?.user) {
    throw new Error("MFA verification response was incomplete.");
  }

  setTokens(body.data.tokens);

  return body.data.user;
}

/**
 * Get the currently authenticated user.
 */
export async function getCurrentUser(): Promise<AuthUser> {
  const response =
    await authedFetch<ApiEnvelope<AuthUser>>(
      "/auth/me"
    );

  if (
    !response.data ||
    !Array.isArray(response.data.roles) ||
    !Array.isArray(response.data.permissions)
  ) {
    throw new Error(
      "Invalid authenticated user response."
    );
  }

  return response.data;
}

/**
 * Logout.
 *
 * Tokens are removed locally BEFORE making the network request so that
 * even if the backend is unavailable, this browser tab is immediately
 * unauthenticated.
 */
export async function logout(): Promise<void> {
  if (!isBrowser()) return;

  ensureTabProtection();

  const refreshToken = getRefreshTokenUnsafe();

  clearTokens();

  if (!refreshToken) return;

  try {
    await fetch(
      apiUrl("/auth/logout"),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          refreshToken,
        }),
      }
    );
  } catch {
    // Local session is already cleared.
  }
}

/**
 * Refresh the access token using the refresh token belonging ONLY to
 * this browser tab.
 */
async function tryRefresh(): Promise<boolean> {
  if (!isBrowser()) return false;

  ensureTabProtection();

  const refreshToken = getRefreshTokenUnsafe();

  if (!refreshToken) {
    return false;
  }

  try {
    const response = await fetch(
      apiUrl("/auth/refresh"),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          refreshToken,
        }),
      }
    );

    const body = (await response
      .json()
      .catch(() => null)) as ApiEnvelope<{
      tokens: AuthTokens;
    }> | null;

    if (!response.ok || !body?.data?.tokens) {
      clearTokens();
      return false;
    }

    setTokens(body.data.tokens);

    return true;
  } catch {
    clearTokens();
    return false;
  }
}

/**
 * Error thrown when the browser no longer has a valid authenticated
 * session.
 */
export class AuthRequiredError extends Error {
  constructor() {
    super("Authentication required");
    this.name = "AuthRequiredError";
  }
}

/**
 * Authenticated fetch wrapper.
 *
 * IMPORTANT:
 * This is intentionally generic:
 *
 *   authedFetch<MyResponse>("/some-endpoint")
 *
 * Existing pages rely on this generic response typing.
 *
 * On a 401:
 * 1. Refresh once.
 * 2. Retry the original request once.
 * 3. Throw AuthRequiredError if refresh fails.
 */
export async function authedFetch<T = unknown>(
  path: string,
  init?: RequestInit
): Promise<T> {
  if (!isBrowser()) {
    throw new AuthRequiredError();
  }

  ensureTabProtection();

  const performFetch = async (
    token: string
  ): Promise<Response> => {
    const headers = new Headers(init?.headers);

    if (!headers.has("Content-Type")) {
      headers.set(
        "Content-Type",
        "application/json"
      );
    }

    headers.set(
      "Authorization",
      `Bearer ${token}`
    );

    return fetch(apiUrl(path), {
      ...init,
      headers,
      credentials: "include",
    });
  };

  let token = getAccessTokenUnsafe();

  if (!token) {
    throw new AuthRequiredError();
  }

  let response = await performFetch(token);

  if (response.status === 401) {
    const refreshed = await tryRefresh();

    if (!refreshed) {
      clearTokens();
      throw new AuthRequiredError();
    }

    token = getAccessTokenUnsafe();

    if (!token) {
      throw new AuthRequiredError();
    }

    response = await performFetch(token);
  }

  if (response.status === 401) {
    clearTokens();
    throw new AuthRequiredError();
  }

  const text = await response.text();

  let payload: unknown = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const errorMessage =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof (payload as { error?: unknown }).error ===
        "object" &&
      (payload as { error?: { message?: unknown } })
        .error?.message
        ? String(
            (
              payload as {
                error?: { message?: unknown };
              }
            ).error?.message
          )
        : typeof payload === "object" &&
            payload !== null &&
            "message" in payload
          ? String(
              (payload as { message?: unknown })
                .message
            )
          : `Request failed with status ${response.status}`;

    throw new Error(errorMessage);
  }

  return payload as T;
}

/**
 * Remove any old localStorage authentication state immediately when this
 * module executes in the browser.
 *
 * This protects users upgrading from older Acadlyx versions.
 */
if (isBrowser()) {
  removeLegacyLocalStorageTokens();
}

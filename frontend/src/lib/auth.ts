import { apiUrl } from "./api";

/**
 * ACADLYX authentication/session storage.
 *
 * IMPORTANT:
 * Tokens intentionally live in sessionStorage instead of localStorage.
 *
 * sessionStorage is isolated per browser tab/top-level browsing context.
 * This prevents:
 *
 *   Tab A -> Student A
 *   Tab B -> Faculty B
 *
 * from overwriting each other's authentication tokens.
 *
 * The old localStorage keys are deliberately ignored and removed so an
 * older shared session cannot leak into the new tab-isolated session model.
 *
 * NOTE:
 * The long-term production hardening path should move the refresh token
 * to a secure httpOnly cookie backed by server-side session handling.
 */

const ACCESS_TOKEN_KEY = "acadlyx_access_token";
const REFRESH_TOKEN_KEY = "acadlyx_refresh_token";

const LEGACY_ACCESS_TOKEN_KEY = "acadlyx_access_token";
const LEGACY_REFRESH_TOKEN_KEY = "acadlyx_refresh_token";

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

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/**
 * Remove tokens from the old shared localStorage session.
 *
 * This is intentionally performed only on the client.
 *
 * We do not migrate those tokens into sessionStorage because doing so
 * could carry a token from an already-open shared session into another
 * browser context.
 */
function clearLegacySharedStorage(): void {
  if (!isBrowser()) return;

  try {
    window.localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
  } catch {
    // Storage can be unavailable in privacy-restricted environments.
  }
}

/**
 * sessionStorage is per-tab.
 *
 * This is the central rule that prevents different tabs from sharing
 * authentication state.
 */
function getSessionStorage(): Storage | null {
  if (!isBrowser()) return null;

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function getAccessToken(): string | null {
  const storage = getSessionStorage();

  if (!storage) return null;

  clearLegacySharedStorage();

  try {
    return storage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getRefreshToken(): string | null {
  const storage = getSessionStorage();

  if (!storage) return null;

  clearLegacySharedStorage();

  try {
    return storage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setTokens(tokens: AuthTokens): void {
  const storage = getSessionStorage();

  if (!storage) {
    throw new Error(
      "Browser session storage is unavailable. Please enable browser storage and try again."
    );
  }

  clearLegacySharedStorage();

  try {
    storage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
    storage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  } catch {
    throw new Error(
      "Unable to save the login session in this browser tab."
    );
  }
}

export function clearTokens(): void {
  const storage = getSessionStorage();

  if (storage) {
    try {
      storage.removeItem(ACCESS_TOKEN_KEY);
      storage.removeItem(REFRESH_TOKEN_KEY);
    } catch {
      // Continue with legacy cleanup.
    }
  }

  clearLegacySharedStorage();
}

export function isAuthenticated(): boolean {
  return getAccessToken() !== null;
}

/**
 * Result of a sign-in attempt.
 *
 * An account with a second factor enrolled returns a challenge instead
 * of tokens; the caller must then call completeMfaLogin.
 *
 * Nothing is stored until real access/refresh tokens arrive.
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

function getErrorMessage(
  body: unknown,
  fallback: string
): string {
  if (
    typeof body === "object" &&
    body !== null &&
    "error" in body
  ) {
    const error = (
      body as {
        error?: {
          message?: unknown;
        };
      }
    ).error;

    if (
      error &&
      typeof error.message === "string" &&
      error.message.trim()
    ) {
      return error.message;
    }
  }

  return fallback;
}

export async function login(
  email: string,
  password: string
): Promise<LoginResult> {
  /*
   * Always start a new login cleanly inside THIS TAB.
   *
   * We do not touch another tab because sessionStorage is tab-scoped.
   */
  clearTokens();

  const res = await fetch(apiUrl("/auth/login"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });

  const body = (await res
    .json()
    .catch(() => null)) as ApiEnvelope<LoginPayload> | null;

  if (!res.ok || !body) {
    throw new Error(
      getErrorMessage(body, "Login failed")
    );
  }

  if (
    body.data.mfaRequired &&
    body.data.challengeToken
  ) {
    return {
      mfaRequired: true,
      challengeToken: body.data.challengeToken,
      expiresAt: body.data.expiresAt ?? "",
    };
  }

  if (
    !body.data.tokens ||
    !body.data.user
  ) {
    throw new Error(
      "Login response was incomplete"
    );
  }

  setTokens(body.data.tokens);

  return {
    mfaRequired: false,
    user: body.data.user,
  };
}

/**
 * Second step of an MFA sign-in.
 */
export async function completeMfaLogin(
  challengeToken: string,
  code: string
): Promise<AuthUser> {
  const res = await fetch(
    apiUrl("/auth/mfa/verify"),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        challengeToken,
        code,
      }),
    }
  );

  const body = (await res
    .json()
    .catch(() => null)) as ApiEnvelope<{
    user: AuthUser;
    tokens: AuthTokens;
  }> | null;

  if (!res.ok || !body) {
    throw new Error(
      getErrorMessage(
        body,
        "Verification failed"
      )
    );
  }

  setTokens(body.data.tokens);

  return body.data.user;
}

export async function logout(): Promise<void> {
  /*
   * Capture this tab's refresh token before clearing this tab.
   *
   * Because the token is stored in sessionStorage, another tab's
   * authentication state is untouched.
   */
  const refreshToken = getRefreshToken();

  clearTokens();

  if (!refreshToken) return;

  try {
    await fetch(apiUrl("/auth/logout"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        refreshToken,
      }),
    });
  } catch {
    /*
     * Local session is already cleared.
     * Server-side logout remains best-effort.
     */
  }
}

async function tryRefresh(): Promise<boolean> {
  /*
   * Only refresh using THIS TAB'S refresh token.
   */
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    return false;
  }

  try {
    const res = await fetch(
      apiUrl("/auth/refresh"),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          refreshToken,
        }),
      }
    );

    if (!res.ok) {
      clearTokens();
      return false;
    }

    const body =
      (await res.json()) as ApiEnvelope<{
        tokens: AuthTokens;
      }>;

    if (
      !body?.data?.tokens?.accessToken ||
      !body?.data?.tokens?.refreshToken
    ) {
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
 * Error used when the current tab has no valid authenticated session.
 */
export class AuthRequiredError extends Error {
  constructor() {
    super("Authentication required");
    this.name = "AuthRequiredError";
  }
}

/**
 * Authenticated API request.
 *
 * Behaviour:
 *
 * 1. Reads ONLY this tab's access token.
 * 2. Sends the request.
 * 3. On 401, refreshes ONLY this tab's refresh token.
 * 4. Retries once.
 * 5. If authentication still fails, clears ONLY this tab.
 */
export async function authedFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const performFetch = (
    token: string | null
  ) =>
    fetch(apiUrl(path), {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {}),
        ...(init?.headers || {}),
      },
    });

  let token = getAccessToken();

  if (!token) {
    throw new AuthRequiredError();
  }

  let res = await performFetch(token);

  if (res.status === 401) {
    const refreshed = await tryRefresh();

    if (!refreshed) {
      throw new AuthRequiredError();
    }

    token = getAccessToken();

    if (!token) {
      throw new AuthRequiredError();
    }

    res = await performFetch(token);
  }

  if (!res.ok) {
    const body = (await res
      .json()
      .catch(() => null)) as {
      error?: {
        message?: string;
      };
    } | null;

    throw new Error(
      body?.error?.message ||
        `Request failed: ${res.status}`
    );
  }

  return res.json() as Promise<T>;
}

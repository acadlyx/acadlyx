import { apiUrl } from "./api";

const ACCESS_TOKEN_KEY =
  "acadlyx_access_token";

const REFRESH_TOKEN_KEY =
  "acadlyx_refresh_token";

const USER_CACHE_TTL_MS =
  30_000;

/*
 * General authenticated API requests can legitimately take longer than
 * a few seconds on a cold backend, during database connection setup,
 * password hashing, or other server-side work.
 *
 * The previous 8-second timeout caused valid requests such as
 * POST /users to be aborted by the browser before the backend finished.
 */
const REQUEST_TIMEOUT_MS =
  30_000;

/*
 * Token refresh should remain reasonably short because it is part of
 * authentication recovery. It is still long enough to tolerate a cold
 * backend/database connection.
 */
const REFRESH_TIMEOUT_MS =
  15_000;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface AuthUser {
  id: string;
  institutionId:
    string | null;
  email: string;
  idNumber: string;
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
  return (
    typeof window !==
    "undefined"
  );
}

let cachedUser:
  | AuthUser
  | null = null;

let cachedUserAt =
  0;

let currentUserRequest:
  | Promise<AuthUser>
  | null = null;

let refreshRequest:
  | Promise<boolean>
  | null = null;

/*
 * In-memory API caches must never survive an account transition. This value
 * changes whenever tokens are written or cleared and lets feature modules
 * scope their ephemeral caches without storing or deriving a cache key from
 * the access token itself.
 */
let authCacheScope = 0;

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

export class AuthRequiredError
  extends Error
{
  constructor() {
    super(
      "Authentication required"
    );

    this.name =
      "AuthRequiredError";
  }
}

export class RequestTimeoutError
  extends Error
{
  constructor(
    message =
      "The server took too long to respond. Please check the result before trying again."
  ) {
    super(message);

    this.name =
      "RequestTimeoutError";
  }
}

function invalidateUserCache() {
  cachedUser =
    null;

  cachedUserAt =
    0;

  currentUserRequest =
    null;
}

function validateUser(
  user: AuthUser
): AuthUser {
  if (
    !Array.isArray(
      user.roles
    ) ||
    !Array.isArray(
      user.permissions
    )
  ) {
    throw new Error(
      "Invalid authenticated user response"
    );
  }

  return user;
}

export function getAccessToken():
  string | null {
  if (!isBrowser()) {
    return null;
  }

  return window.localStorage.getItem(
    ACCESS_TOKEN_KEY
  );
}

export function getRefreshToken():
  string | null {
  if (!isBrowser()) {
    return null;
  }

  return window.localStorage.getItem(
    REFRESH_TOKEN_KEY
  );
}

export function setTokens(
  tokens: AuthTokens
): void {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(
    ACCESS_TOKEN_KEY,
    tokens.accessToken
  );

  window.localStorage.setItem(
    REFRESH_TOKEN_KEY,
    tokens.refreshToken
  );

  invalidateUserCache();
  authCacheScope += 1;
}

export function clearTokens(): void {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.removeItem(
    ACCESS_TOKEN_KEY
  );

  window.localStorage.removeItem(
    REFRESH_TOKEN_KEY
  );

  invalidateUserCache();
  authCacheScope += 1;
}

export function getAuthCacheScope(): number {
  return authCacheScope;
}

export function isAuthenticated():
  boolean {
  return (
    getAccessToken() !== null
  );
}

/*
 * Fast synchronous access for dashboard shells.
 *
 * This never makes a network request.
 */
export function getCachedCurrentUser():
  AuthUser | null {
  return cachedUser;
}

export async function getCurrentUser(
  options: {
    background?: boolean;
    force?: boolean;
  } = {}
): Promise<AuthUser> {
  const token =
    getAccessToken();

  if (!token) {
    throw new AuthRequiredError();
  }

  const now =
    Date.now();

  const hasFreshCache =
    cachedUser !== null &&
    now - cachedUserAt <
      USER_CACHE_TTL_MS;

  /*
   * Normal dashboard navigation should use the cache immediately.
   *
   * Background callers can ask for revalidation without making the
   * visible workspace wait for another network request.
   */
  if (
    hasFreshCache &&
    !options.force
  ) {
    if (
      options.background
    ) {
      void refreshCurrentUserInBackground();
    }

    return cachedUser as AuthUser;
  }

  /*
   * Never allow several dashboard components to create several
   * /auth/me requests at the same time.
   */
  if (
    currentUserRequest
  ) {
    return currentUserRequest;
  }

  currentUserRequest =
    authedFetch<
      ApiEnvelope<AuthUser>
    >(
      "/auth/me"
    )
      .then(
        (response) => {
          const user =
            validateUser(
              response.data
            );

          cachedUser =
            user;

          cachedUserAt =
            Date.now();

          return user;
        }
      )
      .finally(() => {
        currentUserRequest =
          null;
      });

  return currentUserRequest;
}

async function refreshCurrentUserInBackground():
  Promise<void> {
  if (
    currentUserRequest
  ) {
    return;
  }

  const token =
    getAccessToken();

  if (!token) {
    return;
  }

  try {
    await getCurrentUser({
      force: true,
    });
  } catch {
    /*
     * Background authentication refresh must never make
     * the visible ERP workspace unusable.
     */
  }
}

export async function login(
  identifier: string,
  password: string
): Promise<LoginResult> {
  const res =
    await fetchWithTimeout(
      apiUrl(
        "/auth/login"
      ),
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          identifier,
          password,
        }),
      }
    );

  const body =
    (await res
      .json()
      .catch(
        () => null
      )) as
      | ApiEnvelope<LoginPayload>
      | null;

  if (
    !res.ok ||
    !body
  ) {
    throw new Error(
      (
        body as unknown as {
          error?: {
            message?: string;
          };
        }
      )?.error?.message ||
        "Login failed"
    );
  }

  if (
    body.data
      .mfaRequired &&
    body.data
      .challengeToken
  ) {
    return {
      mfaRequired:
        true,

      challengeToken:
        body.data
          .challengeToken,

      expiresAt:
        body.data
          .expiresAt ??
        "",
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

  setTokens(
    body.data.tokens
  );

  cachedUser =
    validateUser(
      body.data.user
    );

  cachedUserAt =
    Date.now();

  return {
    mfaRequired:
      false,

    user:
      cachedUser,
  };
}

export async function completeMfaLogin(
  challengeToken: string,
  code: string
): Promise<AuthUser> {
  const res =
    await fetchWithTimeout(
      apiUrl(
        "/auth/mfa/verify"
      ),
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          challengeToken,
          code,
        }),
      }
    );

  const body =
    (await res
      .json()
      .catch(
        () => null
      )) as
      | ApiEnvelope<{
          user: AuthUser;
          tokens: AuthTokens;
        }>
      | null;

  if (
    !res.ok ||
    !body
  ) {
    throw new Error(
      (
        body as unknown as {
          error?: {
            message?: string;
          };
        }
      )?.error?.message ||
        "Verification failed"
    );
  }

  setTokens(
    body.data.tokens
  );

  cachedUser =
    validateUser(
      body.data.user
    );

  cachedUserAt =
    Date.now();

  return cachedUser;
}

export async function logout():
  Promise<void> {
  const refreshToken =
    getRefreshToken();

  clearTokens();

  if (!refreshToken) {
    return;
  }

  try {
    await fetchWithTimeout(
      apiUrl(
        "/auth/logout"
      ),
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          refreshToken,
        }),
      },
      5_000
    );
  } catch {
    /*
     * Local credentials are already removed.
     */
  }
}

async function tryRefresh():
  Promise<boolean> {
  if (
    refreshRequest
  ) {
    return refreshRequest;
  }

  const refreshToken =
    getRefreshToken();

  if (!refreshToken) {
    return false;
  }

  refreshRequest =
    (async () => {
      try {
        const res =
          await fetchWithTimeout(
            apiUrl(
              "/auth/refresh"
            ),
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                refreshToken,
              }),
            },
            REFRESH_TIMEOUT_MS
          );

        if (
          !res.ok
        ) {
          clearTokens();
          return false;
        }

        const body =
          (await res.json()) as
            ApiEnvelope<{
              tokens: AuthTokens;
            }>;

        setTokens(
          body.data.tokens
        );

        return true;
      } catch {
        clearTokens();
        return false;
      } finally {
        refreshRequest =
          null;
      }
    })();

  return refreshRequest;
}

/*
 * Fetch with a client-side timeout.
 *
 * Important:
 * - The timeout is now long enough for legitimate backend operations.
 * - A caller-provided AbortSignal is still respected.
 * - A timeout generated by this function is converted into a meaningful
 *   RequestTimeoutError instead of exposing the browser's generic
 *   "signal is aborted without reason" AbortError.
 */
async function fetchWithTimeout(
  input:
    | RequestInfo
    | URL,
  init?: RequestInit,
  timeoutMs =
    REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller =
    new AbortController();

  let timedOut =
    false;

  const timer =
    window.setTimeout(
      () => {
        timedOut =
          true;

        controller.abort();
      },
      timeoutMs
    );

  let removeParentAbortListener:
    | (() => void)
    | null = null;

  if (
    init?.signal
  ) {
    if (
      init.signal.aborted
    ) {
      controller.abort();
    } else {
      const handleParentAbort =
        () => {
          controller.abort();
        };

      init.signal.addEventListener(
        "abort",
        handleParentAbort,
        {
          once: true,
        }
      );

      removeParentAbortListener =
        () => {
          init.signal?.removeEventListener(
            "abort",
            handleParentAbort
          );
        };
    }
  }

  try {
    return await fetch(
      input,
      {
        ...init,
        signal:
          controller.signal,
      }
    );
  } catch (error) {
    /*
     * Only convert aborts generated by our timeout.
     *
     * If a component intentionally aborts its own request, preserve the
     * native AbortError so existing cancellation behaviour is unchanged.
     */
    if (
      timedOut &&
      error instanceof DOMException &&
      error.name === "AbortError"
    ) {
      throw new RequestTimeoutError();
    }

    if (
      timedOut &&
      error instanceof Error &&
      error.name === "AbortError"
    ) {
      throw new RequestTimeoutError();
    }

    throw error;
  } finally {
    window.clearTimeout(
      timer
    );

    removeParentAbortListener?.();
  }
}

export async function authedFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  let token =
    getAccessToken();

  if (!token) {
    throw new AuthRequiredError();
  }

  const performFetch =
    async (
      currentToken: string
    ) => {
      return fetchWithTimeout(
        apiUrl(path),
        {
          ...init,

          headers: {
            "Content-Type":
              "application/json",

            ...(currentToken
              ? {
                  Authorization:
                    `Bearer ${currentToken}`,
                }
              : {}),

            ...(init?.headers ||
              {}),
          },
        }
      );
    };

  let res =
    await performFetch(
      token
    );

  if (
    res.status ===
    401
  ) {
    const refreshed =
      await tryRefresh();

    if (!refreshed) {
      throw new AuthRequiredError();
    }

    token =
      getAccessToken();

    if (!token) {
      throw new AuthRequiredError();
    }

    res =
      await performFetch(
        token
      );
  }

  if (!res.ok) {
    const body =
      (await res
        .json()
        .catch(
          () => null
        )) as {
        error?: {
          message?: string;
        };
      } | null;

    throw new Error(
      body?.error
        ?.message ||
        `Request failed: ${res.status}`
    );
  }

  return res.json() as Promise<T>;
}

export async function authedBlobFetch(path: string): Promise<Response> {
  let token = getAccessToken();
  if (!token) throw new AuthRequiredError();

  const perform = (currentToken: string) =>
    fetchWithTimeout(apiUrl(path), {
      headers: { Authorization: `Bearer ${currentToken}` },
    });

  let response = await perform(token);
  if (response.status === 401) {
    const refreshed = await tryRefresh();
    if (!refreshed) throw new AuthRequiredError();
    token = getAccessToken();
    if (!token) throw new AuthRequiredError();
    response = await perform(token);
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message || `Request failed: ${response.status}`);
  }

  return response;
}

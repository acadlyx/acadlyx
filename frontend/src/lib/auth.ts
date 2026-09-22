import { apiUrl } from "./api";

const ACCESS_TOKEN_KEY =
  "acadlyx_access_token";

const REFRESH_TOKEN_KEY =
  "acadlyx_refresh_token";

const USER_CACHE_TTL_MS =
  30_000;

const REQUEST_TIMEOUT_MS =
  8_000;

const REFRESH_TIMEOUT_MS =
  6_000;

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
  email: string,
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
          email,
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

  const timer =
    window.setTimeout(
      () =>
        controller.abort(),
      timeoutMs
    );

  if (
    init?.signal
  ) {
    if (
      init.signal.aborted
    ) {
      controller.abort();
    } else {
      init.signal.addEventListener(
        "abort",
        () =>
          controller.abort(),
        {
          once: true,
        }
      );
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
  } finally {
    window.clearTimeout(
      timer
    );
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

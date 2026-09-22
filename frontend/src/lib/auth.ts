import { apiUrl } from "./api";

const ACCESS_TOKEN_KEY =
  "acadlyx_access_token";

const REFRESH_TOKEN_KEY =
  "acadlyx_refresh_token";

const USER_CACHE_KEY =
  "acadlyx_current_user";

const TAB_ID_KEY =
  "acadlyx_tab_id";

const TAB_INITIALIZED_KEY =
  "acadlyx_tab_initialized";

const TAB_CHANNEL_NAME =
  "acadlyx_auth_tab_isolation";

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

interface LoginPayload {
  mfaRequired?: boolean;
  challengeToken?: string;
  expiresAt?: string;
  user?: AuthUser;
  tokens?: AuthTokens;
}

function isBrowser(): boolean {
  return (
    typeof window !==
    "undefined"
  );
}

/*
 * ---------------------------------------------------------------------------
 * TAB ISOLATION
 * ---------------------------------------------------------------------------
 */

function getOrCreateTabId(): string | null {
  if (!isBrowser()) {
    return null;
  }

  let tabId =
    window.sessionStorage.getItem(
      TAB_ID_KEY
    );

  if (!tabId) {
    tabId =
      `${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2)}`;

    window.sessionStorage.setItem(
      TAB_ID_KEY,
      tabId
    );
  }

  return tabId;
}

function clearAuthStorage(): void {
  if (!isBrowser()) {
    return;
  }

  window.sessionStorage.removeItem(
    ACCESS_TOKEN_KEY
  );

  window.sessionStorage.removeItem(
    REFRESH_TOKEN_KEY
  );

  window.sessionStorage.removeItem(
    USER_CACHE_KEY
  );
}

function protectAgainstClonedSession(): void {
  if (!isBrowser()) {
    return;
  }

  const initialized =
    window.sessionStorage.getItem(
      TAB_INITIALIZED_KEY
    ) === "1";

  const hasOpener =
    Boolean(window.opener);

  const copiedAccessToken =
    Boolean(
      window.sessionStorage.getItem(
        ACCESS_TOKEN_KEY
      )
    );

  /*
   * sessionStorage can occasionally be
   * cloned into a newly opened tab.
   *
   * Never allow a cloned authenticated
   * session to silently share credentials.
   */
  if (
    !initialized &&
    hasOpener &&
    copiedAccessToken
  ) {
    clearAuthStorage();
  }

  getOrCreateTabId();

  window.sessionStorage.setItem(
    TAB_INITIALIZED_KEY,
    "1"
  );
}

if (isBrowser()) {
  protectAgainstClonedSession();

  try {
    const channel =
      new BroadcastChannel(
        TAB_CHANNEL_NAME
      );

    channel.addEventListener(
      "message",
      (event) => {
        const currentTabId =
          getOrCreateTabId();

        if (!currentTabId) {
          return;
        }

        /*
         * Deliberately do not sign this
         * tab out when another tab logs out.
         *
         * Tokens are stored in sessionStorage,
         * so each tab owns its own session.
         */
        if (
          event.data?.type ===
            "acadlyx-auth-cleared" &&
          event.data?.tabId !==
            currentTabId
        ) {
          return;
        }
      }
    );
  } catch {
    /*
     * BroadcastChannel is optional.
     */
  }
}

/*
 * ---------------------------------------------------------------------------
 * TOKEN ACCESS
 * ---------------------------------------------------------------------------
 */

export function getAccessToken(): string | null {
  if (!isBrowser()) {
    return null;
  }

  protectAgainstClonedSession();

  return window.sessionStorage.getItem(
    ACCESS_TOKEN_KEY
  );
}

export function getRefreshToken(): string | null {
  if (!isBrowser()) {
    return null;
  }

  protectAgainstClonedSession();

  return window.sessionStorage.getItem(
    REFRESH_TOKEN_KEY
  );
}

export function setTokens(
  tokens: AuthTokens
): void {
  if (!isBrowser()) {
    return;
  }

  protectAgainstClonedSession();

  window.sessionStorage.setItem(
    ACCESS_TOKEN_KEY,
    tokens.accessToken
  );

  window.sessionStorage.setItem(
    REFRESH_TOKEN_KEY,
    tokens.refreshToken
  );
}

export function clearTokens(): void {
  if (!isBrowser()) {
    return;
  }

  clearAuthStorage();

  try {
    const channel =
      new BroadcastChannel(
        TAB_CHANNEL_NAME
      );

    channel.postMessage({
      type: "acadlyx-auth-cleared",
      tabId: getOrCreateTabId(),
    });

    channel.close();
  } catch {
    /*
     * Optional notification.
     */
  }
}

export function isAuthenticated(): boolean {
  return (
    getAccessToken() !== null
  );
}

/*
 * ---------------------------------------------------------------------------
 * USER SNAPSHOT
 * ---------------------------------------------------------------------------
 */

export function getCachedCurrentUser():
  | AuthUser
  | null {
  if (!isBrowser()) {
    return null;
  }

  try {
    const raw =
      window.sessionStorage.getItem(
        USER_CACHE_KEY
      );

    if (!raw) {
      return null;
    }

    const user =
      JSON.parse(raw) as AuthUser;

    if (
      !user ||
      typeof user.id !==
        "string" ||
      !Array.isArray(
        user.roles
      ) ||
      !Array.isArray(
        user.permissions
      )
    ) {
      window.sessionStorage.removeItem(
        USER_CACHE_KEY
      );

      return null;
    }

    return user;
  } catch {
    window.sessionStorage.removeItem(
      USER_CACHE_KEY
    );

    return null;
  }
}

function cacheCurrentUser(
  user: AuthUser
): void {
  if (!isBrowser()) {
    return;
  }

  try {
    window.sessionStorage.setItem(
      USER_CACHE_KEY,
      JSON.stringify(user)
    );
  } catch {
    /*
     * Storage failure must never
     * prevent authentication.
     */
  }
}

/*
 * ---------------------------------------------------------------------------
 * CURRENT USER
 * ---------------------------------------------------------------------------
 */

export async function getCurrentUser(
  options?: {
    background?: boolean;
  }
): Promise<AuthUser> {
  const cached =
    getCachedCurrentUser();

  /*
   * For already-rendered dashboards,
   * immediately return the known authenticated
   * user and revalidate in the background.
   *
   * This prevents navigation from waiting for
   * the API on every route.
   */
  if (
    options?.background &&
    cached
  ) {
    void revalidateCurrentUser();

    return cached;
  }

  const response =
    await authedFetch<
      ApiEnvelope<AuthUser>
    >(
      "/auth/me",
      {
        cacheMode:
          "no-store",
      }
    );

  if (
    !Array.isArray(
      response.data.roles
    ) ||
    !Array.isArray(
      response.data.permissions
    )
  ) {
    throw new Error(
      "Invalid authenticated user response"
    );
  }

  cacheCurrentUser(
    response.data
  );

  return response.data;
}

async function revalidateCurrentUser(): Promise<void> {
  try {
    const response =
      await authedFetch<
        ApiEnvelope<AuthUser>
      >(
        "/auth/me",
        {
          cacheMode:
            "no-store",
        }
      );

    if (
      Array.isArray(
        response.data.roles
      ) &&
      Array.isArray(
        response.data.permissions
      )
    ) {
      cacheCurrentUser(
        response.data
      );
    }
  } catch (error) {
    if (
      error instanceof
      AuthRequiredError
    ) {
      clearTokens();

      if (isBrowser()) {
        window.sessionStorage.removeItem(
          USER_CACHE_KEY
        );

        window.dispatchEvent(
          new CustomEvent(
            "acadlyx-auth-invalid"
          )
        );
      }
    }
  }
}

/*
 * ---------------------------------------------------------------------------
 * LOGIN
 * ---------------------------------------------------------------------------
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

export async function login(
  email: string,
  password: string
): Promise<LoginResult> {
  const response =
    await fetch(
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
    (await response
      .json()
      .catch(
        () => null
      )) as
      | ApiEnvelope<LoginPayload>
      | null;

  if (
    !response.ok ||
    !body
  ) {
    throw new Error(
      (
        body as
          | {
              error?: {
                message?: string;
              };
            }
          | null
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
      mfaRequired: true,
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

  cacheCurrentUser(
    body.data.user
  );

  return {
    mfaRequired: false,
    user: body.data.user,
  };
}

/*
 * ---------------------------------------------------------------------------
 * MFA
 * ---------------------------------------------------------------------------
 */

export async function completeMfaLogin(
  challengeToken: string,
  code: string
): Promise<AuthUser> {
  const response =
    await fetch(
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
    (await response
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
    !response.ok ||
    !body
  ) {
    throw new Error(
      (
        body as
          | {
              error?: {
                message?: string;
              };
            }
          | null
      )?.error?.message ||
        "Verification failed"
    );
  }

  setTokens(
    body.data.tokens
  );

  cacheCurrentUser(
    body.data.user
  );

  return body.data.user;
}

/*
 * ---------------------------------------------------------------------------
 * LOGOUT
 * ---------------------------------------------------------------------------
 */

export async function logout(): Promise<void> {
  const refreshToken =
    getRefreshToken();

  /*
   * Clear locally FIRST.
   *
   * The user should never remain
   * authenticated merely because the
   * server logout request is slow.
   */
  clearTokens();

  if (
    !refreshToken
  ) {
    return;
  }

  try {
    await fetch(
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
        keepalive: true,
      }
    );
  } catch {
    /*
     * Server logout is best effort.
     */
  }
}

/*
 * ---------------------------------------------------------------------------
 * REFRESH
 * ---------------------------------------------------------------------------
 *
 * Critical performance fix:
 *
 * Before:
 *
 * request A -> 401 -> refresh
 * request B -> 401 -> refresh
 * request C -> 401 -> refresh
 * request D -> 401 -> refresh
 *
 * Now:
 *
 * request A -> 401 ─┐
 * request B -> 401 ─┤
 * request C -> 401 ─┼-> ONE refresh
 * request D -> 401 ─┘
 */

let refreshPromise:
  | Promise<boolean>
  | null = null;

async function tryRefresh(): Promise<boolean> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise =
    (async () => {
      const refreshToken =
        getRefreshToken();

      if (
        !refreshToken
      ) {
        return false;
      }

      try {
        const response =
          await fetch(
            apiUrl(
              "/auth/refresh"
            ),
            {
              method:
                "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                refreshToken,
              }),
            }
          );

        if (
          !response.ok
        ) {
          clearTokens();
          return false;
        }

        const body =
          (await response
            .json()
            .catch(
              () => null
            )) as
            | ApiEnvelope<{
                tokens: AuthTokens;
              }>
            | null;

        if (
          !body?.data
            ?.tokens
            ?.accessToken
        ) {
          clearTokens();
          return false;
        }

        setTokens(
          body.data
            .tokens
        );

        return true;
      } catch {
        clearTokens();
        return false;
      }
    })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

export class AuthRequiredError extends Error {
  constructor() {
    super(
      "Authentication required"
    );

    this.name =
      "AuthRequiredError";
  }
}

/*
 * ---------------------------------------------------------------------------
 * REQUEST HELPERS
 * ---------------------------------------------------------------------------
 */

function isReadRequest(
  init?: RequestInit
): boolean {
  return (
    !init?.method ||
    init.method.toUpperCase() ===
      "GET"
  );
}

async function performAuthenticatedFetch(
  path: string,
  token: string,
  init?: RequestInit
): Promise<Response> {
  const headers =
    new Headers(
      init?.headers
    );

  if (
    !headers.has(
      "Content-Type"
    ) &&
    !(init?.body instanceof
      FormData)
  ) {
    headers.set(
      "Content-Type",
      "application/json"
    );
  }

  headers.set(
    "Authorization",
    `Bearer ${token}`
  );

  return fetch(
    apiUrl(path),
    {
      ...init,
      headers,
    }
  );
}

/*
 * ---------------------------------------------------------------------------
 * AUTHENTICATED FETCH
 * ---------------------------------------------------------------------------
 *
 * ERP-level caching is handled by erpApi.ts.
 *
 * This lower-level authentication layer therefore
 * intentionally does NOT use Cache API.
 *
 * That prevents:
 *
 * Cache API lookup
 *      +
 * ERP memory cache lookup
 *      +
 * background network refresh
 *
 * on every dashboard request.
 */

export async function authedFetch<
  T = unknown
>(
  path: string,
  init?: RequestInit & {
    cacheMode?:
      | "default"
      | "no-store";
  }
): Promise<T> {
  const initialToken =
    getAccessToken();

  if (!initialToken) {
    throw new AuthRequiredError();
  }

  const {
    cacheMode: _cacheMode,
    ...requestInit
  } = init || {};

  let activeToken =
    initialToken;

  let response =
    await performAuthenticatedFetch(
      path,
      activeToken,
      requestInit
    );

  if (
    response.status ===
    401
  ) {
    const refreshed =
      await tryRefresh();

    if (!refreshed) {
      throw new AuthRequiredError();
    }

    activeToken =
      getAccessToken() ||
      "";

    if (!activeToken) {
      throw new AuthRequiredError();
    }

    response =
      await performAuthenticatedFetch(
        path,
        activeToken,
        requestInit
      );
  }

  if (
    response.status ===
    401
  ) {
    clearTokens();

    throw new AuthRequiredError();
  }

  if (!response.ok) {
    const body =
      (await response
        .json()
        .catch(
          () => null
        )) as
        | {
            error?: {
              message?: string;
            };
          }
        | null;

    throw new Error(
      body?.error
        ?.message ||
        `Request failed: ${response.status}`
    );
  }

  return (await response.json()) as T;
}

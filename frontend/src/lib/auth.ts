import { apiUrl, createMutationKey } from "./api";
import { authorizationContextKey, isSessionCurrent } from "./sessionScopedCache.mjs";

const ACCESS_TOKEN_KEY =
  "acadlyx_access_token";

const REFRESH_TOKEN_KEY =
  "acadlyx_refresh_token";

/*
 * Authentication credentials are intentionally scoped to the current
 * top-level browsing context.
 *
 * localStorage is origin-wide and therefore cannot represent:
 *   Tab 1 -> User A
 *   Tab 2 -> User B
 *
 * sessionStorage is isolated per tab/window, survives reloads in that
 * browsing context, and is discarded when that tab is closed.
 *
 * The storage keys remain stable so the rest of the auth API does not
 * need to know how credentials are persisted.
 */
const AUTH_STORAGE = "sessionStorage" as const;

function getAuthStorage(): Storage | null {
  if (!isBrowser()) {
    return null;
  }

  try {
    return window[AUTH_STORAGE];
  } catch {
    return null;
  }
}

function clearLegacySharedAuthStorage(): void {
  if (!isBrowser()) {
    return;
  }

  /*
   * Older ACADLYX builds stored credentials in localStorage. Never read
   * them as an authentication source again. Removing them prevents a
   * stale credential from remaining in the browser after this migration.
   *
   * This is deliberately write-only cleanup: no auth decision is based
   * on localStorage, so tabs running the new build cannot affect each
   * other's session.
   */
  try {
    window.localStorage.removeItem(
      ACCESS_TOKEN_KEY
    );

    window.localStorage.removeItem(
      REFRESH_TOKEN_KEY
    );
  } catch {
    /* Ignore unavailable legacy storage. */
  }
}

function initializeAuthStorage(): void {
  if (!isBrowser()) {
    return;
  }

  clearLegacySharedAuthStorage();
}

initializeAuthStorage();

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
  tenantFeatures?: string[];
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
  | {
      authScope: number;
      refreshToken: string;
      promise: Promise<boolean>;
    }
  | null = null;

/*
 * Request-level GET deduplication only. This intentionally caches nothing:
 * completed responses are never retained, so critical financial/examination
 * data cannot become stale through this mechanism. Identical simultaneous
 * GETs share one in-flight request and the cache is isolated by the current
 * auth realm.
 */
const inflightGetRequests = new Map<number, Map<string, Promise<unknown>>>();

function getInflightMap(): Map<string, Promise<unknown>> {
  let map = inflightGetRequests.get(authCacheScope);
  if (!map) {
    map = new Map();
    inflightGetRequests.set(authCacheScope, map);
    if (inflightGetRequests.size > 2) {
      const oldest = [...inflightGetRequests.keys()].sort((a, b) => a - b)[0];
      if (oldest !== authCacheScope) inflightGetRequests.delete(oldest);
    }
  }
  return map;
}

/*
 * In-memory API caches must never survive an account transition. This value
 * changes whenever tokens are written or cleared and lets feature modules
 * scope their ephemeral caches without storing or deriving a cache key from
 * the access token itself.
 */
let authCacheScope = 0;
const authCacheScopeListeners = new Set<() => void>();

function notifyAuthCacheScopeChanged(): void {
  // A faulty subscriber must not block other caches from invalidating.
  for (const listener of authCacheScopeListeners) {
    try {
      listener();
    } catch {
      // Authentication state changes must not depend on UI listener success.
    }
  }
}

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

export class HttpRequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpRequestError";
    this.status = status;
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

  return getAuthStorage()?.getItem(
    ACCESS_TOKEN_KEY
  ) ?? null;
}

export function getRefreshToken():
  string | null {
  if (!isBrowser()) {
    return null;
  }

  return getAuthStorage()?.getItem(
    REFRESH_TOKEN_KEY
  ) ?? null;
}

export function setTokens(
  tokens: AuthTokens,
  options: { preserveSession?: boolean } = {},
): void {
  if (!isBrowser()) {
    return;
  }

  const storage =
    getAuthStorage();

  if (!storage) {
    throw new Error(
      "Browser session storage is unavailable"
    );
  }

  storage.setItem(
    ACCESS_TOKEN_KEY,
    tokens.accessToken
  );

  storage.setItem(
    REFRESH_TOKEN_KEY,
    tokens.refreshToken
  );

  // Refresh-token rotation replaces credentials for the same principal.
  // It must not invalidate identity/context requests that are part of that
  // refresh retry; account login/MFA flows keep the default invalidation.
  if (!options.preserveSession) {
    invalidateUserCache();
    authCacheScope += 1;
    notifyAuthCacheScopeChanged();
  }
}

export function clearTokens(): void {
  if (!isBrowser()) {
    return;
  }

  const storage =
    getAuthStorage();

  storage?.removeItem(
    ACCESS_TOKEN_KEY
  );

  storage?.removeItem(
    REFRESH_TOKEN_KEY
  );

  invalidateUserCache();
  authCacheScope += 1;
  notifyAuthCacheScopeChanged();
}

export function getAuthCacheScope(): number {
  return authCacheScope;
}

/**
 * Subscribe to credential/session transitions to invalidate ephemeral data
 * immediately instead of waiting for feature-cache TTLs to expire.
 */
export function subscribeAuthCacheScope(listener: () => void): () => void {
  authCacheScopeListeners.add(listener);
  return () => {
    authCacheScopeListeners.delete(listener);
  };
}

/*
 * Session isolation invariant:
 *
 * Every function below resolves credentials from this tab's sessionStorage
 * only. There is deliberately no storage-event/BroadcastChannel auth
 * synchronization and no origin-wide credential fallback.
 *
 * Module-level caches (cachedUser/currentUserRequest/refreshRequest) are
 * also naturally tab-scoped because each browser tab has its own JS realm.
 */
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

  const requestAuthScope = authCacheScope;
  const request = Promise.resolve()
    .then(() => {
      // Do not even send /auth/me if credentials changed before the request
      // started scheduling.
      if (!isSessionCurrent(requestAuthScope, authCacheScope)) {
        throw new Error("Session changed during identity verification. Please retry.");
      }
      return authedFetch<ApiEnvelope<AuthUser>>("/auth/me");
    })
    .then((response) => {
      // Credentials can change while /auth/me is in flight. Never let the
      // previous principal overwrite cached identity for the new session.
      if (!isSessionCurrent(requestAuthScope, authCacheScope)) {
        throw new Error("Session changed during identity verification. Please retry.");
      }

      const previousAuthorization = authorizationContextKey(cachedUser);
      const user = validateUser(response.data);

      cachedUser = user;
      cachedUserAt = Date.now();

      // Roles, permissions and tenant features can be revoked server-side
      // without rotating a browser token. Invalidate dependent caches when
      // a fresh /auth/me changes the effective authorization context.
      if (
        previousAuthorization !== null &&
        previousAuthorization !== authorizationContextKey(user)
      ) {
        authCacheScope += 1;
        notifyAuthCacheScopeChanged();
      }

      return user;
    })
    .finally(() => {
      // An older request must never clear a newer session's in-flight pointer.
      if (currentUserRequest === request) currentUserRequest = null;
    });

  currentUserRequest = request;
  return request;
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

async function tryRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  const requestAuthScope = authCacheScope;
  if (
    refreshRequest &&
    refreshRequest.authScope === requestAuthScope &&
    refreshRequest.refreshToken === refreshToken
  ) {
    return refreshRequest.promise;
  }

  const request = Promise.resolve().then(async () => {
    try {
      if (
        !isSessionCurrent(requestAuthScope, authCacheScope) ||
        getRefreshToken() !== refreshToken
      ) return false;

      const res = await fetchWithTimeout(
        apiUrl("/auth/refresh"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        },
        REFRESH_TIMEOUT_MS,
      );

      // The refresh response is bound to the credentials it was sent with.
      // A late 401/network failure must not clear a newly signed-in account,
      // and a late success must not install its old account's tokens.
      if (
        !isSessionCurrent(requestAuthScope, authCacheScope) ||
        getRefreshToken() !== refreshToken
      ) return false;

      if (!res.ok) {
        clearTokens();
        return false;
      }

      const body = await res.json() as ApiEnvelope<{ tokens: AuthTokens }>;
      if (
        !isSessionCurrent(requestAuthScope, authCacheScope) ||
        getRefreshToken() !== refreshToken
      ) return false;

      setTokens(body.data.tokens, { preserveSession: true });
      return true;
    } catch {
      if (
        isSessionCurrent(requestAuthScope, authCacheScope) &&
        getRefreshToken() === refreshToken
      ) clearTokens();
      return false;
    } finally {
      // Do not clear a newer session's refresh request.
      if (refreshRequest?.promise === request) refreshRequest = null;
    }
  });

  refreshRequest = {
    authScope: requestAuthScope,
    refreshToken,
    promise: request,
  };
  return request;
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

export async function authedDownload(path:string):Promise<{blob:Blob;filename:string}>{
 let token=getAccessToken();if(!token)throw new AuthRequiredError();
 let res=await fetchWithTimeout(apiUrl(path),{headers:{Authorization:`Bearer ${token}`}});
 if(res.status===401&&await tryRefresh()){token=getAccessToken();res=await fetchWithTimeout(apiUrl(path),{headers:{Authorization:`Bearer ${token}`}});}
 if(!res.ok)throw new Error(`Download failed (${res.status})`);
 const disposition=res.headers.get("content-disposition")||"";const match=/filename="?([^"]+)"?/i.exec(disposition);
 return{blob:await res.blob(),filename:match?.[1]||"acadlyx-export"};
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

  const method = (init?.method || "GET").toUpperCase();
  const requestHeaders = new Headers(init?.headers);

  if (
    !requestHeaders.has("Content-Type") &&
    !(init?.body instanceof FormData)
  ) {
    requestHeaders.set("Content-Type", "application/json");
  }

  if (
    method === "POST" ||
    method === "PUT" ||
    method === "PATCH" ||
    method === "DELETE"
  ) {
    if (!requestHeaders.has("X-Idempotency-Key")) {
      requestHeaders.set(
        "X-Idempotency-Key",
        createMutationKey("authed"),
      );
    }
  }

  const performFetch = async (currentToken: string) => {
    requestHeaders.set(
      "Authorization",
      `Bearer ${currentToken}`,
    );

    return fetchWithTimeout(
      apiUrl(path),
      {
        ...init,
        headers: requestHeaders,
      },
    );
  };

  const dedupeEligible =
    method === "GET" &&
    !init?.signal &&
    Array.from(requestHeaders.keys()).length === 1 &&
    requestHeaders.has("Content-Type");

  const inflightMap = dedupeEligible ? getInflightMap() : null;
  const inflightKey = dedupeEligible ? path : null;

  if (inflightMap && inflightKey) {
    const existing = inflightMap.get(inflightKey);
    if (existing) return existing as Promise<T>;
  }

  const request = (async (): Promise<T> => {
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

    throw new HttpRequestError(
      res.status,
      body?.error?.message || `Request failed: ${res.status}`,
    );
  }

    return res.json() as Promise<T>;
  })();

  if (inflightMap && inflightKey) {
    inflightMap.set(inflightKey, request);
    const cleanupInflightRequest = () => {
      if (inflightMap.get(inflightKey) === request) {
        inflightMap.delete(inflightKey);
      }
    };
    // finally() creates a second rejected promise when the request fails.
    // If that promise is discarded, browsers report an unhandled rejection
    // even when the original caller correctly catches the API error.
    void request.then(cleanupInflightRequest, cleanupInflightRequest);
  }

  return request;
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

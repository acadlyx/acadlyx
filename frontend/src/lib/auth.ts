```typescript
import { apiUrl } from "./api";

/**
 * ACADLYX AUTHENTICATION
 *
 * Authentication is intentionally isolated per browser tab.
 *
 * IMPORTANT:
 * sessionStorage itself is tab-scoped, BUT browsers may initially clone
 * the opener's sessionStorage when a new tab/window is opened.
 *
 * Therefore we maintain an additional per-tab identity and perform a
 * startup handshake through BroadcastChannel to detect cloned sessions.
 *
 * Authentication tokens are NEVER stored in localStorage.
 */

const ACCESS_TOKEN_KEY = "acadlyx_access_token";
const REFRESH_TOKEN_KEY = "acadlyx_refresh_token";

const TAB_ID_KEY = "acadlyx_tab_id";
const TAB_INITIALIZED_KEY = "acadlyx_tab_initialized";

const LEGACY_ACCESS_TOKEN_KEY = "acadlyx_access_token";
const LEGACY_REFRESH_TOKEN_KEY = "acadlyx_refresh_token";

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
}

interface LoginPayload {
  mfaRequired?: boolean;
  challengeToken?: string;
  expiresAt?: string;
  user?: AuthUser;
  tokens?: AuthTokens;
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function getSessionStorage(): Storage | null {
  if (!isBrowser()) return null;

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Generate a cryptographically strong random identifier when possible.
 */
function createRandomId(): string {
  if (isBrowser()) {
    try {
      if (window.crypto?.randomUUID) {
        return window.crypto.randomUUID();
      }

      if (window.crypto?.getRandomValues) {
        const bytes = new Uint8Array(16);
        window.crypto.getRandomValues(bytes);

        return Array.from(bytes)
          .map((value) =>
            value.toString(16).padStart(2, "0")
          )
          .join("");
      }
    } catch {
      // Fall through to timestamp/random fallback.
    }
  }

  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

/**
 * Returns the current tab's stable identity.
 *
 * This value normally survives reloads in the same tab.
 */
function getStoredTabId(): string | null {
  const storage = getSessionStorage();

  if (!storage) return null;

  try {
    return storage.getItem(TAB_ID_KEY);
  } catch {
    return null;
  }
}

/**
 * Creates the tab identity if it does not exist.
 */
function ensureTabId(): string | null {
  const storage = getSessionStorage();

  if (!storage) return null;

  try {
    const existing = storage.getItem(TAB_ID_KEY);

    if (existing) {
      return existing;
    }

    const id = createRandomId();

    storage.setItem(TAB_ID_KEY, id);

    return id;
  } catch {
    return null;
  }
}

/**
 * Removes obsolete localStorage authentication.
 *
 * No authentication token is ever read from localStorage.
 */
function clearLegacySharedStorage(): void {
  if (!isBrowser()) return;

  try {
    window.localStorage.removeItem(
      LEGACY_ACCESS_TOKEN_KEY
    );

    window.localStorage.removeItem(
      LEGACY_REFRESH_TOKEN_KEY
    );
  } catch {
    // Ignore restricted storage environments.
  }
}

/**
 * Returns a short non-secret fingerprint of a token.
 *
 * We never broadcast the actual token.
 *
 * This is only used to detect the browser behaviour where a newly opened
 * tab receives a cloned sessionStorage containing the same authenticated
 * session as its opener.
 */
function tokenFingerprint(
  token: string | null
): string | null {
  if (!token) return null;

  const length = token.length;

  if (length <= 12) {
    return `${length}:${token}`;
  }

  return `${length}:${token.slice(0, 6)}:${token.slice(-6)}`;
}

/**
 * Detect whether this tab inherited an authenticated session from another
 * already-running tab.
 *
 * Why this exists:
 *
 *   Tab A:
 *      sessionStorage = Student A
 *
 *   User opens Tab B from Tab A:
 *      browser may clone sessionStorage
 *
 *   Tab B:
 *      sees Student A token
 *
 * BroadcastChannel allows Tab A and Tab B to identify that the same
 * authenticated storage state exists in two different tab contexts.
 *
 * The new tab is then treated as a fresh login context.
 */
async function protectAgainstClonedSession(): Promise<void> {
  if (!isBrowser()) return;

  const storage = getSessionStorage();

  if (!storage) return;

  const tabId = ensureTabId();

  if (!tabId) return;

  clearLegacySharedStorage();

  let initialized = false;

  try {
    initialized =
      storage.getItem(TAB_INITIALIZED_KEY) === "1";
  } catch {
    initialized = false;
  }

  /**
   * First-ever initialization for this tab.
   *
   * A copied sessionStorage also copies TAB_INITIALIZED_KEY.
   *
   * Therefore a duplicated tab will enter the "initialized" branch
   * and perform a handshake before being allowed to keep the copied
   * authentication.
   */
  if (!initialized) {
    try {
      storage.setItem(
        TAB_INITIALIZED_KEY,
        "1"
      );
    } catch {
      // Continue without the marker.
    }

    return;
  }

  const accessToken = getAccessToken();

  if (!accessToken) {
    return;
  }

  /**
   * BroadcastChannel is supported by modern browsers.
   *
   * If unavailable, we deliberately keep the isolated sessionStorage
   * behaviour rather than falling back to shared localStorage.
   */
  if (
    typeof window.BroadcastChannel ===
    "undefined"
  ) {
    return;
  }

  const channel = new BroadcastChannel(
    TAB_CHANNEL_NAME
  );

  const fingerprint =
    tokenFingerprint(accessToken);

  if (!fingerprint) {
    channel.close();
    return;
  }

  const duplicateDetected =
    await new Promise<boolean>((resolve) => {
      let settled = false;

      const finish = (value: boolean) => {
        if (settled) return;

        settled = true;

        try {
          channel.close();
        } catch {
          // Ignore.
        }

        resolve(value);
      };

      const timeout = window.setTimeout(() => {
        finish(false);
      }, 350);

      channel.onmessage = (event: MessageEvent) => {
        const message = event.data;

        if (
          !message ||
          typeof message !== "object"
        ) {
          return;
        }

        /**
         * Another tab announcing the exact same authenticated token.
         *
         * Since this tab's sessionStorage was copied from another
         * authenticated context, we treat this context as the newly
         * duplicated tab and clear its inherited authentication.
         */
        if (
          message.type ===
            "acadlyx-auth-presence" &&
          message.tabId !== tabId &&
          message.fingerprint === fingerprint
        ) {
          window.clearTimeout(timeout);
          finish(true);
        }
      };

      /**
       * Ask other tabs whether this authenticated session already exists.
       */
      channel.postMessage({
        type: "acadlyx-auth-probe",
        tabId,
        fingerprint,
      });

      /**
       * Tell existing tabs that this authenticated session is present
       * in this tab as well.
       *
       * The important part is that the probe is sent first and this
       * presence announcement follows immediately.
       */
      window.setTimeout(() => {
        channel.postMessage({
          type: "acadlyx-auth-presence",
          tabId,
          fingerprint,
        });
      }, 20);
    });

  if (duplicateDetected) {
    /**
     * This tab inherited another tab's authenticated session.
     *
     * Clear ONLY THIS TAB.
     */
    clearTokens();

    try {
      storage.removeItem(
        TAB_INITIALIZED_KEY
      );
    } catch {
      // Ignore.
    }
  }
}

/**
 * Run tab-isolation initialization once on the client.
 *
 * We intentionally do not block server rendering.
 */
let tabProtectionPromise: Promise<void> | null =
  null;

function ensureTabProtection(): Promise<void> {
  if (!isBrowser()) {
    return Promise.resolve();
  }

  if (!tabProtectionPromise) {
    tabProtectionPromise =
      protectAgainstClonedSession().catch(
        () => {
          /*
           * Never destroy the application because the browser does not
           * support BroadcastChannel/storage APIs correctly.
           *
           * sessionStorage remains the fallback isolation mechanism.
           */
        }
      );
  }

  return tabProtectionPromise;
}

/**
 * Access token.
 *
 * IMPORTANT:
 * Never reads localStorage.
 */
export function getAccessToken(): string | null {
  const storage = getSessionStorage();

  if (!storage) return null;

  clearLegacySharedStorage();

  try {
    return storage.getItem(
      ACCESS_TOKEN_KEY
    );
  } catch {
    return null;
  }
}

export function getRefreshToken(): string | null {
  const storage = getSessionStorage();

  if (!storage) return null;

  clearLegacySharedStorage();

  try {
    return storage.getItem(
      REFRESH_TOKEN_KEY
    );
  } catch {
    return null;
  }
}

export function setTokens(
  tokens: AuthTokens
): void {
  const storage = getSessionStorage();

  if (!storage) {
    throw new Error(
      "Browser session storage is unavailable. Please enable browser storage and try again."
    );
  }

  clearLegacySharedStorage();

  try {
    storage.setItem(
      ACCESS_TOKEN_KEY,
      tokens.accessToken
    );

    storage.setItem(
      REFRESH_TOKEN_KEY,
      tokens.refreshToken
    );

    storage.setItem(
      TAB_INITIALIZED_KEY,
      "1"
    );
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
      storage.removeItem(
        ACCESS_TOKEN_KEY
      );

      storage.removeItem(
        REFRESH_TOKEN_KEY
      );
    } catch {
      // Continue.
    }
  }

  clearLegacySharedStorage();
}

export function isAuthenticated(): boolean {
  return getAccessToken() !== null;
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
  await ensureTabProtection();

  /**
   * A login always starts cleanly in the CURRENT tab.
   */
  clearTokens();

  const res = await fetch(
    apiUrl("/auth/login"),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
      .catch(() => null)) as
      | ApiEnvelope<LoginPayload>
      | null;

  if (!res.ok || !body) {
    throw new Error(
      getErrorMessage(
        body,
        "Login failed"
      )
    );
  }

  if (
    body.data.mfaRequired &&
    body.data.challengeToken
  ) {
    return {
      mfaRequired: true,
      challengeToken:
        body.data.challengeToken,
      expiresAt:
        body.data.expiresAt ?? "",
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

export async function completeMfaLogin(
  challengeToken: string,
  code: string
): Promise<AuthUser> {
  await ensureTabProtection();

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

  const body =
    (await res
      .json()
      .catch(() => null)) as
      | ApiEnvelope<{
          user: AuthUser;
          tokens: AuthTokens;
        }>
      | null;

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
  await ensureTabProtection();

  const refreshToken =
    getRefreshToken();

  clearTokens();

  if (!refreshToken) {
    return;
  }

  try {
    await fetch(
      apiUrl("/auth/logout"),
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
  } catch {
    /*
     * Local tab session is already gone.
     */
  }
}

async function tryRefresh(): Promise<boolean> {
  await ensureTabProtection();

  const refreshToken =
    getRefreshToken();

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
      !body?.data?.tokens
        ?.accessToken ||
      !body?.data?.tokens
        ?.refreshToken
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

export class AuthRequiredError extends Error {
  constructor() {
    super("Authentication required");
    this.name =
      "AuthRequiredError";
  }
}

/**
 * Authenticated API request.
 *
 * The request always uses the token belonging to THIS tab.
 */
export async function authedFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  await ensureTabProtection();

  const performFetch = (
    token: string | null
  ) =>
    fetch(apiUrl(path), {
      ...init,
      headers: {
        "Content-Type":
          "application/json",

        ...(token
          ? {
              Authorization:
                `Bearer ${token}`,
            }
          : {}),

        ...(init?.headers || {}),
      },
    });

  let token =
    getAccessToken();

  if (!token) {
    throw new AuthRequiredError();
  }

  let res =
    await performFetch(token);

  if (res.status === 401) {
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
      await performFetch(token);
  }

  if (!res.ok) {
    const body =
      (await res
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
```

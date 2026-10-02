/**
 * Central API configuration.
 *
 * All public/client data-fetching code should build request URLs from here.
 * Authenticated requests use `authedFetch` from `auth.ts`, which owns token
 * refresh, request de-duplication and timeout handling.
 */

const defaultApiUrl =
  process.env.NODE_ENV === "production"
    ? "https://acadlyx-api.onrender.com"
    : "http://localhost:5001";

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ||
  defaultApiUrl
).replace(/\/$/, "");

export const API_VERSION = "v1";

const PUBLIC_REQUEST_TIMEOUT_MS =
  30_000;

export function apiUrl(
  path: string,
): string {
  const cleanPath =
    path.startsWith("/")
      ? path
      : `/${path}`;

  return `${API_BASE_URL}/api/${API_VERSION}${cleanPath}`;
}

export interface ApiSuccess<T> {
  success: true;
  [key: string]: unknown;
  data?: T;
}

export interface ApiError {
  success: false;
  error: {
    message: string;
    requestId?: string;
  };
}

export class ApiRequestTimeoutError
  extends Error
{
  constructor(
    message =
      "The server took too long to respond. Please try again.",
  ) {
    super(message);
    this.name =
      "ApiRequestTimeoutError";
  }
}

async function fetchWithTimeout(
  input:
    | RequestInfo
    | URL,
  init?: RequestInit,
  timeoutMs =
    PUBLIC_REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller =
    new AbortController();

  let timedOut = false;

  const timer =
    window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

  let removeParentAbortListener:
    | (() => void)
    | null = null;

  if (init?.signal) {
    if (init.signal.aborted) {
      controller.abort();
    } else {
      const handleParentAbort =
        () =>
          controller.abort();

      init.signal.addEventListener(
        "abort",
        handleParentAbort,
        {
          once: true,
        },
      );

      removeParentAbortListener =
        () => {
          init.signal?.removeEventListener(
            "abort",
            handleParentAbort,
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
      },
    );
  } catch (error) {
    if (
      timedOut &&
      error instanceof Error &&
      error.name ===
        "AbortError"
    ) {
      throw new ApiRequestTimeoutError();
    }

    throw error;
  } finally {
    window.clearTimeout(
      timer,
    );

    removeParentAbortListener?.();
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res =
    await fetchWithTimeout(
      apiUrl(path),
      {
        ...init,
        headers: {
          "Content-Type":
            "application/json",
          ...(init?.headers || {}),
        },
      },
    );

  const body =
    (await res
      .json()
      .catch(() => null)) as
      | ApiError
      | null;

  if (!res.ok) {
    throw new Error(
      body?.error?.message ||
        `Request failed: ${res.status}`,
    );
  }

  return body as T;
}

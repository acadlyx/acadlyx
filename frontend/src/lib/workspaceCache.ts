import { authedFetch } from "./auth";

/**
 * Short-lived, tab-local cache for workspace-wide GET requests.
 *
 * These endpoints are read-mostly and are requested by several shell-level
 * components during the same navigation. Deduplicating them prevents the
 * dashboard shell, CMS provider, and page from independently waking the
 * API.
 */
const CACHE_TTL_MS = 60_000;

type Entry = {
  expiresAt: number;
  value: unknown;
};

const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

export async function workspaceGet<T>(path: string): Promise<T> {
  const now = Date.now();
  const cached = cache.get(path);

  if (cached && cached.expiresAt > now) {
    return cached.value as T;
  }

  if (cached) cache.delete(path);

  const existing = inflight.get(path);
  if (existing) return existing as Promise<T>;

  const request = authedFetch<T>(path).then((value) => {
    cache.set(path, {
      value,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return value;
  }).finally(() => {
    inflight.delete(path);
  });

  inflight.set(path, request);
  return request;
}

export function invalidateWorkspaceCache(pathPrefix?: string): void {
  if (!pathPrefix) {
    cache.clear();
    return;
  }

  for (const key of cache.keys()) {
    if (key.startsWith(pathPrefix)) cache.delete(key);
  }
}

import { authedFetch, getAuthCacheScope } from "./auth";

/**
 * Short-lived, tab-local cache for workspace-wide GET requests.
 *
 * These endpoints are read-mostly and are requested by several shell-level
 * components during the same navigation. Deduplicating them prevents the
 * dashboard shell, CMS provider, and page from independently waking the
 * API.
 */
const CACHE_TTL_MS = 20_000;
const CACHE_MAX_ENTRIES = 100;
let cacheGeneration = 0;

type Entry = {
  expiresAt: number;
  value: unknown;
  path: string;
};

const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

function scopedKey(path: string): string {
  return `${getAuthCacheScope()}:${path}`;
}

export async function workspaceGet<T>(path: string): Promise<T> {
  const key = scopedKey(path);
  const now = Date.now();
  const cached = cache.get(key);

  if (cached && cached.expiresAt > now) {
    return cached.value as T;
  }

  if (cached) cache.delete(key);

  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;

  const generationAtStart = cacheGeneration;
  const request = authedFetch<T>(path).then((value) => {
    // A mutation may invalidate this request while it is still running.
    // Never allow its older response to repopulate an invalidated cache.
    if (generationAtStart === cacheGeneration) {
      const timestamp = Date.now();
      for (const [existingKey, entry] of cache) {
        if (entry.expiresAt <= timestamp) cache.delete(existingKey);
      }
      while (cache.size >= CACHE_MAX_ENTRIES) {
        const oldestKey = cache.keys().next().value;
        if (oldestKey === undefined) break;
        cache.delete(oldestKey);
      }
      cache.set(key, {
        value,
        path,
        expiresAt: timestamp + CACHE_TTL_MS,
      });
    }
    return value;
  }).finally(() => {
    if (inflight.get(key) === request) inflight.delete(key);
  });

  inflight.set(key, request);
  return request;
}

export function invalidateWorkspaceCache(pathPrefix?: string): void {
  cacheGeneration += 1;
  const matches = (path: string) => !pathPrefix || path.startsWith(pathPrefix);

  for (const [key, entry] of cache) {
    if (matches(entry.path)) cache.delete(key);
  }

  // Drop matching deduplication entries too, so future reads cannot reuse an
  // older pending result after a successful write.
  for (const key of inflight.keys()) {
    const path = key.slice(key.indexOf(":") + 1);
    if (matches(path)) inflight.delete(key);
  }
}

/**
 * Pure session-bound cache helpers shared by workspace cache logic and tests.
 * Session scopes are local monotonic identifiers; raw access tokens are never
 * part of cache keys or retained as cache metadata.
 */
export function sessionScopedCacheKey(sessionScope, params) {
  const selectorKey = Object.entries(params)
    .filter(([, value]) => Boolean(value))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return `${sessionScope}:${selectorKey}`;
}

export function isSessionCurrent(requestedScope, currentScope) {
  return requestedScope === currentScope;
}

export function canApplySessionResponse(
  requestedScope,
  currentScope,
  requestedGeneration,
  currentGeneration,
) {
  return isSessionCurrent(requestedScope, currentScope)
    && requestedGeneration === currentGeneration;
}

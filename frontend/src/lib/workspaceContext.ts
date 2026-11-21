"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  authedFetch,
  getAuthCacheScope,
  subscribeAuthCacheScope,
} from "./auth";
import {
  canApplySessionResponse,
  isSessionCurrent,
  isWorkspaceResultCurrent,
  sessionScopedCacheKey,
} from "./sessionScopedCache.mjs";

const CONTEXT_CACHE_TTL_MS = 30_000;
const contextCache = new Map<string, { value: WorkspaceContext; expiresAt: number }>();
const contextInflight = new Map<string, Promise<WorkspaceContext>>();

export function clearWorkspaceContextCache(): void {
  contextCache.clear();
  contextInflight.clear();
}

async function fetchWorkspaceContext(
  params: Record<string, string | undefined>,
  authScope: number,
): Promise<WorkspaceContext> {
  // Context IDs alone are not an identity boundary: two users can request the
  // same selectors while having different permitted records.
  const key = sessionScopedCacheKey(authScope, params);
  const cached = contextCache.get(key);
  const now = Date.now();

  if (cached && cached.expiresAt > now) return cached.value;

  const inflight = contextInflight.get(key);
  if (inflight) return inflight;

  const query = new URLSearchParams();
  Object.entries(params).forEach(([name, value]) => {
    if (value) query.set(name, value);
  });

  const suffix = query.toString();
  const request = Promise.resolve().then(() => authedFetch<{
    success: boolean;
    data: WorkspaceContext;
  }>(`/workspace/context${suffix ? `?${suffix}` : ""}`))
    .then((response) => {
      // Do not let a response authenticated as a previous user populate the
      // new session's cache, even if the selector parameters are identical.
      if (!isSessionCurrent(authScope, getAuthCacheScope())) {
        throw new Error("Workspace context changed during request. Please retry.");
      }
      contextCache.set(key, {
        value: response.data,
        expiresAt: Date.now() + CONTEXT_CACHE_TTL_MS,
      });
      return response.data;
    })
    .finally(() => {
      // A cleared/restarted request may already have replaced this entry.
      if (contextInflight.get(key) === request) contextInflight.delete(key);
    });

  contextInflight.set(key, request);
  return request;
}

export type WorkspaceBreadcrumb = {
  type: string;
  id: string;
  label: string;
  href: string;
};

export type WorkspaceContext = {
  role: string;
  institution?: { name: string; logoUrl: string | null };
  scope: {
    institutionId: string;
    campusId: string | null;
    departmentId: string | null;
    programId: string | null;
    academicYearId: string | null;
    semesterId: string | null;
    sectionId: string | null;
    batchId: string | null;
  };
  breadcrumbs: WorkspaceBreadcrumb[];
  children: {
    campuses: Array<{ id: string; name: string; code: string }>;
    departments: Array<{ id: string; name: string; code: string }>;
    programs: Array<{ id: string; name: string; code: string; level: string; durationYears: number; departmentId: string }>;
    academicYears: Array<{ id: string; name: string; startDate: string; endDate: string; isCurrent: boolean }>;
    batches: Array<{ id: string; name: string; code: string; programId: string; admissionYear: number; completionYear: number }>;
    semesters: Array<{ id: string; name: string; number: number; programId: string; academicYearId: string }>;
    sections: Array<{ id: string; name: string; capacity: number | null; semesterId: string }>;
  };
};

export function useWorkspaceContext(params: Record<string, string | undefined> = {}) {
  const [dataState, setDataState] = useState<{ requestKey: string; value: WorkspaceContext } | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<{ requestKey: string; message: string } | null>(null);
  const [authScope, setAuthScope] = useState(() => getAuthCacheScope());
  const requestGeneration = useRef(0);

  const serializedParams = JSON.stringify(params);
  const currentRequestKey = `${authScope}:${serializedParams}`;

  useEffect(() => subscribeAuthCacheScope(() => {
    // Immediately hide the previous account's context and invalidate any
    // pending callback before React starts the next session's request.
    requestGeneration.current += 1;
    clearWorkspaceContextCache();
    setDataState(null);
    setLoading(true);
    setErrorState(null);
    setAuthScope(getAuthCacheScope());
  }), []);

  const load = useCallback(async () => {
    const generation = ++requestGeneration.current;
    const requestedAuthScope = authScope;
    setLoading(true);
    setDataState(null);
    setErrorState(null);

    try {
      const requestParams = JSON.parse(serializedParams) as Record<string, string | undefined>;
      const value = await fetchWorkspaceContext(requestParams, requestedAuthScope);
      if (
        !canApplySessionResponse(
          requestedAuthScope,
          getAuthCacheScope(),
          generation,
          requestGeneration.current,
        )
      ) return;
      setDataState({ requestKey: `${requestedAuthScope}:${serializedParams}`, value });
    } catch (err) {
      if (
        !canApplySessionResponse(
          requestedAuthScope,
          getAuthCacheScope(),
          generation,
          requestGeneration.current,
        )
      ) return;
      setErrorState({
        requestKey: `${requestedAuthScope}:${serializedParams}`,
        message: err instanceof Error
          ? err.message
          : "Unable to load workspace context.",
      });
    } finally {
      if (
        canApplySessionResponse(
          requestedAuthScope,
          getAuthCacheScope(),
          generation,
          requestGeneration.current,
        )
      ) setLoading(false);
    }
  }, [serializedParams, authScope]);

  useEffect(() => {
    void load();
    return () => {
      // Ignore callbacks from abandoned selector requests.
      requestGeneration.current += 1;
    };
  }, [load]);

  // Derive visible state synchronously from the current session and selectors.
  // On the render before useEffect runs, a result keyed to the prior selector
  // must already be hidden rather than flashing stale authorized records.
  const data = dataState && isWorkspaceResultCurrent(dataState.requestKey, currentRequestKey)
    ? dataState.value
    : null;
  const error = errorState && isWorkspaceResultCurrent(errorState.requestKey, currentRequestKey)
    ? errorState.message
    : "";
  const hasCurrentResult = data !== null || error.length > 0;
  return { data, loading: loading || !hasCurrentResult, error, reload: load };
}

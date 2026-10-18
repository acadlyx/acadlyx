"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  authedFetch,
  getAuthCacheScope,
  subscribeAuthCacheScope,
} from "./auth";

const CONTEXT_CACHE_TTL_MS = 30_000;
const contextCache = new Map<string, { value: WorkspaceContext; expiresAt: number }>();
const contextInflight = new Map<string, Promise<WorkspaceContext>>();

function contextKey(params: Record<string, string | undefined>): string {
  return Object.entries(params)
    .filter(([, value]) => Boolean(value))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

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
  const key = `${authScope}:${contextKey(params)}`;
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
  let request: Promise<WorkspaceContext>;
  request = authedFetch<{
    success: boolean;
    data: WorkspaceContext;
  }>(`/workspace/context${suffix ? `?${suffix}` : ""}`)
    .then((response) => {
      // Do not let a response authenticated as a previous user populate the
      // new session's cache, even if the selector parameters are identical.
      if (getAuthCacheScope() !== authScope) {
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
  scope: {
    institutionId: string;
    departmentId: string | null;
    programId: string | null;
    academicYearId: string | null;
    semesterId: string | null;
    sectionId: string | null;
    batchId: string | null;
  };
  breadcrumbs: WorkspaceBreadcrumb[];
  children: {
    departments: Array<{ id: string; name: string; code: string }>;
    programs: Array<{ id: string; name: string; code: string; level: string; durationYears: number; departmentId: string }>;
    academicYears: Array<{ id: string; name: string; startDate: string; endDate: string; isCurrent: boolean }>;
    batches: Array<{ id: string; name: string; code: string; programId: string; admissionYear: number; completionYear: number }>;
    semesters: Array<{ id: string; name: string; number: number; programId: string; academicYearId: string }>;
    sections: Array<{ id: string; name: string; capacity: number | null; semesterId: string }>;
  };
};

export function useWorkspaceContext(params: Record<string, string | undefined> = {}) {
  const [data, setData] = useState<WorkspaceContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [authScope, setAuthScope] = useState(() => getAuthCacheScope());
  const requestGeneration = useRef(0);

  const serializedParams = JSON.stringify(params);

  useEffect(() => subscribeAuthCacheScope(() => {
    // Immediately hide the previous account's context and invalidate any
    // pending callback before React starts the next session's request.
    requestGeneration.current += 1;
    clearWorkspaceContextCache();
    setData(null);
    setLoading(true);
    setError("");
    setAuthScope(getAuthCacheScope());
  }), []);

  const load = useCallback(async () => {
    const generation = ++requestGeneration.current;
    const requestedAuthScope = authScope;
    setLoading(true);
    setData(null);
    setError("");

    try {
      const requestParams = JSON.parse(serializedParams) as Record<string, string | undefined>;
      const value = await fetchWorkspaceContext(requestParams, requestedAuthScope);
      if (
        requestGeneration.current !== generation ||
        getAuthCacheScope() !== requestedAuthScope
      ) return;
      setData(value);
    } catch (err) {
      if (
        requestGeneration.current !== generation ||
        getAuthCacheScope() !== requestedAuthScope
      ) return;
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load workspace context."
      );
    } finally {
      if (
        requestGeneration.current === generation &&
        getAuthCacheScope() === requestedAuthScope
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

  return { data, loading, error, reload: load };
}

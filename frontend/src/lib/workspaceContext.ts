"use client";

import { useCallback, useEffect, useState } from "react";
import { authedFetch } from "./auth";

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
): Promise<WorkspaceContext> {
  const key = contextKey(params);
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
  const request = authedFetch<{
    success: boolean;
    data: WorkspaceContext;
  }>(`/workspace/context${suffix ? `?${suffix}` : ""}`)
    .then((response) => {
      contextCache.set(key, {
        value: response.data,
        expiresAt: Date.now() + CONTEXT_CACHE_TTL_MS,
      });
      return response.data;
    })
    .finally(() => {
      contextInflight.delete(key);
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

  const serializedParams = JSON.stringify(params);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const value = await fetchWorkspaceContext(params);
      setData(value);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load workspace context."
      );
    } finally {
      setLoading(false);
    }
  }, [serializedParams]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, reload: load };
}

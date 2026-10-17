import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest, setActiveWorkspaceContext, WorkspaceContextIds } from "../api/client";
import { useAuth } from "../auth/AuthProvider";

export type WorkspaceItem = {
  id: string;
  name: string;
  code?: string | null;
  campus?: { id: string; name: string; code?: string | null } | null;
  departmentId?: string;
  programId?: string;
  academicYearId?: string;
  semesterId?: string;
  program?: { id: string; name: string; code?: string | null; departmentId: string };
  academicYear?: { id: string; name: string; isCurrent?: boolean };
  [key: string]: unknown;
};

export type WorkspaceContextPayload = {
  institution: { name: string; logoUrl?: string | null };
  role: string;
  scope: WorkspaceContextIds & { institutionId: string };
  breadcrumbs: Array<{ type: string; id: string; label: string; href: string }>;
  children: {
    campuses: WorkspaceItem[];
    departments: WorkspaceItem[];
    programs: WorkspaceItem[];
    academicYears: WorkspaceItem[];
    batches: WorkspaceItem[];
    semesters: WorkspaceItem[];
    sections: WorkspaceItem[];
  };
};

type DimensionKey = keyof WorkspaceContextIds;
const DIMENSION_KEYS: DimensionKey[] = [
  "campusId", "departmentId", "programId", "academicYearId", "batchId", "semesterId", "sectionId"
];

function contextPath(scope?: WorkspaceContextIds | null): string {
  const params = new URLSearchParams();
  for (const key of DIMENSION_KEYS) {
    const value = scope?.[key];
    if (typeof value === "string" && value.trim()) params.set(key, value);
  }
  const query = params.toString();
  return "/workspace/context" + (query ? "?" + query : "");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Workspace context could not be loaded. Check your connection and try again.";
}

type WorkspaceContextValue = {
  context: WorkspaceContextPayload | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  changeContext: (patch: Partial<Record<DimensionKey, string | null>>) => Promise<void>;
};

const WorkspaceContextState = createContext<WorkspaceContextValue | undefined>(undefined);

export function WorkspaceContextProvider({ children }: { children: React.ReactNode }) {
  const { user, status } = useAuth();
  const queryClient = useQueryClient();
  const [context, setContext] = useState<WorkspaceContextPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const acceptContext = useCallback((next: WorkspaceContextPayload) => {
    setActiveWorkspaceContext(next.scope);
    setContext(next);
    setError(null);
  }, []);

  const refresh = useCallback(async () => {
    if (status !== "authenticated" || !user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const next = await apiRequest<WorkspaceContextPayload>(contextPath(context?.scope));
      acceptContext(next);
    } catch (issue) {
      setError(errorMessage(issue));
    } finally {
      setLoading(false);
    }
  }, [acceptContext, context?.scope, status, user?.id]);

  useEffect(() => {
    let active = true;
    setContext(null);
    setError(null);
    setActiveWorkspaceContext(null);
    if (status !== "authenticated" || !user?.id) {
      setLoading(false);
      setSaving(false);
      return () => { active = false; };
    }

    setLoading(true);
    apiRequest<WorkspaceContextPayload>("/workspace/context")
      .then(async (next) => {
        if (!active) return;
        acceptContext(next);
        // Ensure any request that began before the initial context loaded is refreshed.
        await queryClient.invalidateQueries({ refetchType: "active" });
      })
      .catch((issue: unknown) => {
        if (active) setError(errorMessage(issue));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [acceptContext, queryClient, status, user?.id]);

  const changeContext = useCallback(async (patch: Partial<Record<DimensionKey, string | null>>) => {
    if (!context || saving) return;
    const requested: WorkspaceContextIds = { ...context.scope };
    for (const key of DIMENSION_KEYS) {
      if (Object.prototype.hasOwnProperty.call(patch, key)) requested[key] = patch[key] ?? null;
    }

    setSaving(true);
    setError(null);
    try {
      // The server validates every supplied identifier and returns the canonical context.
      const validated = await apiRequest<WorkspaceContextPayload>(contextPath(requested));
      // Update the API scope only after successful server validation. Resetting query state
      // prevents records fetched under the previous workspace from remaining on screen.
      await queryClient.cancelQueries();
      acceptContext(validated);
      await queryClient.resetQueries();
      await queryClient.invalidateQueries({ refetchType: "none" });
    } catch (issue) {
      setError(errorMessage(issue));
      throw issue;
    } finally {
      setSaving(false);
    }
  }, [acceptContext, context, queryClient, saving]);

  const value = useMemo<WorkspaceContextValue>(() => ({
    context, loading, saving, error, refresh, changeContext
  }), [context, loading, saving, error, refresh, changeContext]);

  return <WorkspaceContextState.Provider value={value}>{children}</WorkspaceContextState.Provider>;
}

export function useWorkspaceContext(): WorkspaceContextValue {
  const value = useContext(WorkspaceContextState);
  if (!value) throw new Error("useWorkspaceContext must be used within WorkspaceContextProvider.");
  return value;
}

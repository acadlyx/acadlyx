import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";
import { apiRequest, setActiveWorkspaceContext, WorkspaceContextIds } from "../api/client";
import { transitionWorkspaceContext } from "./workspaceScope.mjs";
import { colors, spacing } from "../ui/theme";
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

function workspaceStorageKey(userId: string, roles: string[], permissions: string[]): string {
  // Bind a remembered selector value to both the account and effective role
  // inputs. A permission/role refresh can therefore never revive a previous
  // workspace selection under a different authorization shape.
  return "acadlyx_workspace_context_v2:" + userId + ":" + [...roles].sort().join(",") + ":" + [...permissions].sort().join(",");
}

async function readStoredScope(key: string): Promise<WorkspaceContextIds | null> {
  try {
    const raw = await SecureStore.getItemAsync(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const scope: WorkspaceContextIds = {};
    for (const dimension of DIMENSION_KEYS) {
      const value = (parsed as Record<string, unknown>)[dimension];
      if (typeof value === "string" && value.trim()) scope[dimension] = value;
    }
    return Object.keys(scope).length ? scope : null;
  } catch {
    return null;
  }
}

async function storeScope(key: string, scope: WorkspaceContextIds): Promise<void> {
  const serializable: WorkspaceContextIds = {};
  for (const dimension of DIMENSION_KEYS) {
    const value = scope[dimension];
    if (typeof value === "string" && value.trim()) serializable[dimension] = value;
  }
  try { await SecureStore.setItemAsync(key, JSON.stringify(serializable)); } catch { /* Context remains valid for this session. */ }
}

async function clearStoredScope(key: string): Promise<void> {
  try { await SecureStore.deleteItemAsync(key); } catch { /* Best-effort cleanup of an invalid remembered scope. */ }
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
  const authorizationKey = user ? workspaceStorageKey(user.id, user.roles, user.permissions) : null;

  const acceptContext = useCallback((next: WorkspaceContextPayload) => {
    setActiveWorkspaceContext(next.scope);
    setContext(next);
    setError(null);
  }, []);

  const refresh = useCallback(async () => {
    if (status !== "authenticated" || !user?.id || !authorizationKey) return;
    setLoading(true);
    setError(null);
    try {
      const next = await apiRequest<WorkspaceContextPayload>(contextPath(context?.scope));
      await transitionWorkspaceContext(
        queryClient,
        () => acceptContext(next),
        () => storeScope(authorizationKey, next.scope)
      );
    } catch (issue) {
      try {
        // A currently selected campus/department may have been revoked since
        // the last load. Fall back to the server-authorized default rather than
        // keeping the revoked selection active in memory.
        const fallback = await apiRequest<WorkspaceContextPayload>("/workspace/context");
        await transitionWorkspaceContext(
          queryClient,
          () => acceptContext(fallback),
          () => storeScope(authorizationKey, fallback.scope)
        );
      } catch (fallbackIssue) {
        setError(errorMessage(fallbackIssue || issue));
      }
    } finally {
      setLoading(false);
    }
  }, [acceptContext, authorizationKey, context?.scope, status, user?.id]);

  useEffect(() => {
    let active = true;
    setContext(null);
    setError(null);
    setActiveWorkspaceContext(null);
    if (status !== "authenticated" || !user?.id || !authorizationKey) {
      setLoading(false);
      setSaving(false);
      return () => { active = false; };
    }
    // SUPER_ADMIN is a platform-level account without tenant identity. The
    // current workspace-context contract is intentionally tenant-scoped; do
    // not retry it as though this were a tenant session.
    if (user.roles.includes("SUPER_ADMIN")) {
      setLoading(false);
      setSaving(false);
      return () => { active = false; };
    }

    setLoading(true);
    (async () => {
      const remembered = await readStoredScope(authorizationKey);
      if (!active) return;
      try {
        // Re-validate persisted client state every launch. It is only a
        // convenience value, never a grant of access.
        const next = await apiRequest<WorkspaceContextPayload>(contextPath(remembered));
        if (!active) return;
        await transitionWorkspaceContext(
          queryClient,
          () => acceptContext(next),
          () => storeScope(authorizationKey, next.scope)
        );
        if (!active) return;
      } catch (issue) {
        if (remembered) await clearStoredScope(authorizationKey);
        if (!active) return;
        try {
          // A deleted or newly unauthorized saved item must not lock a user
          // out of their default server-authorized workspace.
          const fallback = await apiRequest<WorkspaceContextPayload>("/workspace/context");
          if (!active) return;
          await transitionWorkspaceContext(
            queryClient,
            () => acceptContext(fallback),
            () => storeScope(authorizationKey, fallback.scope)
          );
          if (!active) return;
        } catch (fallbackIssue) {
          if (active) setError(errorMessage(remembered ? fallbackIssue : issue));
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => { active = false; };
  }, [acceptContext, authorizationKey, queryClient, status, user?.id]);

  const changeContext = useCallback(async (patch: Partial<Record<DimensionKey, string | null>>) => {
    if (!context || saving || !authorizationKey) return;
    const requested: WorkspaceContextIds = { ...context.scope };
    for (const key of DIMENSION_KEYS) {
      if (Object.prototype.hasOwnProperty.call(patch, key)) requested[key] = patch[key] ?? null;
    }

    setSaving(true);
    setError(null);
    try {
      // The server validates every supplied identifier and returns the canonical context.
      const validated = await apiRequest<WorkspaceContextPayload>(contextPath(requested));
      // The transition helper cancels reads under the old scope before activating
      // the new one, persists only the server-returned scope, and resets the
      // entire query cache. Active screens refetch; inactive screens cannot
      // later reveal records cached under the previous context.
      await transitionWorkspaceContext(
        queryClient,
        () => acceptContext(validated),
        () => storeScope(authorizationKey, validated.scope)
      );
    } catch (issue) {
      setError(errorMessage(issue));
      throw issue;
    } finally {
      setSaving(false);
    }
  }, [acceptContext, authorizationKey, context, queryClient, saving]);

  const value = useMemo<WorkspaceContextValue>(() => ({
    context, loading, saving, error, refresh, changeContext
  }), [context, loading, saving, error, refresh, changeContext]);

  const tenantContextRequired = status === "authenticated" && Boolean(user) && !user?.roles.includes("SUPER_ADMIN");
  const mustWaitForValidatedContext = tenantContextRequired && !context && !error;

  return <WorkspaceContextState.Provider value={value}>
    {mustWaitForValidatedContext ? (
      <View style={{ flex: 1, backgroundColor: colors.canvas, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md }}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>Loading authorized workspace</Text>
        <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: "center" }}>Validating your saved academic scope before loading records.</Text>
      </View>
    ) : children}
  </WorkspaceContextState.Provider>;
}

export function useWorkspaceContext(): WorkspaceContextValue {
  const value = useContext(WorkspaceContextState);
  if (!value) throw new Error("useWorkspaceContext must be used within WorkspaceContextProvider.");
  return value;
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { authedFetch } from "./auth";

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
  };
  breadcrumbs: WorkspaceBreadcrumb[];
  children: {
    departments: Array<{ id: string; name: string; code: string }>;
    programs: Array<{ id: string; name: string; code: string; level: string; durationYears: number; departmentId: string }>;
    academicYears: Array<{ id: string; name: string; startDate: string; endDate: string; isCurrent: boolean }>;
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
      const query = new URLSearchParams();
      Object.entries(params).forEach(([name, value]) => {
        if (value) query.set(name, value);
      });

      const suffix = query.toString();
      const response = await authedFetch<{
        success: boolean;
        data: WorkspaceContext;
      }>(`/workspace/context${suffix ? `?${suffix}` : ""}`);

      setData(response.data);
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

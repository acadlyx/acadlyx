export interface WorkspaceContextIds {
  campusId?: string | null;
  departmentId?: string | null;
  programId?: string | null;
  academicYearId?: string | null;
  batchId?: string | null;
  semesterId?: string | null;
  sectionId?: string | null;
}
export declare function setActiveWorkspaceContext(scope?: WorkspaceContextIds | null): void;
export declare function applyWorkspaceContext(path: string, enabled: boolean): string;
export interface WorkspaceQueryCache {
  getAll(): Array<{ reset(): void }>;
}
export interface WorkspaceQueryClient {
  cancelQueries(): Promise<unknown>;
  getQueryCache(): WorkspaceQueryCache;
  invalidateQueries(filters: { refetchType: "active" | "all" | "inactive" | "none" }): Promise<unknown>;
}
export declare function transitionWorkspaceContext(
  queryClient: WorkspaceQueryClient,
  activateScope: () => void,
  persistScope: () => Promise<unknown>
): Promise<void>;

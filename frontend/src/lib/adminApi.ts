import { authedFetch } from "./auth";

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface AdminUserRole {
  id: string;
  name: string;
  description?: string | null;
}

export interface AdminUser {
  id: string;
  institutionId?: string | null;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  roles: AdminUserRole[];
  departmentAccesses?: Array<{
    departmentId: string;
    departmentName: string;
    departmentCode?: string | null;
    scope?: string;
  }>;
}

export interface UserDeletionRequest {
  id: string;
  institutionId?: string | null;
  targetUserId?: string | null;

  targetUser: {
    id?: string | null;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  };

  requester: {
    id?: string | null;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  };

  approver?: {
    id?: string | null;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  } | null;

  status:
    | "PENDING"
    | "APPROVED"
    | "REJECTED";

  reason?: string | null;

  createdAt: string;
  reviewedAt?: string | null;

  canApprove: boolean;
}

export interface PermanentDeletionResult {
  userId?: string;

  requestId?: string;

  targetUserId?: string;

  targetEmail?: string;

  targetRole?: string;

  status?: "PENDING";

  permanentlyDeleted?: boolean;

  message?: string;
}

export interface AdminWorkspaceStats {
  users: number;
  students: number;
  faculty: number;
  departments: number;
  programs: number;
  academicYears: number;
  semesters: number;
  sections: number;
  courses: number;
  offerings: number;
  campuses: number;
  timetableEntries: number;
  notices: number;
  documents: number;
  notifications: number;
  parentLinks: number;
  admissions: number;
  registrations: number;
  promotions: number;
  certificates: number;
  auditLogs: number;
  usersWithProfilePhoto: number;
  usersMissingProfilePhoto: number;

  [key: string]: number;
}

export interface AdminWorkspaceModules {
  users: boolean;
  students: boolean;
  academicStructure: boolean;
  campuses: boolean;
  timetable: boolean;
  notices: boolean;
  calendar: boolean;
  notifications: boolean;
  documents: boolean;
  operations: boolean;
  admissions: boolean;
  registration: boolean;
  promotions: boolean;
  certificates: boolean;
  reports: boolean;
  intelligence: boolean;
  parentLinks: boolean;
  audit: boolean;
  maintenance: boolean;

  [key: string]: boolean;
}

export interface AdminWorkspace {
  workspaceType:
    "INSTITUTION_ADMIN";

  stats:
    AdminWorkspaceStats;

  modules:
    AdminWorkspaceModules;
}

export interface CreateAdminUserInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  password: string;
  role: string;
  departmentIds?: string[];
}

export interface AdminUserPhotoResponse {
  url: string;
}

export interface MyProfilePhotoResponse {
  userId?: string;
  url: string;
}

/**
 * Institution Admin workspace.
 */
export async function getAdminWorkspace():
  Promise<AdminWorkspace> {
  const response =
    await authedFetch<
      ApiEnvelope<AdminWorkspace>
    >(
      "/erp/me/workspace",
    );

  return response.data;
}

/**
 * List users belonging to the authenticated institution.
 */
export async function listAdminUsers(
  options?: {
    role?: string;
    search?: string;
    pageSize?: number;
  },
): Promise<AdminUser[]> {
  const params =
    new URLSearchParams();

  params.set(
    "page",
    "1",
  );

  params.set(
    "pageSize",
    String(
      options?.pageSize ??
        200,
    ),
  );

  if (options?.role) {
    params.set(
      "role",
      options.role,
    );
  }

  if (
    options?.search?.trim()
  ) {
    params.set(
      "search",
      options.search.trim(),
    );
  }

  const response =
    await authedFetch<
      ApiEnvelope<
        | AdminUser[]
        | {
            items:
              AdminUser[];
          }
      >
    >(
      `/users?${params.toString()}`,
    );

  if (
    Array.isArray(
      response.data,
    )
  ) {
    return response.data;
  }

  return (
    response.data.items ||
    []
  );
}

/**
 * Get one institution user.
 */
export async function getAdminUser(
  id: string,
): Promise<AdminUser> {
  const response =
    await authedFetch<
      ApiEnvelope<AdminUser>
    >(
      `/users/${encodeURIComponent(
        id,
      )}`,
    );

  return response.data;
}

/**
 * Create a user inside the authenticated institution.
 */
export async function createAdminUser(
  input: CreateAdminUserInput,
): Promise<AdminUser> {
  const response =
    await authedFetch<
      ApiEnvelope<AdminUser>
    >(
      "/users",
      {
        method:
          "POST",

        body:
          JSON.stringify(
            input,
          ),
      },
    );

  return response.data;
}

/**
 * Update institution user details.
 */
export async function updateAdminUser(
  id: string,
  input: Partial<{
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    isActive: boolean;
    role: string;
    departmentIds: string[];
  }>,
): Promise<AdminUser> {
  const response =
    await authedFetch<
      ApiEnvelope<AdminUser>
    >(
      `/users/${encodeURIComponent(
        id,
      )}`,
      {
        method:
          "PATCH",

        body:
          JSON.stringify(
            input,
          ),
      },
    );

  return response.data;
}

export interface AdminDepartment {
  id: string;
  name: string;
  code?: string | null;
  isActive?: boolean;
}

export async function listAdminDepartments(): Promise<AdminDepartment[]> {
  const response = await authedFetch<
    ApiEnvelope<AdminDepartment[] | { items: AdminDepartment[] }>
  >(
    "/departments?page=1&pageSize=500&isActive=true",
  );

  return Array.isArray(response.data)
    ? response.data
    : response.data.items || [];
}

/**
 * Normal Delete action.
 *
 * This is a soft delete:
 * the user remains in the database and isActive becomes false.
 */
export async function setAdminUserActive(
  id: string,
  isActive: boolean,
): Promise<AdminUser> {
  const response =
    await authedFetch<
      ApiEnvelope<AdminUser>
    >(
      `/users/${encodeURIComponent(
        id,
      )}/status`,
      {
        method:
          "PATCH",

        body:
          JSON.stringify({
            isActive,
          }),
      },
    );

  return response.data;
}

/**
 * Request permanent deletion of a user.
 *
 * SUPER_ADMIN receives an immediate permanent deletion response.
 * Other authorities receive a PENDING approval request.
 */
export async function requestAdminUserPermanentDeletion(
  id: string,
  reason?: string,
): Promise<PermanentDeletionResult> {
  const response =
    await authedFetch<
      ApiEnvelope<PermanentDeletionResult>
    >(
      `/users/${encodeURIComponent(
        id,
      )}/permanent-delete`,
      {
        method:
          "POST",

        body:
          JSON.stringify({
            reason:
              reason?.trim() ||
              undefined,
          }),
      },
    );

  return response.data;
}

/**
 * Load permanent-deletion requests visible to the current authority.
 */
export async function listAdminUserDeletionRequests():
  Promise<UserDeletionRequest[]> {
  const response =
    await authedFetch<
      ApiEnvelope<
        UserDeletionRequest[]
      >
    >(
      "/users/permanent-deletion-requests",
    );

  return response.data;
}

/**
 * Approve a pending permanent-deletion request.
 */
export async function approveAdminUserDeletionRequest(
  requestId: string,
): Promise<PermanentDeletionResult> {
  const response =
    await authedFetch<
      ApiEnvelope<PermanentDeletionResult>
    >(
      `/users/permanent-deletion-requests/${encodeURIComponent(
        requestId,
      )}/approve`,
      {
        method:
          "POST",
      },
    );

  return response.data;
}

/**
 * Reject a pending permanent-deletion request.
 */
export async function rejectAdminUserDeletionRequest(
  requestId: string,
): Promise<{
  requestId: string;
  status: "REJECTED";
}> {
  const response =
    await authedFetch<
      ApiEnvelope<{
        requestId: string;
        status:
          "REJECTED";
      }>
    >(
      `/users/permanent-deletion-requests/${encodeURIComponent(
        requestId,
      )}/reject`,
      {
        method:
          "POST",
      },
    );

  return response.data;
}

/**
 * Batch profile-photo lookup for institution users.
 */
export async function getAdminUserPhotos(
  ids: string[],
): Promise<
  Record<
    string,
    string | null
  >
> {
  if (!ids.length) {
    return {};
  }

  const response =
    await authedFetch<
      ApiEnvelope<
        Record<
          string,
          string | null
        >
      >
    >(
      `/users/photos?ids=${encodeURIComponent(
        ids.join(","),
      )}`,
    );

  return response.data;
}

/**
 * Upload an institution user's profile photo.
 */
export async function uploadAdminUserPhoto(
  id: string,
  dataUrl: string,
): Promise<AdminUserPhotoResponse> {
  const response =
    await authedFetch<
      ApiEnvelope<AdminUserPhotoResponse>
    >(
      `/users/${encodeURIComponent(
        id,
      )}/photo`,
      {
        method:
          "POST",

        body:
          JSON.stringify({
            dataUrl,
          }),
      },
    );

  return response.data;
}

/**
 * Upload the authenticated user's own profile photo.
 */
export async function uploadMyProfilePhoto(
  dataUrl: string,
): Promise<MyProfilePhotoResponse> {
  const response =
    await authedFetch<
      ApiEnvelope<MyProfilePhotoResponse>
    >(
      "/auth/account/photo",
      {
        method:
          "POST",

        body:
          JSON.stringify({
            dataUrl,
          }),
      },
    );

  return response.data;
}

export interface AdminUserLifecycle {
  id: string;
  institutionId?: string | null;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  isActive: boolean;
  deletedAt?: string | null;
  deletedBy?: string | null;
  deletionReason?: string | null;
  deletionNote?: string | null;
  recoveryDeadline?: string | null;
  permanentlyDeletedAt?: string | null;
  lastLoginAt?: string | null;
  passwordChangedAt?: string | null;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
  institution?: { id: string; name: string; slug: string } | null;
  roles: AdminUserRole[];
  departmentAccesses?: Array<{
    departmentId: string;
    scope?: string;
    department: { id: string; name: string; code: string; isActive?: boolean };
  }>;
  profile?: Record<string, unknown> | null;
  studentEnrollments?: Array<Record<string, unknown>>;
  authentication: {
    loginEmail: string;
    accountId: string;
    accountStatus: "ACTIVE" | "INACTIVE" | "DELETED";
    emailVerificationStatus: string;
    mfaEnabled: boolean;
    lastLogin: string | null;
    lastLoginIp: string | null;
    lastPasswordChange: string | null;
    failedLoginCount: number;
    lockedUntil: string | null;
    activeSessionCount: number;
    accountCreatedAt: string;
    passwordResetAvailable: boolean;
    forcePasswordChange: boolean;
    sessionDevice: { userAgent: string | null; createdAt: string } | null;
  };
}

export interface DeletedAdminUser extends AdminUser {
  deletedAt: string;
  deletedBy?: string | null;
  deletionReason?: string | null;
  deletionNote?: string | null;
  recoveryDeadline?: string | null;
  daysRemaining: number;
  deletedByUser?: { id: string; firstName: string; lastName: string; email: string } | null;
}

export async function getAdminUserLifecycle(id: string): Promise<AdminUserLifecycle> {
  const response = await authedFetch<ApiEnvelope<AdminUserLifecycle>>(
    `/users/${encodeURIComponent(id)}/lifecycle`,
  );
  return response.data;
}

export async function deactivateAdminUser(
  id: string,
  reason: string,
  note?: string,
): Promise<{ id: string; isActive: boolean }> {
  const response = await authedFetch<ApiEnvelope<{ id: string; isActive: boolean }>>(
    `/users/${encodeURIComponent(id)}/deactivate`,
    { method: "POST", body: JSON.stringify({ reason, note }) },
  );
  return response.data;
}

export async function reactivateAdminUser(
  id: string,
  reason?: string,
): Promise<{ id: string; isActive: boolean }> {
  const response = await authedFetch<ApiEnvelope<{ id: string; isActive: boolean }>>(
    `/users/${encodeURIComponent(id)}/reactivate`,
    { method: "POST", body: JSON.stringify({ reason }) },
  );
  return response.data;
}

export async function deleteAdminUser(
  id: string,
  reason: string,
  note?: string,
): Promise<{ id: string; deletedAt: string; recoveryDeadline: string }> {
  const response = await authedFetch<ApiEnvelope<{ id: string; deletedAt: string; recoveryDeadline: string }>>(
    `/users/${encodeURIComponent(id)}/delete`,
    { method: "POST", body: JSON.stringify({ reason, note }) },
  );
  return response.data;
}

export async function recoverAdminUser(
  id: string,
  reason?: string,
): Promise<AdminUserLifecycle> {
  const response = await authedFetch<ApiEnvelope<AdminUserLifecycle>>(
    `/users/${encodeURIComponent(id)}/recover`,
    { method: "POST", body: JSON.stringify({ reason }) },
  );
  return response.data;
}

export async function listDeletedAdminUsers(options?: {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: string;
  expiringSoon?: boolean;
}): Promise<{ items: DeletedAdminUser[]; total: number }> {
  const params = new URLSearchParams();
  params.set("page", String(options?.page ?? 1));
  params.set("pageSize", String(options?.pageSize ?? 25));
  if (options?.search) params.set("search", options.search);
  if (options?.role) params.set("role", options.role);
  if (options?.expiringSoon) params.set("expiringSoon", "true");
  const response = await authedFetch<ApiEnvelope<DeletedAdminUser[]> & { meta?: { total?: number } }>(
    `/users/deleted?${params.toString()}`,
  );
  return { items: response.data, total: response.meta?.total ?? response.data.length };
}

export async function adminResetUserPassword(id: string) {
  const response = await authedFetch<ApiEnvelope<{ userId: string; delivered: boolean; expiresAt: string | null }>>(
    `/users/${encodeURIComponent(id)}/reset-password`,
    { method: "POST" },
  );
  return response.data;
}
export async function forceAdminUserPasswordChange(id: string) {
  const response = await authedFetch<ApiEnvelope<{ userId: string; forcePasswordChange: boolean }>>(
    `/users/${encodeURIComponent(id)}/force-password-change`,
    { method: "POST" },
  );
  return response.data;
}
export async function revokeAdminUserSessions(id: string) {
  const response = await authedFetch<ApiEnvelope<{ userId: string; revoked: number }>>(
    `/users/${encodeURIComponent(id)}/revoke-sessions`,
    { method: "POST" },
  );
  return response.data;
}
export async function unlockAdminUser(id: string) {
  const response = await authedFetch<ApiEnvelope<{ userId: string; unlocked: boolean }>>(
    `/users/${encodeURIComponent(id)}/unlock`,
    { method: "POST" },
  );
  return response.data;
}

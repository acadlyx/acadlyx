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
  workspaceType: "INSTITUTION_ADMIN";
  stats: AdminWorkspaceStats;
  modules: AdminWorkspaceModules;
}

export interface CreateAdminUserInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  password: string;
  role: string;
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
 *
 * This uses the dedicated authenticated ERP workspace endpoint.
 * It does not use the generic ERP workspace endpoint because
 * that endpoint has different capability requirements.
 */
export async function getAdminWorkspace(): Promise<AdminWorkspace> {
  const response =
    await authedFetch<ApiEnvelope<AdminWorkspace>>(
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
  const params = new URLSearchParams();

  params.set("page", "1");
  params.set(
    "pageSize",
    String(options?.pageSize ?? 200),
  );

  if (options?.role) {
    params.set("role", options.role);
  }

  if (options?.search?.trim()) {
    params.set(
      "search",
      options.search.trim(),
    );
  }

  const response =
    await authedFetch<
      ApiEnvelope<
        AdminUser[] | {
          items: AdminUser[];
        }
      >
    >(
      `/users?${params.toString()}`,
    );

  if (Array.isArray(response.data)) {
    return response.data;
  }

  return response.data.items || [];
}

/**
 * Get one institution user.
 */
export async function getAdminUser(
  id: string,
): Promise<AdminUser> {
  const response =
    await authedFetch<ApiEnvelope<AdminUser>>(
      `/users/${encodeURIComponent(id)}`,
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
    await authedFetch<ApiEnvelope<AdminUser>>(
      "/users",
      {
        method: "POST",
        body: JSON.stringify(input),
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
  }>,
): Promise<AdminUser> {
  const response =
    await authedFetch<ApiEnvelope<AdminUser>>(
      `/users/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    );

  return response.data;
}

/**
 * Activate or deactivate an institution user.
 */
export async function setAdminUserActive(
  id: string,
  isActive: boolean,
): Promise<AdminUser> {
  const response =
    await authedFetch<ApiEnvelope<AdminUser>>(
      `/users/${encodeURIComponent(id)}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({
          isActive,
        }),
      },
    );

  return response.data;
}

/**
 * Batch profile-photo lookup for institution users.
 */
export async function getAdminUserPhotos(
  ids: string[],
): Promise<Record<string, string | null>> {
  if (!ids.length) {
    return {};
  }

  const response =
    await authedFetch<
      ApiEnvelope<Record<string, string | null>>
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
    await authedFetch<ApiEnvelope<AdminUserPhotoResponse>>(
      `/users/${encodeURIComponent(id)}/photo`,
      {
        method: "POST",
        body: JSON.stringify({
          dataUrl,
        }),
      },
    );

  return response.data;
}

/**
 * Upload the authenticated user's own profile photo.
 *
 * Backend endpoint:
 * POST /auth/account/photo
 *
 * Every authenticated user is allowed to update their own
 * profile picture.
 */
export async function uploadMyProfilePhoto(
  dataUrl: string,
): Promise<MyProfilePhotoResponse> {
  const response =
    await authedFetch<ApiEnvelope<MyProfilePhotoResponse>>(
      "/auth/account/photo",
      {
        method: "POST",
        body: JSON.stringify({
          dataUrl,
        }),
      },
    );

  return response.data;
}

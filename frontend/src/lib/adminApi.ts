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

export async function getAdminWorkspace(): Promise<AdminWorkspace> {
  const response = await authedFetch<
    ApiEnvelope<AdminWorkspace>
  >("/erp/me/workspace");

  return response.data;
}

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

export async function getAdminUser(
  id: string,
): Promise<AdminUser> {
  const response =
    await authedFetch<
      ApiEnvelope<AdminUser>
    >(
      `/users/${id}`,
    );

  return response.data;
}

export async function createAdminUser(
  input: CreateAdminUserInput,
): Promise<AdminUser> {
  const response =
    await authedFetch<
      ApiEnvelope<AdminUser>
    >(
      "/users",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );

  return response.data;
}

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
    await authedFetch<
      ApiEnvelope<AdminUser>
    >(
      `/users/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    );

  return response.data;
}

export async function setAdminUserActive(
  id: string,
  isActive: boolean,
): Promise<AdminUser> {
  const response =
    await authedFetch<
      ApiEnvelope<AdminUser>
    >(
      `/users/${id}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({
          isActive,
        }),
      },
    );

  return response.data;
}

export async function getAdminUserPhotos(
  ids: string[],
): Promise<Record<string, string | null>> {
  if (!ids.length) {
    return {};
  }

  const response =
    await authedFetch<
      ApiEnvelope<
        Record<string, string | null>
      >
    >(
      `/users/photos?ids=${encodeURIComponent(
        ids.join(","),
      )}`,
    );

  return response.data;
}

export async function uploadAdminUserPhoto(
  id: string,
  dataUrl: string,
): Promise<AdminUserPhotoResponse> {
  const response =
    await authedFetch<
      ApiEnvelope<AdminUserPhotoResponse>
    >(
      `/users/${id}/photo`,
      {
        method: "POST",
        body: JSON.stringify({
          dataUrl,
        }),
      },
    );

  return response.data;
}

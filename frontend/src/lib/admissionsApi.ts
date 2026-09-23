import {
  authedFetch,
} from "./auth";

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export type AdminUser = {
  id: string;
  institutionId:
    | string
    | null;
  email: string;
  firstName: string;
  lastName: string;
  phone:
    | string
    | null;
  isActive: boolean;
  lastLoginAt:
    | string
    | null;
  createdAt?: string;

  roles: Array<{
    id: string;
    name: string;
    description?:
      | string
      | null;
  }>;
};

export type AdminWorkspace = {
  workspaceType:
    "INSTITUTION_ADMIN";

  stats: Record<
    string,
    number
  >;

  modules: Record<
    string,
    boolean
  >;
};

export async function getAdminWorkspace(): Promise<AdminWorkspace> {
  const response =
    await authedFetch<
      ApiEnvelope<AdminWorkspace>
    >(
      "/erp/me/workspace"
    );

  return response.data;
}

export async function getAdminUserPhotos(
  userIds: string[]
): Promise<
  Record<
    string,
    string | null
  >
> {
  if (!userIds.length) {
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
        userIds.join(",")
      )}`
    );

  return response.data;
}

export async function listAdminUsers(
  params: {
    search?: string;
    role?: string;
    isActive?: boolean;
  } = {}
): Promise<AdminUser[]> {
  const query =
    new URLSearchParams({
      page: "1",
      pageSize: "100",
    });

  if (
    params.search?.trim()
  ) {
    query.set(
      "search",
      params.search.trim()
    );
  }

  if (params.role) {
    query.set(
      "role",
      params.role
    );
  }

  if (
    params.isActive !==
    undefined
  ) {
    query.set(
      "isActive",
      String(
        params.isActive
      )
    );
  }

  const response =
    await authedFetch<
      ApiEnvelope<
        | AdminUser[]
        | {
            items: AdminUser[];
          }
      >
    >(
      `/users?${query.toString()}`
    );

  return Array.isArray(
    response.data
  )
    ? response.data
    : response.data.items;
}

export async function createAdminUser(
  input: {
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    password: string;
    role: string;
  }
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
            input
          ),
      }
    );

  return response.data;
}

export async function updateAdminUser(
  id: string,
  input: Partial<{
    firstName: string;
    lastName: string;
    phone: string;
    isActive: boolean;
    role: string;
  }>
): Promise<AdminUser> {
  const response =
    await authedFetch<
      ApiEnvelope<AdminUser>
    >(
      `/users/${id}`,
      {
        method:
          "PATCH",

        body:
          JSON.stringify(
            input
          ),
      }
    );

  return response.data;
}

export async function setAdminUserActive(
  id: string,
  isActive: boolean
): Promise<AdminUser> {
  const response =
    await authedFetch<
      ApiEnvelope<AdminUser>
    >(
      `/users/${id}/status`,
      {
        method:
          "PATCH",

        body:
          JSON.stringify({
            isActive,
          }),
      }
    );

  return response.data;
}

async function fileToDataUrl(
  file: File
): Promise<string> {
  if (
    file.size >
    1_400_000
  ) {
    throw new Error(
      "Profile photo must be 1.4 MB or smaller."
    );
  }

  if (
    !/^image\/(jpeg|png|webp|gif)$/i.test(
      file.type
    )
  ) {
    throw new Error(
      "Profile photo must be JPEG, PNG, WebP, or GIF."
    );
  }

  return new Promise(
    (
      resolve,
      reject
    ) => {
      const reader =
        new FileReader();

      reader.onerror =
        () =>
          reject(
            new Error(
              "Unable to read the selected image."
            )
          );

      reader.onload =
        () =>
          resolve(
            String(
              reader.result
            )
          );

      reader.readAsDataURL(
        file
      );
    }
  );
}

async function uploadFile(
  url: string,
  file: File
): Promise<{
  userId: string;
  url: string;
}> {
  const dataUrl =
    await fileToDataUrl(
      file
    );

  const response =
    await authedFetch<
      ApiEnvelope<{
        userId: string;
        url: string;
      }>
    >(
      url,
      {
        method:
          "POST",

        body:
          JSON.stringify({
            dataUrl,
          }),
      }
    );

  return response.data;
}

export async function uploadAdminUserPhoto(
  userId: string,
  file: File
) {
  return uploadFile(
    `/users/${userId}/photo`,
    file
  );
}

export async function uploadMyProfilePhoto(
  file: File
) {
  return uploadFile(
    "/auth/account/photo",
    file
  );
}

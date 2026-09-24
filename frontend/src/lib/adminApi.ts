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
sections: number;
courses: number;
offerings: number;
campuses: number;
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
const response =
await authedFetch<ApiEnvelope<AdminWorkspace>>(
"/admin/workspace",
);

return response.data;
}

export async function listAdminUsers(): Promise<AdminUser[]> {
const response =
await authedFetch<
ApiEnvelope<
AdminUser[] | { items: AdminUser[] }
>
>(
"/users?page=1&pageSize=200",
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
await authedFetch<ApiEnvelope<AdminUser>>(
`/users/${id}`,
);

return response.data;
}

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
await authedFetch<ApiEnvelope<AdminUser>>(
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
if (ids.length === 0) {
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
file: File,
): Promise<AdminUserPhotoResponse> {
const dataUrl = await fileToDataUrl(file);

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

export async function uploadMyProfilePhoto(
file: File,
): Promise<AdminUserPhotoResponse> {
const dataUrl = await fileToDataUrl(file);

const response =
await authedFetch<
ApiEnvelope<AdminUserPhotoResponse>
>(
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

function fileToDataUrl(file: File): Promise<string> {
return new Promise((resolve, reject) => {
const reader = new FileReader();

reader.onload = () => {
  if (typeof reader.result !== "string") {
    reject(
      new Error("Unable to read the selected image."),
    );
    return;
  }

  resolve(reader.result);
};

reader.onerror = () => {
  reject(
    reader.error ??
      new Error("Unable to read the selected image."),
  );
};

reader.readAsDataURL(file);

});
}

import { authedFetch } from "./auth";

export interface StoredFile {
  id: string;
  url: string;
  module: string;
  mimeType: string;
  size: number;
  originalName: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export async function uploadFile(
  file: File,
  module: string,
  options?: { referenceId?: string; visibility?: "public" | "private" },
): Promise<StoredFile> {
  const form = new FormData();
  form.append("file", file);
  form.append("module", module);
  if (options?.referenceId) form.append("referenceId", options.referenceId);
  form.append("visibility", options?.visibility ?? "private");

  const response = await authedFetch<ApiEnvelope<StoredFile>>("/files", {
    method: "POST",
    body: form,
  });

  return response.data;
}

export async function getFileUrl(
  fileId: string,
  options?: { download?: boolean },
): Promise<string> {
  const query = options?.download ? "?download=true" : "";
  const response = await authedFetch<ApiEnvelope<{ url: string }>>(
    `/files/${encodeURIComponent(fileId)}${query}`,
  );
  return response.data.url;
}

export async function deleteFile(fileId: string): Promise<void> {
  await authedFetch<ApiEnvelope<{ deleted: boolean }>>(
    `/files/${encodeURIComponent(fileId)}`,
    { method: "DELETE" },
  );
}

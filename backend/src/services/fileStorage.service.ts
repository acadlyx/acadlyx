import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { cloudinaryProvider } from "../storage/cloudinary.provider";
import {
  FileStorageProvider,
  StorageObject,
  StorageUploadInput,
} from "../storage/FileStorageProvider";

const providers: Record<string, FileStorageProvider> = {
  cloudinary: cloudinaryProvider,
};

function provider(): FileStorageProvider {
  const selected = providers[env.storageProvider];
  if (!selected) {
    throw new AppError(`Unsupported storage provider: ${env.storageProvider}`, 500);
  }
  return selected;
}

const MAX_FILE_BYTES = 25 * 1024 * 1024;

const MODULE_MIME_ALLOWLIST: Record<string, readonly string[]> = {
  site: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"],
  "profile-photos": ["image/jpeg", "image/png", "image/webp", "image/gif"],
  students: ["application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain"],
  faculty: ["application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain"],
  admissions: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
  assignments: ["application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain", "application/zip"],
  notices: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
  examinations: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
  certificates: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
  results: ["application/pdf", "text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  documents: ["application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain", "application/zip"],
  lms: ["application/pdf", "image/jpeg", "image/png", "image/webp", "video/mp4", "audio/mpeg", "application/zip"],
  library: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
  operations: ["application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain", "application/zip"],
};

export interface StoredFile {
  id: string;
  provider: string;
  publicId: string;
  url: string;
  secureUrl: string;
  resourceType: string;
  size: number;
  mimeType: string;
  folder: string;
  institutionId: string;
  ownerId: string | null;
  module: string;
  referenceId: string | null;
  visibility: "public" | "private";
}

function assertSafeFile(input: StorageUploadInput): void {
  if (!input.buffer.length) throw new AppError("File cannot be empty", 400);
  if (input.buffer.length > MAX_FILE_BYTES) throw new AppError("File must be 25 MB or smaller", 413);
  if (!input.mimeType || input.mimeType.length > 160) throw new AppError("A valid MIME type is required", 415);
  if (!input.folder.startsWith("acadlyx/")) throw new AppError("Invalid storage folder", 400);
}

export function buildTenantFolder(institutionId: string, module: string, ownerId?: string): string {
  const safeModule = module.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
  const safeOwner = ownerId ? `/${ownerId}` : "";
  return `acadlyx/${institutionId}/${safeModule}${safeOwner}`;
}

export async function storeFile(input: {
  institutionId: string;
  module: string;
  buffer: Buffer;
  filename: string;
  mimeType: string;
  ownerId?: string;
  referenceId?: string;
  visibility?: "public" | "private";
  resourceType?: "image" | "video" | "raw" | "auto";
  replaceFileId?: string;
}): Promise<StoredFile> {
  const storageInput: StorageUploadInput = {
    buffer: input.buffer,
    filename: input.filename,
    mimeType: input.mimeType,
    folder: buildTenantFolder(input.institutionId, input.module, input.ownerId),
    visibility: input.visibility ?? "private",
    resourceType: input.resourceType ?? "auto",
  };

  assertSafeFile(storageInput);
  const allowed = MODULE_MIME_ALLOWLIST[input.module];
  if (!allowed) throw new AppError("Unsupported storage module", 400);
  validateAllowedMime(input.mimeType, allowed);
  let previous: { id: string; provider: string; publicId: string; resourceType: string } | null = null;
  if (input.replaceFileId) {
    previous = await prisma.fileAsset.findFirst({
      where: {
        id: input.replaceFileId,
        institutionId: input.institutionId,
      },
      select: { id: true, provider: true, publicId: true, resourceType: true },
    });
    if (!previous) throw new AppError("File to replace was not found in this institution", 404);
  }

  let uploaded: StorageObject;
  try {
    uploaded = await provider().upload(storageInput);
  } catch (error) {
    throw new AppError(error instanceof Error ? error.message : "File upload failed", 502);
  }

  let created;
  try {
    created = await prisma.fileAsset.create({
      data: {
        provider: uploaded.provider,
        publicId: uploaded.publicId,
        url: uploaded.secureUrl,
        resourceType: uploaded.resourceType,
        size: uploaded.bytes,
        mimeType: uploaded.mimeType,
        folder: uploaded.folder,
        institutionId: input.institutionId,
        ownerId: input.ownerId ?? null,
        module: input.module,
        referenceId: input.referenceId ?? null,
        visibility: uploaded.visibility,
        originalName: input.filename,
      },
    });
  } catch (error) {
    try {
      await provider().delete({
        publicId: uploaded.publicId,
        resourceType: uploaded.resourceType,
      });
    } catch {
      // Best-effort cleanup; a later reconciliation can remove a rare provider orphan.
    }
    throw error;
  }

  if (previous) {
    await prisma.fileAsset.delete({ where: { id: previous.id } });
    try {
      if (previous.provider === env.storageProvider) {
        await provider().delete({
          publicId: previous.publicId,
          resourceType: previous.resourceType,
        });
      }
    } catch {
      // Metadata replacement succeeds even if provider cleanup temporarily fails.
    }
  }

  return created as StoredFile;
}

export async function deleteFile(fileId: string, institutionId: string): Promise<void> {
  const file = await prisma.fileAsset.findFirst({
    where: { id: fileId, institutionId },
  });
  if (!file) throw new AppError("File not found", 404);

  await prisma.fileAsset.delete({ where: { id: file.id } });
  try {
    if (file.provider === env.storageProvider) {
      await provider().delete({ publicId: file.publicId, resourceType: file.resourceType });
    }
  } catch {
    // Keep deletion idempotent. A reconciliation process can retry provider cleanup.
  }
}

export async function getFileDelivery(
  fileId: string,
  institutionId: string,
  download = false,
): Promise<{ file: StoredFile; url: string }> {
  const file = await prisma.fileAsset.findFirst({
    where: { id: fileId, institutionId },
  });
  if (!file) throw new AppError("File not found", 404);

  const url = provider().getDeliveryUrl({
    publicId: file.publicId,
    resourceType: file.resourceType,
    visibility: file.visibility as "public" | "private",
    download,
  });

  return { file: file as StoredFile, url };
}

export async function deleteFilesByReference(
  institutionId: string,
  module: string,
  referenceId: string,
): Promise<void> {
  const files = await prisma.fileAsset.findMany({
    where: { institutionId, module, referenceId },
    select: { id: true },
  });
  for (const file of files) await deleteFile(file.id, institutionId);
}

export function allowedMimeTypesForModule(module: string): readonly string[] {
  return MODULE_MIME_ALLOWLIST[module] ?? [];
}

export function validateAllowedMime(
  mimeType: string,
  allowed: readonly string[],
): void {
  if (!allowed.includes(mimeType)) {
    throw new AppError(`File type ${mimeType} is not allowed`, 415);
  }
}

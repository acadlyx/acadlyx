import { env } from "../config/env";
import { open, stat } from "fs/promises";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { logger } from "../utils/logger";
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
  examinations: ["application/pdf", "image/jpeg", "image/png", "image/webp", "application/zip"],
  certificates: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
  results: ["application/pdf", "text/csv", "application/zip", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  documents: ["application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain", "application/zip"],
  lms: ["application/pdf", "image/jpeg", "image/png", "image/webp", "video/mp4", "audio/mpeg", "application/zip"],
  library: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
  operations: ["application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain", "application/zip"],
  imports: ["text/csv", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  "events-gallery": ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"],
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
  originalName: string;
}

async function validateGeneratedArtifact(path: string, mimeType: string, size: number): Promise<void> {
  if (mimeType !== "application/pdf" && mimeType !== "application/zip") return;

  const handle = await open(path, "r");
  try {
    const header = Buffer.alloc(8);
    await handle.read(header, 0, header.length, 0);

    if (mimeType === "application/pdf") {
      if (header.subarray(0, 5).toString("ascii") !== "%PDF-") {
        throw new AppError("Generated PDF does not have a valid PDF header", 422);
      }
      const tailLength = Math.min(size, 1024);
      const tail = Buffer.alloc(tailLength);
      await handle.read(tail, 0, tailLength, Math.max(0, size - tailLength));
      if (!tail.toString("latin1").includes("%%EOF")) {
        throw new AppError("Generated PDF is missing its EOF marker", 422);
      }
    } else if (header.subarray(0, 4).toString("binary") !== "PK\\x03\\x04") {
      throw new AppError("Generated ZIP does not have a valid ZIP header", 422);
    }
  } finally {
    await handle.close();
  }
}

function assertSafeFile(input: StorageUploadInput): void {
  if (!input.buffer.length) throw new AppError("File cannot be empty", 400);
  if (input.buffer.length > MAX_FILE_BYTES) throw new AppError("File must be 25 MB or smaller", 413);
  if (!input.mimeType || input.mimeType.length > 160) throw new AppError("A valid MIME type is required", 415);
  if (!input.folder.startsWith("acadlyx/")) throw new AppError("Invalid storage folder", 400);
}

/**
 * Validate the actual payload before handing it to an external storage
 * provider. Multipart Content-Type is supplied by the client and is not a
 * trustworthy indication of the uploaded bytes.
 */
export function assertUploadContentMatchesMime(buffer: Buffer, mimeType: string): void {
  const isZip = buffer.length >= 4 &&
    (buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) ||
      buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x05, 0x06])) ||
      buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x07, 0x08])));
  let matches = false;

  switch (mimeType) {
    case "image/jpeg":
      matches = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
      break;
    case "image/png":
      matches = buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
      break;
    case "image/webp":
      matches = buffer.length >= 12 &&
        buffer.toString("ascii", 0, 4) === "RIFF" &&
        buffer.toString("ascii", 8, 12) === "WEBP";
      break;
    case "image/gif":
      matches = buffer.length >= 6 && ["GIF87a", "GIF89a"].includes(buffer.toString("ascii", 0, 6));
      break;
    case "image/avif":
      matches = buffer.length >= 12 &&
        buffer.toString("ascii", 4, 8) === "ftyp" &&
        ["avif", "avis"].includes(buffer.toString("ascii", 8, 12));
      break;
    case "application/pdf":
      matches = buffer.length >= 5 && buffer.toString("ascii", 0, 5) === "%PDF-";
      break;
    case "application/zip":
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      matches = isZip;
      break;
    case "application/vnd.ms-excel":
      matches = buffer.length >= 8 &&
        buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
      break;
    case "video/mp4":
      matches = buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp";
      break;
    case "audio/mpeg":
      matches = buffer.length >= 3 && (
        buffer.toString("ascii", 0, 3) === "ID3" ||
        (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)
      );
      break;
    case "text/plain":
    case "text/csv": {
      try {
        new TextDecoder("utf-8", { fatal: true }).decode(buffer);
        matches = !buffer.includes(0);
      } catch {
        matches = false;
      }
      break;
    }
    default:
      matches = false;
  }

  if (!matches) {
    throw new AppError("Uploaded file content does not match its declared MIME type", 415);
  }
}

export function buildTenantFolder(institutionId: string, module: string, ownerId?: string): string {
  if (!institutionId || !/^[A-Za-z0-9_-]+$/.test(institutionId)) {
    throw new AppError("Invalid institution identifier", 400);
  }
  const safeModule = module.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
  const safeOwner = ownerId ? `/${ownerId}` : "";
  return `acadlyx/${institutionId}/${safeModule}${safeOwner}`;
}

/**
 * Keep the database record available for retry until the remote object has
 * actually been removed. Provider delete operations must be idempotent.
 */
export async function deleteExternalBeforeMetadata(
  deleteExternal: () => Promise<unknown>,
  deleteMetadata: () => Promise<unknown>,
): Promise<void> {
  await deleteExternal();
  await deleteMetadata();
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
  assertUploadContentMatchesMime(input.buffer, input.mimeType);
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
    try {
      if (previous.provider !== env.storageProvider) {
        throw new Error(`Previous file belongs to unsupported provider: ${previous.provider}`);
      }
      await deleteExternalBeforeMetadata(
        () => provider().delete({
          publicId: previous!.publicId,
          resourceType: previous!.resourceType,
        }),
        async () => {
          await prisma.fileAsset.delete({ where: { id: previous!.id } });
        },
      );
    } catch (error) {
      // Keep the old metadata so failed provider cleanup remains discoverable
      // and can be retried instead of creating an untracked external object.
      logger.error("Unable to clean up replaced storage object; metadata retained", {
        fileId: previous.id,
        institutionId: input.institutionId,
        provider: previous.provider,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    id: created.id,
    provider: created.provider,
    publicId: created.publicId,
    url: created.url,
    secureUrl: created.url,
    resourceType: created.resourceType,
    size: created.size,
    mimeType: created.mimeType,
    folder: created.folder,
    institutionId: created.institutionId,
    ownerId: created.ownerId,
    module: created.module,
    referenceId: created.referenceId,
    visibility: created.visibility as "public" | "private",
    originalName: created.originalName,
  };
}


export type StoredPlatformFile = Omit<StoredFile, "institutionId"> & { institutionId: null };

/** Upload media owned by the platform CMS, without attaching it to a tenant. */
export async function storePlatformFile(input: {
  module: string;
  buffer: Buffer;
  filename: string;
  mimeType: string;
  ownerId?: string;
  visibility?: "public" | "private";
  resourceType?: "image" | "video" | "raw" | "auto";
}): Promise<StoredPlatformFile> {
  const safeModule = input.module.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
  const safeOwner = input.ownerId ? "/" + input.ownerId : "";
  const storageInput: StorageUploadInput = {
    buffer: input.buffer,
    filename: input.filename,
    mimeType: input.mimeType,
    folder: "acadlyx/platform/" + safeModule + safeOwner,
    visibility: input.visibility ?? "private",
    resourceType: input.resourceType ?? "auto",
  };
  assertSafeFile(storageInput);
  const allowed = MODULE_MIME_ALLOWLIST[input.module];
  if (!allowed) throw new AppError("Unsupported storage module", 400);
  validateAllowedMime(input.mimeType, allowed);
  assertUploadContentMatchesMime(input.buffer, input.mimeType);

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
        institutionId: null,
        ownerId: input.ownerId ?? null,
        module: input.module,
        referenceId: null,
        visibility: uploaded.visibility,
        originalName: input.filename,
      },
    });
  } catch (error) {
    try {
      await provider().delete({ publicId: uploaded.publicId, resourceType: uploaded.resourceType });
    } catch {
      // Provider orphan cleanup is retried through storage reconciliation.
    }
    throw error;
  }

  return {
    id: created.id,
    provider: created.provider,
    publicId: created.publicId,
    url: created.url,
    secureUrl: created.url,
    resourceType: created.resourceType,
    size: created.size,
    mimeType: created.mimeType,
    folder: created.folder,
    institutionId: null,
    ownerId: created.ownerId,
    module: created.module,
    referenceId: created.referenceId,
    visibility: created.visibility as "public" | "private",
    originalName: created.originalName,
  };
}

export async function storeFileFromPath(input: {
  institutionId: string;
  module: string;
  path: string;
  filename: string;
  mimeType: string;
  ownerId?: string;
  referenceId?: string;
  visibility?: "public" | "private";
  resourceType?: "image" | "video" | "raw" | "auto";
}): Promise<StoredFile> {
  const fileStat = await stat(input.path);
  if (!fileStat.isFile() || fileStat.size <= 0) throw new AppError("Generated file is empty", 422);
  await validateGeneratedArtifact(input.path, input.mimeType, fileStat.size);
  if (fileStat.size > 500 * 1024 * 1024) throw new AppError("Generated artifact exceeds the 500 MB limit", 413);
  const folder = buildTenantFolder(input.institutionId, input.module, input.ownerId);
  const allowed = MODULE_MIME_ALLOWLIST[input.module];
  if (!allowed) throw new AppError("Unsupported storage module", 400);
  validateAllowedMime(input.mimeType, allowed);
  let uploaded: StorageObject;
  try {
    uploaded = await provider().uploadPath({
      path: input.path,
      size: fileStat.size,
      filename: input.filename,
      mimeType: input.mimeType,
      folder,
      visibility: input.visibility ?? "private",
      resourceType: input.resourceType ?? "raw",
    });
  } catch (error) {
    throw new AppError(error instanceof Error ? error.message : "File upload failed", 502);
  }
  const created = await prisma.fileAsset.create({ data: {
    provider: uploaded.provider, publicId: uploaded.publicId, url: uploaded.secureUrl,
    resourceType: uploaded.resourceType, size: uploaded.bytes, mimeType: uploaded.mimeType,
    folder: uploaded.folder, institutionId: input.institutionId, ownerId: input.ownerId ?? null,
    module: input.module, referenceId: input.referenceId ?? null,
    visibility: uploaded.visibility, originalName: input.filename,
  }});
  return {
    id: created.id, provider: created.provider, publicId: created.publicId, url: created.url,
    secureUrl: created.url, resourceType: created.resourceType, size: created.size,
    mimeType: created.mimeType, folder: created.folder, institutionId: created.institutionId,
    ownerId: created.ownerId, module: created.module, referenceId: created.referenceId,
    visibility: created.visibility as "public" | "private", originalName: created.originalName,
  };
}

export async function deleteFile(fileId: string, institutionId: string): Promise<void> {
  const file = await prisma.fileAsset.findFirst({
    where: { id: fileId, institutionId },
  });
  if (!file) throw new AppError("File not found", 404);

  if (file.provider !== env.storageProvider) {
    throw new AppError("This file belongs to an unsupported storage provider; metadata was retained.", 503);
  }
  try {
    await deleteExternalBeforeMetadata(
      () => provider().delete({ publicId: file.publicId, resourceType: file.resourceType }),
      async () => {
        await prisma.fileAsset.delete({ where: { id: file.id } });
      },
    );
  } catch (error) {
    logger.error("Unable to delete external storage object; metadata retained for retry", {
      fileId: file.id,
      institutionId,
      provider: file.provider,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new AppError("File deletion failed. Its record was preserved so the operation can be retried.", 502);
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

  return {
    file: {
      id: file.id,
      provider: file.provider,
      publicId: file.publicId,
      url: file.url,
      secureUrl: file.url,
      resourceType: file.resourceType,
      size: file.size,
      mimeType: file.mimeType,
      folder: file.folder,
      institutionId: file.institutionId,
      ownerId: file.ownerId,
      module: file.module,
      referenceId: file.referenceId,
      visibility: file.visibility as "public" | "private",
      originalName: file.originalName,
    },
    url,
  };
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

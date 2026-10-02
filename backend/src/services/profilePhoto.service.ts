import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { storeFile, deleteFile } from "./fileStorage.service";
import { assertSafeImageUpload } from "../utils/imageUpload";

export interface ProfilePhoto {
  userId: string;
  url: string;
  publicId: string;
  fileId?: string;
}

export async function getProfilePhoto(userId: string): Promise<ProfilePhoto | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { institutionId: true },
  });
  if (!user?.institutionId) return null;

  const file = await prisma.fileAsset.findFirst({
    where: {
      institutionId: user.institutionId,
      ownerId: userId,
      module: "profile-photos",
    },
    orderBy: { createdAt: "desc" },
  });

  if (!file) return null;
  return { userId, url: file.url, publicId: file.publicId, fileId: file.id };
}

export async function getProfilePhotos(userIds: string[]): Promise<Map<string, ProfilePhoto>> {
  const result = new Map<string, ProfilePhoto>();
  const ids = [...new Set(userIds)].filter(Boolean);
  if (!ids.length) return result;

  const files = await prisma.fileAsset.findMany({
    where: { ownerId: { in: ids }, module: "profile-photos" },
    orderBy: { createdAt: "desc" },
  });

  for (const file of files) {
    if (!file.ownerId || result.has(file.ownerId)) continue;
    result.set(file.ownerId, {
      userId: file.ownerId,
      url: file.url,
      publicId: file.publicId,
      fileId: file.id,
    });
  }
  return result;
}

export async function uploadProfilePhoto(
  userId: string,
  file: Express.Multer.File,
): Promise<ProfilePhoto> {
  assertSafeImageUpload(file);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { institutionId: true },
  });
  if (!user?.institutionId) {
    throw new AppError("A profile photo requires an institution-scoped account", 400);
  }

  const existing = await getProfilePhoto(userId);
  const stored = await storeFile({
    institutionId: user.institutionId,
    module: "profile-photos",
    buffer: file.buffer,
    filename: file.originalname,
    mimeType: file.mimetype,
    ownerId: userId,
    visibility: "private",
    resourceType: "image",
    replaceFileId: existing?.fileId,
  });

  return {
    userId,
    url: stored.url,
    publicId: stored.publicId,
    fileId: stored.id,
  };
}

const MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024;

export async function uploadProfilePhotoDataUrl(userId: string, dataUrl: string): Promise<ProfilePhoto> {
  if (typeof dataUrl !== "string" || dataUrl.length > Math.ceil(MAX_PROFILE_PHOTO_BYTES * 1.4)) {
    throw new AppError("Profile photo is too large", 413);
  }

  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    throw new AppError("Profile photo must be a JPEG, PNG, WebP, or GIF data URL", 415);
  }

  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length) throw new AppError("Profile photo cannot be empty", 400);
  if (buffer.length > MAX_PROFILE_PHOTO_BYTES) {
    throw new AppError("Profile photo must be 5 MB or smaller", 413);
  }

  return uploadProfilePhoto(userId, {
    fieldname: "file",
    originalname: `profile-photo.${match[1].split("/")[1]}`,
    encoding: "7bit",
    mimetype: match[1],
    size: buffer.length,
    destination: "",
    filename: "profile-photo",
    path: "",
    buffer,
    stream: undefined,
  } as unknown as Express.Multer.File);
}

export async function deleteProfilePhoto(userId: string): Promise<void> {
  const existing = await getProfilePhoto(userId);
  if (!existing?.fileId) return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { institutionId: true },
  });
  if (!user?.institutionId) return;

  await deleteFile(existing.fileId, user.institutionId);
}

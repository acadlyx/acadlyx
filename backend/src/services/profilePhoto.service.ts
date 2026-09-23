import { Prisma } from "@prisma/client";
import { v2 as cloudinary } from "cloudinary";

import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { env } from "../config/env";
import { assertSafeImageUpload } from "../utils/imageUpload";

function configureCloudinary() {
  if (
    !env.cloudinaryCloudName ||
    !env.cloudinaryApiKey ||
    !env.cloudinaryApiSecret
  ) {
    throw new AppError(
      "Cloudinary is not configured. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.",
      503
    );
  }

  cloudinary.config({
    cloud_name: env.cloudinaryCloudName,
    api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret,
  });
}

export interface ProfilePhoto {
  userId: string;
  url: string;
  publicId: string;
}

export async function getProfilePhoto(
  userId: string
): Promise<ProfilePhoto | null> {
  const rows =
    await prisma.$queryRaw<ProfilePhoto[]>(
      Prisma.sql`
        SELECT
          "userId",
          "url",
          "publicId"
        FROM "user_profile_photos"
        WHERE "userId" = ${userId}
        LIMIT 1
      `
    );

  return rows[0] ?? null;
}

export async function getProfilePhotos(
  userIds: string[]
): Promise<Map<string, ProfilePhoto>> {
  const uniqueIds = [
    ...new Set(
      userIds
    ),
  ].filter(Boolean);

  const result =
    new Map<
      string,
      ProfilePhoto
    >();

  if (!uniqueIds.length) {
    return result;
  }

  const rows =
    await prisma.$queryRaw<ProfilePhoto[]>(
      Prisma.sql`
        SELECT
          "userId",
          "url",
          "publicId"
        FROM "user_profile_photos"
        WHERE "userId" IN (${Prisma.join(
          uniqueIds
        )})
      `
    );

  for (const row of rows) {
    result.set(
      row.userId,
      row
    );
  }

  return result;
}

export async function uploadProfilePhoto(
  userId: string,
  file: Express.Multer.File
): Promise<ProfilePhoto> {
  assertSafeImageUpload(
    file
  );

  configureCloudinary();

  const existing =
    await getProfilePhoto(
      userId
    );

  const uploaded =
    await new Promise<{
      secure_url: string;
      public_id: string;
    }>(
      (
        resolve,
        reject
      ) => {
        const stream =
          cloudinary.uploader.upload_stream(
            {
              folder:
                "acadlyx/profile-photos",
              resource_type:
                "image",
              overwrite: true,
            },
            (
              error,
              value
            ) => {
              if (
                error ||
                !value?.secure_url ||
                !value?.public_id
              ) {
                reject(
                  error ??
                    new Error(
                      "Profile photo upload failed"
                    )
                );
                return;
              }

              resolve(
                value as {
                  secure_url: string;
                  public_id: string;
                }
              );
            }
          );

        stream.end(
          file.buffer
        );
      }
    );

  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO "user_profile_photos"
        (
          "userId",
          "url",
          "publicId",
          "createdAt",
          "updatedAt"
        )
      VALUES
        (
          ${userId},
          ${uploaded.secure_url},
          ${uploaded.public_id},
          NOW(),
          NOW()
        )
      ON CONFLICT ("userId")
      DO UPDATE SET
        "url" = EXCLUDED."url",
        "publicId" = EXCLUDED."publicId",
        "updatedAt" = NOW()
    `
  );

  if (
    existing?.publicId &&
    existing.publicId !==
      uploaded.public_id
  ) {
    await cloudinary.uploader.destroy(
      existing.publicId,
      {
        resource_type:
          "image",
        invalidate:
          true,
      }
    );
  }

  return {
    userId,
    url:
      uploaded.secure_url,
    publicId:
      uploaded.public_id,
  };
}

export async function uploadProfilePhotoDataUrl(
  userId: string,
  dataUrl: string
): Promise<ProfilePhoto> {
  if (
    typeof dataUrl !==
      "string" ||
    dataUrl.length >
      1_900_000
  ) {
    throw new AppError(
      "Profile photo is too large",
      413
    );
  }

  const match =
    dataUrl.match(
      /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/
    );

  if (!match) {
    throw new AppError(
      "Profile photo must be a JPEG, PNG, WebP, or GIF data URL",
      415
    );
  }

  const mime =
    match[1];

  const buffer =
    Buffer.from(
      match[2],
      "base64"
    );

  const file =
    {
      fieldname:
        "file",
      originalname:
        `profile-photo.${
          mime.split(
            "/"
          )[1]
        }`,
      encoding:
        "7bit",
      mimetype:
        mime,
      size:
        buffer.length,
      destination:
        "",
      filename:
        "profile-photo",
      path: "",
      buffer,
      stream:
        undefined,
    } as Express.Multer.File;

  return uploadProfilePhoto(
    userId,
    file
  );
}

export async function deleteProfilePhoto(
  userId: string
): Promise<void> {
  configureCloudinary();

  const existing =
    await getProfilePhoto(
      userId
    );

  if (!existing) {
    return;
  }

  await prisma.$executeRaw(
    Prisma.sql`
      DELETE FROM "user_profile_photos"
      WHERE "userId" = ${userId}
    `
  );

  await cloudinary.uploader.destroy(
    existing.publicId,
    {
      resource_type:
        "image",
      invalidate:
        true,
    }
  );
}

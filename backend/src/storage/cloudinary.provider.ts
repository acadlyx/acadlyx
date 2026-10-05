import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";
import { env } from "../config/env";
import { AppError } from "../middleware/errorHandler";
import {
  FileStorageProvider,
  StorageObject,
  StorageUploadInput,
} from "./FileStorageProvider";

function configure(): void {
  if (env.cloudinaryUrl) {
    cloudinary.config({ cloudinary_url: env.cloudinaryUrl });
    return;
  }

  if (!env.cloudinaryCloudName || !env.cloudinaryApiKey || !env.cloudinaryApiSecret) {
    throw new AppError("Cloudinary storage is not configured.", 503);
  }

  cloudinary.config({
    cloud_name: env.cloudinaryCloudName,
    api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret,
  });
}

function upload(input: StorageUploadInput): Promise<StorageObject> {
  configure();

  return new Promise((resolve, reject) => {
    const resourceType = input.resourceType ?? "auto";
    const visibility = input.visibility ?? "private";

    const stream = cloudinary.uploader.upload_stream(
      {
        folder: input.folder,
        public_id: input.publicId,
        resource_type: resourceType,
        type: visibility === "private" ? "authenticated" : "upload",
        overwrite: input.overwrite ?? false,
        use_filename: !input.publicId,
        unique_filename: !input.publicId,
        context: {
          original_filename: input.filename,
          mime_type: input.mimeType,
        },
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error("Cloudinary upload failed"));
          return;
        }

        resolve({
          provider: "cloudinary",
          publicId: result.public_id,
          url: result.url,
          secureUrl: result.secure_url,
          resourceType: result.resource_type,
          mimeType: input.mimeType,
          bytes: result.bytes ?? input.buffer.length,
          folder: input.folder,
          visibility,
          format: result.format,
          version: result.version,
        });
      },
    );

    stream.end(input.buffer);
  });
}

async function uploadStream(input: Omit<import("./FileStorageProvider").StorageUploadInput, "buffer"> & { stream: Readable; size?: number }): Promise<StorageObject> {
  configure();
  return new Promise((resolve, reject) => {
    const resourceType = input.resourceType ?? "auto";
    const visibility = input.visibility ?? "private";
    const stream = cloudinary.uploader.upload_stream({
      folder: input.folder,
      public_id: input.publicId,
      resource_type: resourceType,
      type: visibility === "private" ? "authenticated" : "upload",
      overwrite: input.overwrite ?? false,
      use_filename: !input.publicId,
      unique_filename: !input.publicId,
      context: { original_filename: input.filename, mime_type: input.mimeType },
    }, (error, result) => {
      if (error || !result) return reject(error ?? new Error("Cloudinary upload failed"));
      resolve({
        provider: "cloudinary", publicId: result.public_id, url: result.url,
        secureUrl: result.secure_url, resourceType: result.resource_type,
        mimeType: input.mimeType, bytes: result.bytes ?? input.size ?? 0,
        folder: result.folder ?? input.folder, visibility, format: result.format, version: result.version,
      });
    });
    input.stream.pipe(stream);
  });
}

export const cloudinaryProvider: FileStorageProvider = {
  upload,
  uploadStream,

  async delete({ publicId, resourceType = "image" }) {
    configure();
    await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      type: "authenticated",
      invalidate: true,
    });
  },

  getDeliveryUrl({ publicId, resourceType = "image", visibility = "private", download = false }) {
    configure();

    if (visibility === "public") {
      return cloudinary.url(publicId, {
        secure: true,
        resource_type: resourceType,
        type: "upload",
        flags: download ? "attachment" : undefined,
      });
    }

    if (download) {
      return cloudinary.utils.private_download_url(publicId, "", {
        resource_type: resourceType,
        type: "authenticated",
        attachment: true,
        expires_at: Math.floor(Date.now() / 1000) + env.storageSignedUrlTtlSeconds,
      });
    }

    return cloudinary.url(publicId, {
      secure: true,
      resource_type: resourceType,
      type: "authenticated",
      sign_url: true,
      expires_at: Math.floor(Date.now() / 1000) + env.storageSignedUrlTtlSeconds,
    });
  },
};

import { AppError } from "../middleware/errorHandler";

const SUPPORTED_IMAGES = new Map<string, string>([
  ["image/jpeg", "jpeg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

function detectedImageType(buffer: Buffer): string | null {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "jpeg";
  }

  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    )
  ) {
    return "png";
  }

  if (
    buffer.length >= 6 &&
    (buffer.subarray(0, 6).equals(Buffer.from("GIF87a")) ||
      buffer.subarray(0, 6).equals(Buffer.from("GIF89a")))
  ) {
    return "gif";
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).equals(Buffer.from("RIFF")) &&
    buffer.subarray(8, 12).equals(Buffer.from("WEBP"))
  ) {
    return "webp";
  }

  return null;
}

/**
 * Do not trust a client-provided MIME type. Restrict CMS/logo uploads to
 * raster images and require their byte signature to agree with the header.
 * SVG is deliberately excluded because it can contain executable content.
 */
export function assertSafeImageUpload(file: Express.Multer.File): void {
  const expectedType = SUPPORTED_IMAGES.get(file.mimetype);

  if (!expectedType) {
    throw new AppError("Only JPEG, PNG, WebP, and GIF images are allowed", 415);
  }

  if (file.size === 0) {
    throw new AppError("Image file cannot be empty", 400);
  }

  const actualType = detectedImageType(file.buffer);

  if (actualType !== expectedType) {
    throw new AppError("Image content does not match its declared file type", 415);
  }
}

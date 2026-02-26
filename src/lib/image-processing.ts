import sharp from "sharp";
import {
  MAX_PHOTO_SIZE_BYTES,
  FULL_IMAGE_MAX_DIMENSION,
  THUMBNAIL_SIZE,
  FULL_IMAGE_QUALITY,
  THUMBNAIL_QUALITY,
} from "@/lib/constants";

export interface ProcessedImage {
  full: Buffer;
  thumb: Buffer;
  width: number;
  height: number;
  mimeType: string;
}

const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);

export async function processUploadedPhoto(
  buffer: Buffer
): Promise<ProcessedImage> {
  // 1. Check file size first (cheap check, no decoding needed)
  if (buffer.length > MAX_PHOTO_SIZE_BYTES) {
    throw new Error("File too large");
  }

  // 2. Validate it's a real image via Sharp metadata
  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch {
    throw new Error("Invalid image format");
  }

  if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format)) {
    throw new Error("Invalid image format");
  }

  // 3. Reject if dimensions < 100x100
  if (
    !metadata.width ||
    !metadata.height ||
    metadata.width < 100 ||
    metadata.height < 100
  ) {
    throw new Error("Image too small");
  }

  // 4-5. Auto-orient, resize to max 2048px on longest edge, compress to WebP
  const fullImage = sharp(buffer)
    .rotate() // auto-orient from EXIF
    .resize({
      width: FULL_IMAGE_MAX_DIMENSION,
      height: FULL_IMAGE_MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: FULL_IMAGE_QUALITY });

  const fullBuffer = await fullImage.toBuffer();

  // Read the final dimensions from the processed full image
  const fullMeta = await sharp(fullBuffer).metadata();

  // 6. Generate 300x300 square center-crop thumbnail
  const thumbBuffer = await sharp(buffer)
    .rotate() // auto-orient from EXIF
    .resize({
      width: THUMBNAIL_SIZE,
      height: THUMBNAIL_SIZE,
      fit: "cover",
      position: "centre",
    })
    .webp({ quality: THUMBNAIL_QUALITY })
    .toBuffer();

  // 7. Return the result
  return {
    full: fullBuffer,
    thumb: thumbBuffer,
    width: fullMeta.width!,
    height: fullMeta.height!,
    mimeType: "image/webp",
  };
}

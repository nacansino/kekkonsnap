import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { processUploadedPhoto } from "@/lib/image-processing";
import {
  FULL_IMAGE_MAX_DIMENSION,
  THUMBNAIL_SIZE,
  MAX_PHOTO_SIZE_BYTES,
} from "@/lib/constants";

/**
 * Helper: create a test JPEG image buffer of specified dimensions using Sharp.
 */
async function createTestJpeg(
  width: number,
  height: number
): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 255, g: 0, b: 0 },
    },
  })
    .jpeg()
    .toBuffer();
}

/**
 * Helper: create a test PNG image buffer of specified dimensions using Sharp.
 */
async function createTestPng(
  width: number,
  height: number
): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 0, g: 255, b: 0 },
    },
  })
    .png()
    .toBuffer();
}

describe("processUploadedPhoto", () => {
  it("should process a valid JPEG image and return WebP output", async () => {
    const input = await createTestJpeg(640, 480);
    const result = await processUploadedPhoto(input);

    // Output should be WebP
    expect(result.mimeType).toBe("image/webp");

    // Verify full image is valid WebP via sharp metadata
    const fullMeta = await sharp(result.full).metadata();
    expect(fullMeta.format).toBe("webp");

    // Verify thumbnail is valid WebP via sharp metadata
    const thumbMeta = await sharp(result.thumb).metadata();
    expect(thumbMeta.format).toBe("webp");
  });

  it("should process a valid PNG image", async () => {
    const input = await createTestPng(800, 600);
    const result = await processUploadedPhoto(input);

    expect(result.mimeType).toBe("image/webp");
    const fullMeta = await sharp(result.full).metadata();
    expect(fullMeta.format).toBe("webp");
  });

  it("should keep dimensions within max limits for a large image", async () => {
    // Create a wide image exceeding the max dimension
    const input = await createTestJpeg(4000, 2000);
    const result = await processUploadedPhoto(input);

    expect(result.width).toBeLessThanOrEqual(FULL_IMAGE_MAX_DIMENSION);
    expect(result.height).toBeLessThanOrEqual(FULL_IMAGE_MAX_DIMENSION);

    // The longest edge should be exactly 2048 (scaled down from 4000)
    expect(result.width).toBe(FULL_IMAGE_MAX_DIMENSION);
    // Height should be proportionally scaled: 2000 * (2048/4000) = 1024
    expect(result.height).toBe(1024);
  });

  it("should not enlarge a small-but-valid image", async () => {
    const input = await createTestJpeg(200, 150);
    const result = await processUploadedPhoto(input);

    // withoutEnlargement: should not exceed the original size
    expect(result.width).toBeLessThanOrEqual(200);
    expect(result.height).toBeLessThanOrEqual(150);
  });

  it("should generate a 300x300 square thumbnail", async () => {
    const input = await createTestJpeg(640, 480);
    const result = await processUploadedPhoto(input);

    const thumbMeta = await sharp(result.thumb).metadata();
    expect(thumbMeta.width).toBe(THUMBNAIL_SIZE);
    expect(thumbMeta.height).toBe(THUMBNAIL_SIZE);
  });

  it("should reject images smaller than 100x100 (too small width)", async () => {
    const input = await createTestJpeg(99, 200);
    await expect(processUploadedPhoto(input)).rejects.toThrow(
      "Image too small"
    );
  });

  it("should reject images smaller than 100x100 (too small height)", async () => {
    const input = await createTestJpeg(200, 99);
    await expect(processUploadedPhoto(input)).rejects.toThrow(
      "Image too small"
    );
  });

  it("should reject buffers larger than 20MB", async () => {
    // We don't need to create an actual 20MB image.
    // Create a buffer just over the limit and verify size check triggers.
    const oversized = Buffer.alloc(MAX_PHOTO_SIZE_BYTES + 1, 0);
    await expect(processUploadedPhoto(oversized)).rejects.toThrow(
      "File too large"
    );
  });

  it("should reject non-image data", async () => {
    const textBuffer = Buffer.from(
      "This is not an image, just plain text data."
    );
    await expect(processUploadedPhoto(textBuffer)).rejects.toThrow(
      "Invalid image format"
    );
  });

  it("should reject random binary data", async () => {
    const randomBuffer = Buffer.from(
      Array.from({ length: 512 }, () => Math.floor(Math.random() * 256))
    );
    await expect(processUploadedPhoto(randomBuffer)).rejects.toThrow(
      "Invalid image format"
    );
  });

  it("should return full and thumb as Buffer instances", async () => {
    const input = await createTestJpeg(640, 480);
    const result = await processUploadedPhoto(input);

    expect(Buffer.isBuffer(result.full)).toBe(true);
    expect(Buffer.isBuffer(result.thumb)).toBe(true);
  });
});

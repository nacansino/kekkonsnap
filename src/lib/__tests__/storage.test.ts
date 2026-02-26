import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import {
  getUploadDir,
  getEventDir,
  ensureEventDirs,
  savePhoto,
  getPhotoBuffer,
  deletePhoto,
} from "@/lib/storage";

describe("storage", () => {
  let tempDir: string;
  let originalEnv: string | undefined;

  beforeEach(() => {
    // Create a temp directory for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "kekkonsnap-test-"));
    // Save original env and set UPLOAD_DIR to temp
    originalEnv = process.env.UPLOAD_DIR;
    process.env.UPLOAD_DIR = tempDir;
  });

  afterEach(() => {
    // Restore original env
    if (originalEnv === undefined) {
      delete process.env.UPLOAD_DIR;
    } else {
      process.env.UPLOAD_DIR = originalEnv;
    }
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("getUploadDir", () => {
    it("should return UPLOAD_DIR from environment", () => {
      process.env.UPLOAD_DIR = "/custom/path";
      expect(getUploadDir()).toBe("/custom/path");
    });

    it("should return default path when UPLOAD_DIR is not set", () => {
      delete process.env.UPLOAD_DIR;
      expect(getUploadDir()).toBe("./data/uploads");
    });
  });

  describe("getEventDir", () => {
    it("should return the correct event directory path", () => {
      const dir = getEventDir(42);
      expect(dir).toBe(path.join(tempDir, "evt-42"));
    });
  });

  describe("ensureEventDirs", () => {
    it("should create full/ and thumb/ subdirectories", () => {
      ensureEventDirs(1);

      const eventDir = path.join(tempDir, "evt-1");
      expect(fs.existsSync(path.join(eventDir, "full"))).toBe(true);
      expect(fs.existsSync(path.join(eventDir, "thumb"))).toBe(true);
    });

    it("should not throw if directories already exist", () => {
      ensureEventDirs(1);
      // Call again -- should be idempotent
      expect(() => ensureEventDirs(1)).not.toThrow();
    });
  });

  describe("savePhoto and getPhotoBuffer", () => {
    it("should save full and thumbnail buffers and read them back", async () => {
      const eventId = 5;
      const photoId = "abc-def-123";
      const fullData = Buffer.from("full image data");
      const thumbData = Buffer.from("thumbnail data");

      const result = await savePhoto(eventId, photoId, fullData, thumbData);

      // Paths should be relative and use the correct structure
      expect(result.storagePath).toBe(`evt-5/full/${photoId}.webp`);
      expect(result.thumbnailPath).toBe(`evt-5/thumb/${photoId}.webp`);

      // Read back and verify contents
      const readFull = await getPhotoBuffer(result.storagePath);
      expect(readFull.equals(fullData)).toBe(true);

      const readThumb = await getPhotoBuffer(result.thumbnailPath);
      expect(readThumb.equals(thumbData)).toBe(true);
    });

    it("should create event directories automatically when saving", async () => {
      const eventId = 99;
      const photoId = "test-uuid";
      const fullData = Buffer.from("full");
      const thumbData = Buffer.from("thumb");

      await savePhoto(eventId, photoId, fullData, thumbData);

      const eventDir = path.join(tempDir, "evt-99");
      expect(fs.existsSync(path.join(eventDir, "full"))).toBe(true);
      expect(fs.existsSync(path.join(eventDir, "thumb"))).toBe(true);
    });
  });

  describe("deletePhoto", () => {
    it("should delete both full and thumbnail files", async () => {
      const eventId = 7;
      const photoId = "to-delete";
      const fullData = Buffer.from("full image");
      const thumbData = Buffer.from("thumb image");

      const { storagePath, thumbnailPath } = await savePhoto(
        eventId,
        photoId,
        fullData,
        thumbData
      );

      // Verify files exist before deletion
      const fullAbsolute = path.join(tempDir, storagePath);
      const thumbAbsolute = path.join(tempDir, thumbnailPath);
      expect(fs.existsSync(fullAbsolute)).toBe(true);
      expect(fs.existsSync(thumbAbsolute)).toBe(true);

      // Delete and verify
      deletePhoto(storagePath, thumbnailPath);
      expect(fs.existsSync(fullAbsolute)).toBe(false);
      expect(fs.existsSync(thumbAbsolute)).toBe(false);
    });

    it("should not throw if files do not exist", () => {
      expect(() =>
        deletePhoto("evt-999/full/no-such.webp", "evt-999/thumb/no-such.webp")
      ).not.toThrow();
    });
  });
});

import fs from "fs";
import path from "path";

/**
 * Returns the root upload directory, from env UPLOAD_DIR or default ./data/uploads.
 */
export function getUploadDir(): string {
  return process.env.UPLOAD_DIR || "./data/uploads";
}

/**
 * Returns the directory for a specific event's uploads: {uploadDir}/evt-{id}
 */
export function getEventDir(eventId: number): string {
  return path.join(getUploadDir(), `evt-${eventId}`);
}

/**
 * Creates the full/ and thumb/ subdirectories for an event.
 * Uses recursive: true so it is idempotent.
 */
export function ensureEventDirs(eventId: number): void {
  const eventDir = getEventDir(eventId);
  fs.mkdirSync(path.join(eventDir, "full"), { recursive: true });
  fs.mkdirSync(path.join(eventDir, "thumb"), { recursive: true });
}

/**
 * Saves full-size and thumbnail buffers to disk for a given event and photo ID.
 * Returns relative paths (relative to the upload directory).
 */
export async function savePhoto(
  eventId: number,
  photoId: string,
  full: Buffer,
  thumb: Buffer
): Promise<{ storagePath: string; thumbnailPath: string }> {
  // Ensure directories exist
  ensureEventDirs(eventId);

  const uploadDir = getUploadDir();
  const storagePath = path.join(`evt-${eventId}`, "full", `${photoId}.webp`);
  const thumbnailPath = path.join(
    `evt-${eventId}`,
    "thumb",
    `${photoId}.webp`
  );

  await fs.promises.writeFile(path.join(uploadDir, storagePath), full);
  await fs.promises.writeFile(path.join(uploadDir, thumbnailPath), thumb);

  return { storagePath, thumbnailPath };
}

/**
 * Reads a photo buffer from disk given a path relative to the upload directory.
 */
export async function getPhotoBuffer(relativePath: string): Promise<Buffer> {
  const absolutePath = path.join(getUploadDir(), relativePath);
  return fs.promises.readFile(absolutePath);
}

/**
 * Deletes both the full-size and thumbnail files for a photo.
 * Paths are relative to the upload directory. Does not throw if files are missing.
 */
export function deletePhoto(
  storagePath: string,
  thumbnailPath: string
): void {
  const uploadDir = getUploadDir();
  const fullAbsolute = path.join(uploadDir, storagePath);
  const thumbAbsolute = path.join(uploadDir, thumbnailPath);

  try {
    fs.unlinkSync(fullAbsolute);
  } catch {
    // Ignore if file does not exist
  }

  try {
    fs.unlinkSync(thumbAbsolute);
  } catch {
    // Ignore if file does not exist
  }
}

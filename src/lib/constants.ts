export const APP_NAME = "Kekkonsnap";

export const SESSION_COOKIE_NAME = "kekkonsnap-session";
export const ADMIN_COOKIE_NAME = "kekkonsnap-admin";

export const SESSION_EXPIRY_HOURS = 24;
export const ADMIN_EXPIRY_HOURS = 4;

export const MAX_PHOTO_SIZE_BYTES = 20 * 1024 * 1024; // 20MB raw upload limit
export const FULL_IMAGE_MAX_DIMENSION = 2048;
export const THUMBNAIL_SIZE = 300;
export const FULL_IMAGE_QUALITY = 100;
export const THUMBNAIL_QUALITY = 85;

export const RATE_LIMITS = {
  PHOTO_UPLOAD: { limit: 1, windowMs: 2000 },
  ADMIN_LOGIN: { limit: 5, windowMs: 60000 },
  GUEST_IDENTIFY: { limit: 10, windowMs: 60000 },
} as const;

export const SSE_HEARTBEAT_INTERVAL_MS = 30_000;

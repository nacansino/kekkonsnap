import { describe, it, expect, vi, beforeEach } from "vitest";

// Set a test JWT_SECRET before importing modules
process.env.JWT_SECRET = "test-secret-key-for-vitest-minimum-32-chars!!";

describe("Guest session auth (src/lib/auth.ts)", () => {
  let signSessionToken: typeof import("@/lib/auth").signSessionToken;
  let verifySessionToken: typeof import("@/lib/auth").verifySessionToken;

  beforeEach(async () => {
    const authModule = await import("@/lib/auth");
    signSessionToken = authModule.signSessionToken;
    verifySessionToken = authModule.verifySessionToken;
  });

  it("signs and verifies a valid guest session token", async () => {
    const payload = { sessionId: "abc-123", guestId: 1, eventId: 42 };
    const token = await signSessionToken(payload);

    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3); // JWT has 3 parts

    const result = await verifySessionToken(token);
    expect(result).not.toBeNull();
    expect(result!.sessionId).toBe("abc-123");
    expect(result!.guestId).toBe(1);
    expect(result!.eventId).toBe(42);
  });

  it("returns null for an invalid token", async () => {
    const result = await verifySessionToken("not.a.valid.token");
    expect(result).toBeNull();
  });

  it("returns null for a completely garbled string", async () => {
    const result = await verifySessionToken("garbled");
    expect(result).toBeNull();
  });

  it("returns null for an empty string", async () => {
    const result = await verifySessionToken("");
    expect(result).toBeNull();
  });

  it("rejects an expired token", async () => {
    // We sign a token, then mock time forward past the 24hr expiry
    const payload = { sessionId: "expire-test", guestId: 2, eventId: 10 };
    const token = await signSessionToken(payload);

    // Advance time by 25 hours (past 24hr expiry)
    const futureDate = new Date(Date.now() + 25 * 60 * 60 * 1000);
    vi.useFakeTimers();
    vi.setSystemTime(futureDate);

    const result = await verifySessionToken(token);
    expect(result).toBeNull();

    vi.useRealTimers();
  });

  it("preserves all payload fields through sign/verify round-trip", async () => {
    const payload = { sessionId: "round-trip", guestId: 99, eventId: 7 };
    const token = await signSessionToken(payload);
    const result = await verifySessionToken(token);

    expect(result).toMatchObject(payload);
  });
});

describe("Admin auth (src/lib/admin-auth.ts)", () => {
  let hashPassword: typeof import("@/lib/admin-auth").hashPassword;
  let verifyPassword: typeof import("@/lib/admin-auth").verifyPassword;
  let signAdminToken: typeof import("@/lib/admin-auth").signAdminToken;
  let verifyAdminToken: typeof import("@/lib/admin-auth").verifyAdminToken;

  beforeEach(async () => {
    const adminModule = await import("@/lib/admin-auth");
    hashPassword = adminModule.hashPassword;
    verifyPassword = adminModule.verifyPassword;
    signAdminToken = adminModule.signAdminToken;
    verifyAdminToken = adminModule.verifyAdminToken;
  });

  describe("password hashing", () => {
    it("hashes a password and verifies it correctly", async () => {
      const password = "super-secret-admin-pass";
      const hash = await hashPassword(password);

      expect(typeof hash).toBe("string");
      expect(hash).not.toBe(password); // hash should differ from plaintext
      expect(hash.startsWith("$2")).toBe(true); // bcrypt hash prefix

      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it("rejects an incorrect password", async () => {
      const hash = await hashPassword("correct-password");
      const isValid = await verifyPassword("wrong-password", hash);
      expect(isValid).toBe(false);
    });

    it("produces different hashes for the same password (salt)", async () => {
      const password = "same-password";
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("admin token", () => {
    it("signs and verifies a valid admin token", async () => {
      const payload = { eventId: 42 };
      const token = await signAdminToken(payload);

      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3);

      const result = await verifyAdminToken(token);
      expect(result).not.toBeNull();
      expect(result!.eventId).toBe(42);
      expect(result!.role).toBe("admin");
    });

    it("returns null for an invalid admin token", async () => {
      const result = await verifyAdminToken("invalid.token.here");
      expect(result).toBeNull();
    });

    it("returns null for an empty string", async () => {
      const result = await verifyAdminToken("");
      expect(result).toBeNull();
    });

    it("rejects an expired admin token", async () => {
      const token = await signAdminToken({ eventId: 5 });

      // Advance time by 5 hours (past 4hr expiry)
      const futureDate = new Date(Date.now() + 5 * 60 * 60 * 1000);
      vi.useFakeTimers();
      vi.setSystemTime(futureDate);

      const result = await verifyAdminToken(token);
      expect(result).toBeNull();

      vi.useRealTimers();
    });

    it("includes role=admin in the token payload", async () => {
      const token = await signAdminToken({ eventId: 10 });
      const result = await verifyAdminToken(token);
      expect(result).not.toBeNull();
      expect(result!.role).toBe("admin");
    });
  });

  describe("cross-token rejection", () => {
    let signSessionToken: typeof import("@/lib/auth").signSessionToken;

    beforeEach(async () => {
      const authModule = await import("@/lib/auth");
      signSessionToken = authModule.signSessionToken;
    });

    it("admin verifier rejects a guest session token", async () => {
      const guestToken = await signSessionToken({
        sessionId: "guest-123",
        guestId: 1,
        eventId: 1,
      });
      const result = await verifyAdminToken(guestToken);
      // Should either return null or not have the admin role
      if (result !== null) {
        expect(result.role).not.toBe("admin");
      } else {
        expect(result).toBeNull();
      }
    });
  });
});

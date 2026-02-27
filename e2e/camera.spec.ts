import { test, expect } from "./fixtures/test-app";

test.describe("Camera page — permission denied", () => {
  test("shows Camera Access Needed heading and Try Again button", async ({
    authedPage,
    slug,
  }) => {
    // Mock getUserMedia to throw NotAllowedError
    await authedPage.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = async () => {
        throw new DOMException("Permission denied", "NotAllowedError");
      };
    });

    await authedPage.goto(`/${slug}/camera`);

    await expect(
      authedPage.getByRole("heading", { name: "Camera Access Needed" })
    ).toBeVisible();

    const tryAgainButton = authedPage.getByRole("button", {
      name: "Try Again",
    });
    await expect(tryAgainButton).toBeVisible();
  });

  test("Try Again button is not clipped horizontally and reachable by scrolling", async ({
    authedPage,
    slug,
  }) => {
    await authedPage.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = async () => {
        throw new DOMException("Permission denied", "NotAllowedError");
      };
    });

    await authedPage.goto(`/${slug}/camera`);

    const tryAgainButton = authedPage.getByRole("button", {
      name: "Try Again",
    });
    await expect(tryAgainButton).toBeVisible();

    const viewport = authedPage.viewportSize()!;
    const box = await tryAgainButton.boundingBox();
    expect(box).not.toBeNull();

    // Not clipped horizontally
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);

    // Reachable: scroll to it and verify it's now in viewport
    await tryAgainButton.scrollIntoViewIfNeeded();
    const boxAfterScroll = await tryAgainButton.boundingBox();
    expect(boxAfterScroll).not.toBeNull();
    expect(boxAfterScroll!.y + boxAfterScroll!.height).toBeLessThanOrEqual(
      viewport.height + 1 // 1px tolerance for rounding
    );
  });

  test("visual regression — denied state", async ({ authedPage, slug }) => {
    await authedPage.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = async () => {
        throw new DOMException("Permission denied", "NotAllowedError");
      };
    });

    await authedPage.goto(`/${slug}/camera`);
    await expect(
      authedPage.getByRole("heading", { name: "Camera Access Needed" })
    ).toBeVisible();
    await authedPage.waitForTimeout(500);
    await expect(authedPage).toHaveScreenshot("camera-denied.png");
  });
});

test.describe("Camera page — ready state", () => {
  test("shows video element and shutter button", async ({
    authedPage,
    slug,
  }) => {
    // Mock getUserMedia to return a fake stream
    await authedPage.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#333";
        ctx.fillRect(0, 0, 640, 480);
        return canvas.captureStream(0);
      };
    });

    await authedPage.goto(`/${slug}/camera`);

    // Wait for camera to initialize — look for the video element
    const video = authedPage.locator("video");
    await expect(video).toBeVisible({ timeout: 10_000 });

    // Shutter button should be present (it's a button with aria label or specific styling)
    const shutterButton = authedPage.getByRole("button", {
      name: "Take photo",
    });
    await expect(shutterButton).toBeVisible();
  });

  test("shutter button is centered and within viewport", async ({
    authedPage,
    slug,
  }) => {
    await authedPage.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#333";
        ctx.fillRect(0, 0, 640, 480);
        return canvas.captureStream(0);
      };
    });

    await authedPage.goto(`/${slug}/camera`);

    const video = authedPage.locator("video");
    await expect(video).toBeVisible({ timeout: 10_000 });

    const shutterButton = authedPage.getByRole("button", {
      name: "Take photo",
    });
    await expect(shutterButton).toBeVisible();

    const viewport = authedPage.viewportSize()!;
    const box = await shutterButton.boundingBox();
    expect(box).not.toBeNull();

    // Within viewport
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);

    // Roughly centered horizontally (within 20% of center)
    const buttonCenterX = box!.x + box!.width / 2;
    const viewportCenterX = viewport.width / 2;
    expect(Math.abs(buttonCenterX - viewportCenterX)).toBeLessThan(
      viewport.width * 0.2
    );
  });

  test("visual regression — ready state", async ({ authedPage, slug }) => {
    await authedPage.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#333";
        ctx.fillRect(0, 0, 640, 480);
        return canvas.captureStream(0);
      };
    });

    await authedPage.goto(`/${slug}/camera`);
    const video = authedPage.locator("video");
    await expect(video).toBeVisible({ timeout: 10_000 });
    await authedPage.waitForTimeout(500);
    await expect(authedPage).toHaveScreenshot("camera-ready.png");
  });
});

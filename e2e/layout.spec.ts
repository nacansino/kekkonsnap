import { test, expect } from "./fixtures/test-app";
import { test as baseTest } from "@playwright/test";

const SLUG = "e2e-test";

baseTest.describe("Layout — landing page (no auth)", () => {
  baseTest("landing page has no horizontal overflow", async ({ page }) => {
    await page.goto(`/${SLUG}`);
    await page.waitForTimeout(1000);

    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth
    );
    const clientWidth = await page.evaluate(
      () => document.documentElement.clientWidth
    );
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });

  baseTest("landing page has visible header h1", async ({ page }) => {
    await page.goto(`/${SLUG}`);

    const header = page.locator("header h1");
    await expect(header).toBeVisible();

    const viewport = page.viewportSize()!;
    const box = await header.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
  });
});

test.describe("Layout — authed pages overflow", () => {
  const pages = [
    { name: "photos", path: "/photos" },
    { name: "winner", path: "/winner" },
  ];

  for (const { name, path } of pages) {
    test(`${name} page has no horizontal overflow`, async ({
      authedPage,
      slug,
    }) => {
      await authedPage.goto(`/${slug}${path}`);
      await authedPage.waitForTimeout(1000);

      const scrollWidth = await authedPage.evaluate(
        () => document.documentElement.scrollWidth
      );
      const clientWidth = await authedPage.evaluate(
        () => document.documentElement.clientWidth
      );
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    });
  }
});

test.describe("Layout — authed pages header", () => {
  const pages = [
    { name: "photos", path: "/photos" },
    { name: "winner", path: "/winner" },
  ];

  for (const { name, path } of pages) {
    test(`${name} page has visible header h1`, async ({
      authedPage,
      slug,
    }) => {
      await authedPage.goto(`/${slug}${path}`);

      const header = authedPage.locator("header h1");
      await expect(header).toBeVisible();

      const viewport = authedPage.viewportSize()!;
      const box = await header.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    });
  }
});

test.describe("Layout — terms page (pre-terms auth)", () => {
  test("terms page has no horizontal overflow", async ({
    preTermsPage,
    slug,
  }) => {
    await preTermsPage.goto(`/${slug}/terms`);
    await preTermsPage.waitForTimeout(1000);

    const scrollWidth = await preTermsPage.evaluate(
      () => document.documentElement.scrollWidth
    );
    const clientWidth = await preTermsPage.evaluate(
      () => document.documentElement.clientWidth
    );
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });

  test("terms page has visible header h1", async ({ preTermsPage, slug }) => {
    await preTermsPage.goto(`/${slug}/terms`);

    const header = preTermsPage.locator("header h1");
    await expect(header).toBeVisible();

    const viewport = preTermsPage.viewportSize()!;
    const box = await header.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
  });
});

test.describe("Layout — camera page", () => {
  test("camera denied page has no horizontal overflow", async ({
    authedPage,
    slug,
  }) => {
    await authedPage.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = async () => {
        throw new DOMException("Permission denied", "NotAllowedError");
      };
    });

    await authedPage.goto(`/${slug}/camera`);
    await expect(
      authedPage.getByRole("heading", { name: "Camera Access Needed" })
    ).toBeVisible();

    const scrollWidth = await authedPage.evaluate(
      () => document.documentElement.scrollWidth
    );
    const clientWidth = await authedPage.evaluate(
      () => document.documentElement.clientWidth
    );
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });

  test("camera denied page has visible header h1", async ({
    authedPage,
    slug,
  }) => {
    await authedPage.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = async () => {
        throw new DOMException("Permission denied", "NotAllowedError");
      };
    });

    await authedPage.goto(`/${slug}/camera`);
    await expect(
      authedPage.getByRole("heading", { name: "Camera Access Needed" })
    ).toBeVisible();

    const header = authedPage.locator("header h1");
    await expect(header).toBeVisible();

    const viewport = authedPage.viewportSize()!;
    const box = await header.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
  });
});

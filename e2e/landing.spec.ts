import { test, expect } from "./fixtures/test-app";

test.describe("Landing page", () => {
  test("shows heading and search input", async ({ page, slug }) => {
    await page.goto(`/${slug}`);

    await expect(
      page.getByRole("heading", { name: "Capture the moment" })
    ).toBeVisible();

    await expect(
      page.getByPlaceholder("Search your name...")
    ).toBeVisible();
  });

  test("Join button is disabled without guest selection", async ({
    page,
    slug,
  }) => {
    await page.goto(`/${slug}`);

    const joinButton = page.getByRole("button", { name: "Join the Contest" });
    await expect(joinButton).toBeVisible();
    await expect(joinButton).toBeDisabled();
  });

  test("autocomplete shows dropdown on typing", async ({ page, slug }) => {
    await page.goto(`/${slug}`);

    const input = page.getByPlaceholder("Search your name...");
    await input.fill("Ali");

    // Wait for dropdown to appear
    const listbox = page.getByRole("listbox");
    await expect(listbox).toBeVisible();

    // Should contain "Alice Johnson"
    await expect(
      page.getByRole("option").filter({ hasText: "Alice Johnson" })
    ).toBeVisible();
  });

  test("selecting guest enables Join button", async ({ page, slug }) => {
    await page.goto(`/${slug}`);

    const input = page.getByPlaceholder("Search your name...");
    await input.fill("Ali");

    const option = page
      .getByRole("option")
      .filter({ hasText: "Alice Johnson" });
    await option.click();

    const joinButton = page.getByRole("button", { name: "Join the Contest" });
    await expect(joinButton).toBeEnabled();
  });

  test("Join button is within viewport", async ({ page, slug }) => {
    await page.goto(`/${slug}`);

    const joinButton = page.getByRole("button", { name: "Join the Contest" });
    await expect(joinButton).toBeVisible();

    const viewport = page.viewportSize()!;
    const box = await joinButton.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
  });

  test("visual regression", async ({ page, slug }) => {
    await page.goto(`/${slug}`);
    // Wait for content to stabilize
    await expect(
      page.getByRole("heading", { name: "Capture the moment" })
    ).toBeVisible();
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot("landing.png");
  });
});

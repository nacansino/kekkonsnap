import { test, expect } from "./fixtures/test-app";

test.describe("Photos page", () => {
  test("shows Your Snaps heading", async ({ authedPage, slug }) => {
    await authedPage.goto(`/${slug}/photos`);

    await expect(
      authedPage.getByRole("heading", { name: "Your Snaps" })
    ).toBeVisible();
  });

  test("shows empty state with Open Camera button", async ({
    authedPage,
    slug,
  }) => {
    await authedPage.goto(`/${slug}/photos`);

    await expect(
      authedPage.getByText("taken any snaps yet", { exact: false })
    ).toBeVisible();

    const openCameraButton = authedPage.getByRole("button", {
      name: "Open Camera",
    });
    await expect(openCameraButton).toBeVisible();
  });

  test("Go to Winner Reveal button is visible and within viewport", async ({
    authedPage,
    slug,
  }) => {
    await authedPage.goto(`/${slug}/photos`);

    const winnerButton = authedPage.getByRole("button", {
      name: "Go to Winner Reveal",
    });
    await expect(winnerButton).toBeVisible();

    const viewport = authedPage.viewportSize()!;
    const box = await winnerButton.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
  });

  test("visual regression", async ({ authedPage, slug }) => {
    await authedPage.goto(`/${slug}/photos`);
    await expect(
      authedPage.getByRole("heading", { name: "Your Snaps" })
    ).toBeVisible();
    await authedPage.waitForTimeout(500);
    await expect(authedPage).toHaveScreenshot("photos-empty.png");
  });
});

import { test, expect } from "./fixtures/test-app";

test.describe("Winner page", () => {
  test("shows waiting message when contest is active", async ({
    authedPage,
    slug,
  }) => {
    await authedPage.goto(`/${slug}/winner`);

    await expect(
      authedPage.getByText("contest is still open", { exact: false })
    ).toBeVisible();
  });

  test("Your Snaps button is visible and navigates to photos", async ({
    authedPage,
    slug,
  }) => {
    await authedPage.goto(`/${slug}/winner`);

    const snapsButton = authedPage.getByRole("button", {
      name: "Your Snaps",
    });
    await expect(snapsButton).toBeVisible();

    await snapsButton.click();
    await authedPage.waitForURL(`**/${slug}/photos`);
    expect(authedPage.url()).toContain(`/${slug}/photos`);
  });

  test("no horizontal overflow", async ({ authedPage, slug }) => {
    await authedPage.goto(`/${slug}/winner`);

    await expect(
      authedPage.getByText("contest is still open", { exact: false })
    ).toBeVisible();

    const scrollWidth = await authedPage.evaluate(
      () => document.documentElement.scrollWidth
    );
    const clientWidth = await authedPage.evaluate(
      () => document.documentElement.clientWidth
    );
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });

  test("visual regression", async ({ authedPage, slug }) => {
    await authedPage.goto(`/${slug}/winner`);
    await expect(
      authedPage.getByText("contest is still open", { exact: false })
    ).toBeVisible();
    await authedPage.waitForTimeout(500);
    await expect(authedPage).toHaveScreenshot("winner-waiting.png");
  });
});

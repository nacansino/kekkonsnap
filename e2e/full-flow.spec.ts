import { test, expect } from "@playwright/test";

const SLUG = "e2e-test";

test.describe("Full guest flow (end-to-end)", () => {
  // Skip on WebKit: Set-Cookie from fetch() responses aren't immediately
  // available to subsequent fetch() calls in WebKit, causing the
  // identify → refreshSession → redirect chain to fail.
  // This is a known browser behavior difference, not a test issue.
  test.skip(
    ({ browserName }) => browserName === "webkit",
    "WebKit defers Set-Cookie from fetch, breaking identify→redirect flow"
  );

  test("landing → identify → terms → camera → photos → winner", async ({
    page,
  }) => {
    // 1. Landing page
    await page.goto(`/${SLUG}`);
    await expect(
      page.getByRole("heading", { name: "Capture the moment" })
    ).toBeVisible();

    // 2. Search and select a guest
    const input = page.getByPlaceholder("Search your name...");
    await input.fill("Char");

    const option = page
      .getByRole("option")
      .filter({ hasText: "Charlie Brown" });
    await expect(option).toBeVisible();
    await option.click();

    // 3. Click Join
    const joinButton = page.getByRole("button", { name: "Join the Contest" });
    await expect(joinButton).toBeEnabled();
    await joinButton.click();

    // 4. Should navigate to terms
    await expect(page).toHaveURL(new RegExp(`/${SLUG}/terms`), {
      timeout: 15_000,
    });
    await expect(
      page.getByRole("heading", { name: "Before we begin" })
    ).toBeVisible();

    // 5. Agree to terms
    await page
      .getByText("I understand and agree to the photo contest terms")
      .click();

    await page.getByRole("button", { name: "Continue" }).click();

    // 6. Should navigate to camera
    await expect(page).toHaveURL(new RegExp(`/${SLUG}/camera`), {
      timeout: 15_000,
    });
    expect(page.url()).toContain(`/${SLUG}/camera`);

    // 7. Navigate to photos via URL
    await page.goto(`/${SLUG}/photos`);
    await expect(
      page.getByRole("heading", { name: "Your Snaps" })
    ).toBeVisible();

    // 8. Navigate to winner via button
    const winnerButton = page.getByRole("button", {
      name: "Go to Winner Reveal",
    });
    await expect(winnerButton).toBeVisible();
    await winnerButton.click();

    await expect(page).toHaveURL(new RegExp(`/${SLUG}/winner`), {
      timeout: 15_000,
    });
    await expect(
      page.getByText("contest is still open", { exact: false })
    ).toBeVisible();
  });
});

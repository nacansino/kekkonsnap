import { test, expect } from "@playwright/test";

const SLUG = "e2e-test";
const EVENT_PASSWORD = "e2e-test-password";

/**
 * Helper to log in as admin and return an authenticated page.
 */
async function adminLogin(page: import("@playwright/test").Page) {
  await page.goto(`/admin/${SLUG}`);
  await page.getByPlaceholder("Enter event password").fill(EVENT_PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL(`**/admin/${SLUG}/dashboard`, { timeout: 10_000 });
}

test.describe("Admin Dashboard — Events nav link", () => {
  test("should show Events link in nav header", async ({ page }) => {
    await adminLogin(page);

    const eventsLink = page.getByRole("link", { name: "Events" });
    await expect(eventsLink).toBeVisible();
  });

  test("Events link navigates to /admin", async ({ page }) => {
    await adminLogin(page);

    await page.getByRole("link", { name: "Events" }).click();
    await expect(page).toHaveURL(/\/admin$/, { timeout: 10_000 });
  });
});

test.describe("Admin Dashboard — Photo lightbox", () => {
  test("clicking a photo opens the lightbox with swipe controls", async ({
    page,
  }) => {
    await adminLogin(page);

    // Wait for photo grid to load
    const grid = page.locator(
      ".grid.grid-cols-2"
    );

    // Check if there are photos
    const photoCards = grid.locator("> div");
    const count = await photoCards.count();

    if (count === 0) {
      // No photos — skip lightbox test
      test.skip();
      return;
    }

    // Click the first photo
    await photoCards.first().click();

    // Lightbox should be visible (fixed overlay with bg-black/95)
    const lightbox = page.locator(".fixed.inset-0.z-50");
    await expect(lightbox).toBeVisible();

    // Should show photo counter
    await expect(lightbox.locator("text=/\\d+ \\/ \\d+/")).toBeVisible();

    // Close button should be present
    const closeButton = lightbox.getByLabel("Close");
    await expect(closeButton).toBeVisible();

    // Close the lightbox
    await closeButton.click();
    await expect(lightbox).not.toBeVisible();
  });
});

test.describe("Admin Dashboard — Schedule Lock", () => {
  test("should show Schedule Lock button when event is active", async ({
    page,
  }) => {
    await adminLogin(page);

    // Look for the "Schedule Lock" button
    const scheduleBtn = page.getByRole("button", { name: "Schedule Lock" });
    await expect(scheduleBtn).toBeVisible();
  });

  test("clicking Schedule Lock opens the datetime picker modal", async ({
    page,
  }) => {
    await adminLogin(page);

    await page.getByRole("button", { name: "Schedule Lock" }).click();

    // Modal should appear with heading
    await expect(
      page.getByRole("heading", { name: "Schedule Auto-Lock" })
    ).toBeVisible();

    // Should have a datetime-local input
    const input = page.locator('input[type="datetime-local"]');
    await expect(input).toBeVisible();

    // Should have Set Schedule and Cancel buttons
    await expect(
      page.getByRole("button", { name: "Set Schedule" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Cancel" })
    ).toBeVisible();
  });

  test("cancel button closes the schedule modal", async ({ page }) => {
    await adminLogin(page);

    await page.getByRole("button", { name: "Schedule Lock" }).click();

    await expect(
      page.getByRole("heading", { name: "Schedule Auto-Lock" })
    ).toBeVisible();

    // Get the Cancel button within the schedule modal
    // The modal has multiple Cancel buttons, target the one in the schedule modal
    const modal = page.locator("div").filter({
      has: page.getByRole("heading", { name: "Schedule Auto-Lock" }),
    });
    await modal.getByRole("button", { name: "Cancel" }).click();

    // Modal should be gone
    await expect(
      page.getByRole("heading", { name: "Schedule Auto-Lock" })
    ).not.toBeVisible();
  });
});

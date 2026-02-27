import { test, expect } from "./fixtures/test-app";
import { test as baseTest } from "@playwright/test";
import { createIdentifiedContext } from "./helpers/auth";
import { TEST_GUESTS } from "./global-setup";

test.describe("Terms page", () => {
  test("shows heading and terms content", async ({ preTermsPage, slug }) => {
    await preTermsPage.goto(`/${slug}/terms`);

    await expect(
      preTermsPage.getByRole("heading", { name: "Before we begin" })
    ).toBeVisible();

    await expect(
      preTermsPage.getByText("Please review and accept")
    ).toBeVisible();
  });

  test("Continue button is disabled until checkbox checked", async ({
    preTermsPage,
    slug,
  }) => {
    await preTermsPage.goto(`/${slug}/terms`);

    const continueButton = preTermsPage.getByRole("button", {
      name: "Continue",
    });
    await expect(continueButton).toBeVisible();
    await expect(continueButton).toBeDisabled();
  });

  test("checking checkbox enables Continue button", async ({
    preTermsPage,
    slug,
  }) => {
    await preTermsPage.goto(`/${slug}/terms`);

    await preTermsPage
      .getByText("I understand and agree to the photo contest terms")
      .click();

    const continueButton = preTermsPage.getByRole("button", {
      name: "Continue",
    });
    await expect(continueButton).toBeEnabled();
  });

  test("Continue button fits within viewport", async ({
    preTermsPage,
    slug,
  }) => {
    await preTermsPage.goto(`/${slug}/terms`);

    const continueButton = preTermsPage.getByRole("button", {
      name: "Continue",
    });
    await expect(continueButton).toBeVisible();

    const viewport = preTermsPage.viewportSize()!;
    const box = await continueButton.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
  });

  test("visual regression", async ({ preTermsPage, slug }) => {
    await preTermsPage.goto(`/${slug}/terms`);
    await expect(
      preTermsPage.getByRole("heading", { name: "Before we begin" })
    ).toBeVisible();
    await preTermsPage.waitForTimeout(500);
    await expect(preTermsPage).toHaveScreenshot("terms.png");
  });
});

// Use a separate guest (Diana) for the navigation test since it mutates session state
baseTest.describe("Terms page — navigation", () => {
  baseTest(
    "checking + clicking Continue navigates to camera",
    async ({ browser }) => {
      const slug = "e2e-test";
      // Use Diana (index 3) — a fresh guest whose terms won't affect other tests
      const context = await createIdentifiedContext(
        browser,
        TEST_GUESTS[3].name
      );
      const page = await context.newPage();

      await page.goto(`/${slug}/terms`);

      await page
        .getByText("I understand and agree to the photo contest terms")
        .click();

      await page.getByRole("button", { name: "Continue" }).click();

      await page.waitForURL(`**/${slug}/camera`);
      expect(page.url()).toContain(`/${slug}/camera`);

      await context.close();
    }
  );
});

import { test, expect } from "./fixtures/test-app";

test.describe("Gallery page", () => {
  test("redirects to winner page when event is not announced", async ({
    authedPage,
    slug,
  }) => {
    await authedPage.goto(`/${slug}/gallery`);

    // Should redirect to /winner since event status is "active"
    await authedPage.waitForURL(`**/${slug}/winner`, { timeout: 10_000 });
    expect(authedPage.url()).toContain(`/${slug}/winner`);
  });
});

import { test as base, type Page } from "@playwright/test";
import { createAuthedContext, createIdentifiedContext } from "../helpers/auth";
import { TEST_EVENT, TEST_GUESTS } from "../global-setup";

type TestFixtures = {
  /** Page with full auth (identified + agreed to terms) */
  authedPage: Page;
  /** Page with partial auth (identified, NOT agreed to terms) */
  preTermsPage: Page;
  /** The test event slug */
  slug: string;
  /** The test guest names */
  guestNames: string[];
};

export const test = base.extend<TestFixtures>({
  slug: TEST_EVENT.slug,

  guestNames: TEST_GUESTS.map((g) => g.name),

  authedPage: async ({ browser }, use) => {
    const context = await createAuthedContext(browser);
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  preTermsPage: async ({ browser }, use) => {
    // Use a different guest to avoid session conflicts
    const context = await createIdentifiedContext(
      browser,
      TEST_GUESTS[1].name
    );
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect } from "@playwright/test";

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "html",

  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.05,
    },
  },

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  globalSetup: "./e2e/global-setup.ts",

  projects: [
    {
      name: "iphone-se",
      use: { ...devices["iPhone SE"] },
    },
    {
      name: "iphone-14",
      use: { ...devices["iPhone 14"] },
    },
    {
      name: "iphone-15-pro-max",
      use: { ...devices["iPhone 15 Pro Max"] },
    },
    {
      name: "pixel-7",
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "galaxy-s23",
      use: {
        viewport: { width: 360, height: 780 },
        userAgent:
          "Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        defaultBrowserType: "chromium",
      },
    },
    {
      name: "desktop-chrome",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: "desktop-firefox",
      use: {
        ...devices["Desktop Firefox"],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: "desktop-safari",
      use: {
        ...devices["Desktop Safari"],
        viewport: { width: 1280, height: 720 },
      },
    },
  ],

  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});

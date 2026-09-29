import { defineConfig, devices } from "@playwright/test";

/**
 * Two viewports in both directions — the /end-session protocol screenshots
 * every touched screen at 1440px and 390px, in AR and EN.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: {
    command: "pnpm build && pnpm start",
    url: "http://127.0.0.1:3000/ar/dashboard",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});

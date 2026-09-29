import { test } from "@playwright/test";

/**
 * Screenshot pass for the /end-session fidelity review. Not an assertion
 * suite — it writes PNGs to docs/screenshots/<session>/ for eyeball
 * comparison against the wireframe.
 *
 * Run with: pnpm test:e2e screenshots
 */
const SESSION = "session-01";

const SCREENS = [
  { name: "dashboard", path: "/dashboard" },
  { name: "tasks", path: "/tasks" },
  { name: "settings-roles", path: "/settings/roles" },
  { name: "login", path: "/login" },
] as const;

for (const locale of ["ar", "en"] as const) {
  for (const screen of SCREENS) {
    test(`${screen.name} · ${locale}`, async ({ page }, testInfo) => {
      await page.goto(`/${locale}${screen.path}`);
      await page.waitForLoadState("networkidle");
      await page.screenshot({
        path: `docs/screenshots/${SESSION}/${screen.name}-${locale}-${testInfo.project.name}.png`,
        fullPage: true,
      });
    });
  }
}

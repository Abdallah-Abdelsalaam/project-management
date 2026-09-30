import { test } from "@playwright/test";
import { databaseMissingReason, SEEDED, signIn, submitCredentials } from "./fixtures/auth";

/**
 * Screenshot pass for the /end-session fidelity review. Not an assertion
 * suite — it writes PNGs to docs/screenshots/<session>/ for eyeball
 * comparison against the wireframe.
 *
 * Run with: pnpm test:e2e screenshots
 */
const SESSION = "session-03";

/** The screens a signed-out visitor can reach. No database required. */
const PUBLIC_SCREENS = [
  { name: "login", path: "/login" },
  { name: "forgot-password", path: "/forgot-password" },
  { name: "reset-password-invalid", path: "/reset-password" },
] as const;

/** Reachable only with a session — or, for two-factor, mid-challenge. */
const PRIVATE_SCREENS = [
  { name: "dashboard", path: "/dashboard" },
  { name: "tasks", path: "/tasks" },
  { name: "settings-roles", path: "/settings/roles" },
  { name: "settings-permissions", path: "/settings/permissions" },
] as const;

async function shoot(
  page: import("@playwright/test").Page,
  name: string,
  locale: string,
  project: string,
) {
  await page.waitForLoadState("networkidle");
  await page.screenshot({
    path: `docs/screenshots/${SESSION}/${name}-${locale}-${project}.png`,
    fullPage: true,
  });
}

for (const locale of ["ar", "en"] as const) {
  for (const screen of PUBLIC_SCREENS) {
    test(`${screen.name} · ${locale}`, async ({ page }, testInfo) => {
      await page.goto(`/${locale}${screen.path}`);
      await shoot(page, screen.name, locale, testInfo.project.name);
    });
  }

  test(`two-factor · ${locale}`, async ({ page }, testInfo) => {
    const reason = databaseMissingReason();
    test.skip(reason !== false, reason || "");

    // The screen only exists mid-challenge, so it has to be reached by signing
    // in and stopping there rather than by navigating to it.
    await submitCredentials(page, SEEDED.manager, undefined, { locale });
    await shoot(page, "two-factor", locale, testInfo.project.name);
  });

  for (const screen of PRIVATE_SCREENS) {
    test(`${screen.name} · ${locale}`, async ({ page }, testInfo) => {
      const reason = databaseMissingReason();
      test.skip(reason !== false, reason || "");

      await signIn(page, SEEDED.manager);
      await page.goto(`/${locale}${screen.path}`);
      await shoot(page, screen.name, locale, testInfo.project.name);
    });
  }
}

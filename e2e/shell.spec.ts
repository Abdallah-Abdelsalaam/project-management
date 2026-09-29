import { expect, test, type Page } from "@playwright/test";
import { databaseMissingReason, SEEDED, signIn } from "./fixtures/auth";

/**
 * The app shell, from session 1 — now behind the route guard.
 *
 * Every assertion here is about a page inside `(app)`, so each one needs a
 * signed-in session. That is the session-2 change to this file: the shell has
 * not changed, but reaching it now requires authentication, so the whole suite
 * skips without a database rather than asserting against a redirect to /login.
 *
 * The signed-in user is the **manager**, deliberately: an agent's landing page is
 * `/my-work` and several nav groups are gated away from them, so a manager is
 * the account that makes the whole shell reviewable — the same reason session 1
 * hard-coded that role.
 */

const LOCALES = [
  { locale: "ar", dir: "rtl", heading: "لوحة التحكم", navLabel: "التنقل الرئيسي" },
  { locale: "en", dir: "ltr", heading: "Dashboard", navLabel: "Main navigation" },
] as const;

test.skip(() => databaseMissingReason() !== false, "the shell is behind the route guard");

/**
 * Below 768px the sidebar is an off-canvas drawer, so the nav has to be
 * opened first. Above it the nav is already inline.
 */
async function openNav(page: Page, navLabel: string) {
  const nav = page.getByRole("navigation", { name: navLabel });
  if (!(await nav.isVisible())) {
    await page.getByRole("button", { name: /فتح القائمة|Open menu/ }).click();
    await expect(nav).toBeVisible();
  }
  return nav;
}

test.beforeEach(async ({ page }) => {
  await signIn(page, SEEDED.manager);
});

for (const { locale, dir, heading, navLabel } of LOCALES) {
  test(`dashboard renders in ${locale} with dir=${dir}`, async ({ page }) => {
    await page.goto(`/${locale}/dashboard`);

    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.locator("html")).toHaveAttribute("dir", dir);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
  });

  test(`skip link is the first focusable element in ${locale}`, async ({ page }) => {
    await page.goto(`/${locale}/dashboard`);
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toHaveClass(/skip-link/);
  });

  test(`navigation is reachable in ${locale}`, async ({ page }) => {
    await page.goto(`/${locale}/dashboard`);
    const nav = await openNav(page, navLabel);
    await expect(nav.getByRole("link")).not.toHaveCount(0);
  });
}

test("locale root redirects to the dashboard", async ({ page }) => {
  await page.goto("/ar");
  await expect(page).toHaveURL(/\/ar\/dashboard$/);
});

test("every sidebar link resolves", async ({ page }) => {
  await page.goto("/ar/dashboard");
  const nav = await openNav(page, "التنقل الرئيسي");
  const hrefs = await nav
    .getByRole("link")
    .evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));

  expect(hrefs.length).toBeGreaterThan(10);

  for (const href of hrefs) {
    const response = await page.request.get(href);
    expect(response.status(), `${href} should resolve`).toBeLessThan(400);
  }
});

test("the drawer closes on Escape", async ({ page, viewport }) => {
  test.skip((viewport?.width ?? 0) >= 768, "The drawer only exists below 768px.");

  await page.goto("/ar/dashboard");
  await page.getByRole("button", { name: "فتح القائمة" }).click();

  const drawer = page.getByRole("dialog", { name: "التنقل الرئيسي" });
  await expect(drawer).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
});

test("signing out returns to the login screen and re-arms the guard", async ({ page }) => {
  await page.goto("/ar/dashboard");
  await page.getByRole("button", { name: "تسجيل الخروج" }).click();
  await expect(page).toHaveURL(/\/ar\/login/);

  await page.goto("/ar/dashboard");
  await expect(page).toHaveURL(/\/ar\/login/);
});

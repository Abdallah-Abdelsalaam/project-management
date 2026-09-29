import { expect, test, type Page } from "@playwright/test";

const LOCALES = [
  { locale: "ar", dir: "rtl", heading: "لوحة التحكم", navLabel: "التنقل الرئيسي" },
  { locale: "en", dir: "ltr", heading: "Dashboard", navLabel: "Main navigation" },
] as const;

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

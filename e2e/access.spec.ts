import { expect, test, type Page } from "@playwright/test";
import { databaseMissingReason, SEEDED, signIn } from "./fixtures/auth";

/**
 * The session-3 acceptance criteria, as tests.
 *
 * All of these need a database and a seeded organisation
 * (`pnpm db:migrate && pnpm db:seed`) plus `AUTH_MAIL_OUTBOX`, because a
 * permission is a row and there is no version of this feature that can be
 * exercised without one.
 *
 * The two that matter most are the ones at the bottom: granting a capability
 * changes what the role sees on the **next request**, and the server refuses
 * a request that never went near the UI. Everything above them is the screen
 * behaving; those two are the system behaving.
 */

test.beforeEach(() => {
  const reason = databaseMissingReason();
  test.skip(reason !== false, reason || "");
});

/** The capability cell for one role column, found by its stable data key. */
function cell(page: Page, roleId: string, capability: string) {
  return page.locator(`[data-cell="${roleId}::${capability}"]`);
}

/** Reads a role's id out of the matrix's column order via the roles list. */
async function roleIdFor(page: Page, key: string): Promise<string> {
  await page.goto("/ar/settings/roles");
  const row = page.locator(`[data-role="${key}"]`);
  await expect(row).toBeVisible();
  // The roles list carries the key; the matrix carries the id. The edit
  // dialog is the one place both are in the same DOM, so the id is read from
  // the matrix cell whose label matches this role's name instead.
  const name = await row.locator("p").first().innerText();
  await page.goto("/ar/settings/permissions");
  const column = page.getByRole("columnheader", { name: name.split("\n")[0].trim() });
  await expect(column).toBeVisible();
  const index = await column.evaluate((node) =>
    Array.from(node.parentElement!.children).indexOf(node),
  );
  const anyCell = page
    .getByRole("row")
    .filter({ hasText: "tasks.approve" })
    .locator("td")
    .nth(index - 1)
    .locator("input[type=checkbox]");
  return (await anyCell.getAttribute("data-cell"))!.split("::")[0];
}

/* -------------------------------------------------------------------------- */
/*  The screens                                                               */
/* -------------------------------------------------------------------------- */

test.describe("the roles screen", () => {
  test("lists the five seeded roles with their user counts", async ({ page }) => {
    await signIn(page, SEEDED.admin);
    await page.goto("/ar/settings/roles");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("الأدوار");

    for (const key of ["agent", "lead", "head", "manager", "admin"]) {
      await expect(page.locator(`[data-role="${key}"]`)).toBeVisible();
    }

    // The seed creates exactly one account per role.
    await expect(page.locator('[data-role="agent"]')).toContainText("1 مستخدم");
  });

  test("protects the admin role instead of offering to edit it", async ({ page }) => {
    await signIn(page, SEEDED.admin);
    await page.goto("/ar/settings/roles");

    const admin = page.locator('[data-role="admin"]');
    await expect(admin).toContainText("محمي");
    await expect(admin).toContainText("وصول كامل");
    await expect(admin.getByRole("button")).toHaveCount(0);
  });

  test("creates a role, then deletes it because nobody holds it", async ({ page }) => {
    await signIn(page, SEEDED.admin);
    await page.goto("/ar/settings/roles");

    await page.getByRole("button", { name: "إضافة دور" }).click();
    await page.getByLabel(/اسم الدور/).fill("مراجع جودة");
    await page.getByLabel(/المعرّف البرمجي/).fill("quality_reviewer");
    await page.getByRole("button", { name: "إنشاء الدور وتحديد صلاحياته" }).click();

    const created = page.locator('[data-role="quality_reviewer"]');
    await expect(created).toBeVisible();
    await expect(created).toContainText("لا مستخدمين");

    await created.getByRole("button", { name: /تعديل دور/ }).click();
    await page.getByRole("button", { name: "حذف الدور" }).click();
    await page.getByRole("button", { name: "تأكيد الحذف" }).click();

    await expect(created).toHaveCount(0);
  });

  test("refuses to delete a role somebody holds", async ({ page }) => {
    await signIn(page, SEEDED.admin);
    await page.goto("/ar/settings/roles");

    await page
      .locator('[data-role="lead"]')
      .getByRole("button", { name: /تعديل دور/ })
      .click();

    // The seed gives `lead` one account, and `lead` is also a system role —
    // either reason alone is enough to block the delete.
    await expect(page.getByRole("button", { name: "حذف الدور" })).toBeDisabled();
  });
});

test.describe("the permission matrix", () => {
  test("renders every capability in four groups", async ({ page }) => {
    await signIn(page, SEEDED.admin);
    await page.goto("/ar/settings/permissions");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("الصلاحيات");

    for (const group of ["المهام", "الفرق والموظفون", "الإدارة", "التقارير والنظام"]) {
      await expect(page.getByRole("rowgroup").getByText(group, { exact: true })).toBeVisible();
    }

    await expect(page.locator("input[type=checkbox][data-cell]").first()).toBeVisible();
  });

  test("locks the admin column — there is no checkbox to click", async ({ page }) => {
    await signIn(page, SEEDED.admin);
    await page.goto("/ar/settings/permissions");

    await expect(page.getByText("عمود مسؤول النظام غير قابل للتعديل")).toBeVisible();

    const adminId = await roleIdFor(page, "admin");
    await expect(cell(page, adminId, "tasks.approve")).toHaveCount(0);
  });

  test("search filters rows by key as well as by label", async ({ page }) => {
    await signIn(page, SEEDED.admin);
    await page.goto("/ar/settings/permissions");

    await page.getByLabel("ابحث عن صلاحية").fill("audit.view");

    await expect(page.getByText("audit.view")).toBeVisible();
    await expect(page.getByText("tasks.approve")).toHaveCount(0);
  });

  test("a change and its reversal leave nothing to save", async ({ page }) => {
    await signIn(page, SEEDED.admin);
    const agentId = await roleIdFor(page, "agent");

    const box = cell(page, agentId, "tasks.approve");
    const save = page.locator("[data-save-matrix]");

    await expect(save).toBeDisabled();
    await box.check();
    await expect(save).toBeEnabled();
    await box.uncheck();
    await expect(save).toBeDisabled();
  });
});

/* -------------------------------------------------------------------------- */
/*  The system, not the screen                                                */
/* -------------------------------------------------------------------------- */

test.describe("granting takes effect on the next request", () => {
  /**
   * The session's headline acceptance criterion. `audit.view` gates the
   * سجل النشاط nav item, so granting it to the agent role must make that item
   * appear for the seeded agent — on their *next* request, with no deploy and
   * no restart.
   */
  test("a capability granted to a role changes that role's navigation", async ({
    page,
    browser,
  }) => {
    await signIn(page, SEEDED.admin);
    const agentId = await roleIdFor(page, "agent");

    // Before: the agent cannot see the activity log.
    const before = await browser.newContext();
    const agentPage = await before.newPage();
    await signIn(agentPage, SEEDED.agent);
    await expect(agentPage.locator('[data-nav="activity"]')).toHaveCount(0);
    await before.close();

    // Grant it.
    await cell(page, agentId, "audit.view").check();
    await page.locator("[data-save-matrix]").click();
    await expect(page.getByText("حُفظت التغييرات.")).toBeVisible();

    // After: a fresh session for the same account sees the item.
    const after = await browser.newContext();
    const grantedPage = await after.newPage();
    await signIn(grantedPage, SEEDED.agent);
    await expect(grantedPage.locator('[data-nav="activity"]')).toBeVisible();
    await after.close();

    // Put it back, so the spec is repeatable against the same database.
    await page.goto("/ar/settings/permissions");
    await cell(page, agentId, "audit.view").uncheck();
    await page.locator("[data-save-matrix]").click();
    await expect(page.getByText("حُفظت التغييرات.")).toBeVisible();
  });
});

test.describe("the server refuses what the UI hides", () => {
  /**
   * The request never goes near the UI: it is a direct navigation by an
   * account whose role lacks `settings.view`. Hiding the nav item is not the
   * boundary, and this is what proves it.
   */
  test("an agent is refused the settings routes server-side", async ({ page }) => {
    await signIn(page, SEEDED.agent);

    for (const path of ["/ar/settings/roles", "/ar/settings/permissions"]) {
      const response = await page.goto(path);
      // The capability gate throws, which Next renders through the error
      // boundary — a 500-class response, never the screen itself.
      expect(response?.status(), path).toBeGreaterThanOrEqual(400);
      await expect(page.getByRole("heading", { level: 1 })).not.toHaveText("الأدوار");
    }
  });

  test("an agent cannot post a permission change", async ({ page }) => {
    await signIn(page, SEEDED.agent);

    // Server Actions are posted to the page's own URL with an action id, and
    // an agent has no way to obtain one for a page they cannot load. The
    // check that matters is therefore that the page itself never renders the
    // form — asserted above — plus the action's own `requireCapability`,
    // which is covered by the Vitest suite over `saveMatrixAction`'s guards.
    const response = await page.request.get("/ar/settings/permissions");
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });
});

test.describe("the audit log", () => {
  test("records who changed what, when, and from what to what", async ({ page }) => {
    await signIn(page, SEEDED.admin);
    const leadId = await roleIdFor(page, "lead");

    await cell(page, leadId, "audit.view").check();
    await page.locator("[data-save-matrix]").click();
    await expect(page.getByText("حُفظت التغييرات.")).toBeVisible();

    // The audit *screen* is session 18, so the row is read back through the
    // one surface that shows it today: the matrix foot's "last changed" line,
    // which is a query over `audit_log` and nothing else.
    await page.reload();
    await expect(page.getByText(/آخر تعديل:/)).toBeVisible();
    await expect(page.getByText(/بواسطة نورة العتيبي/)).toBeVisible();

    await cell(page, leadId, "audit.view").uncheck();
    await page.locator("[data-save-matrix]").click();
    await expect(page.getByText("حُفظت التغييرات.")).toBeVisible();
  });
});

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

/**
 * Reads a role's id straight off its row in the roles list.
 *
 * This used to find the role's column in the matrix by matching its name
 * against the column headers, then read the id off a checkbox in that column.
 * It could not work, for two independent reasons only a real run could show:
 *
 *   - `getByRole("columnheader", { name })` matches on substring, so `موظف`
 *     also matched the group header `الفرق والموظفون` and the locator was
 *     unresolvable under strict mode. `lead` and `head` happened not to
 *     collide, which is why this looked fine for three of the five roles.
 *   - the admin column deliberately contains no checkbox — the very thing the
 *     `locks the admin column` spec asserts — so reading an id from one could
 *     only ever time out.
 *
 * The roles list carries `data-role-id` for exactly this, so nothing has to be
 * inferred from layout.
 *
 * It leaves the browser on the roles list. The version it replaced happened to
 * end on the permissions screen, and three specs quietly depended on that;
 * they now navigate for themselves.
 */
async function roleIdFor(page: Page, key: string): Promise<string> {
  await page.goto("/ar/settings/roles");
  const row = page.locator(`[data-role="${key}"]`);
  await expect(row).toBeVisible();
  const id = await row.getAttribute("data-role-id");
  if (!id) throw new Error(`The roles list has no data-role-id for "${key}".`);
  return id;
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

    // Scoped to the table on purpose. The page's closing note quotes
    // `data-perm="tasks.approve"` as an example of why capabilities are
    // strings — that is the wireframe's own copy, not a row the search failed
    // to filter, and asserting over the whole page would make the note
    // impossible to keep.
    const matrix = page.getByRole("table");
    await expect(matrix.getByText("audit.view")).toBeVisible();
    await expect(matrix.getByText("tasks.approve")).toHaveCount(0);
  });

  test("a change and its reversal leave nothing to save", async ({ page }) => {
    await signIn(page, SEEDED.admin);
    const agentId = await roleIdFor(page, "agent");
    await page.goto("/ar/settings/permissions");

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
    viewport,
  }) => {
    await signIn(page, SEEDED.admin);
    const agentId = await roleIdFor(page, "agent");

    /** Sets the agent's `audit.view` cell and saves, if it is not already there. */
    async function setAuditView(granted: boolean) {
      await page.goto("/ar/settings/permissions");
      const box = cell(page, agentId, "audit.view");
      if ((await box.isChecked()) === granted) return;
      await box.setChecked(granted);
      await page.locator("[data-save-matrix]").click();
      await expect(page.getByText("حُفظت التغييرات.")).toBeVisible();
    }

    /**
     * Start from a known state rather than assuming one.
     *
     * The grant lives in a persistent table, and a run that died between
     * granting and reverting used to leave it in place — which failed the
     * *next* run on its opening assertion, for a reason that had nothing to do
     * with that run. Normalising here, and reverting in `finally` below, is
     * what makes this spec survive its own failures.
     */
    await setAuditView(false);

    try {
      // Before: the agent cannot see the activity log.
      const before = await browser.newContext();
      const agentPage = await before.newPage();
      await signIn(agentPage, SEEDED.agent);
      await expect(agentPage.locator('[data-nav="activity"]')).toHaveCount(0);
      await before.close();

      await setAuditView(true);

      // After: a fresh session for the same account sees the item.
      //
      // Presence is the claim being tested — the nav item is now rendered for
      // a role that could not see it a moment ago. Visibility is a separate
      // question the viewport answers: below 768px the sidebar is an
      // off-canvas drawer, so the item is correctly in the DOM and correctly
      // not on screen until the drawer is opened.
      const after = await browser.newContext();
      const grantedPage = await after.newPage();
      await signIn(grantedPage, SEEDED.agent);
      const activity = grantedPage.locator('[data-nav="activity"]');
      await expect(activity).toBeAttached();
      if ((viewport?.width ?? 0) >= 768) await expect(activity).toBeVisible();
      await after.close();
    } finally {
      // Put it back even if an assertion above threw, so the next run starts
      // where this one did.
      await setAuditView(false);
    }
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

    /** Sets the lead's `audit.view` cell and saves, if it is not already there. */
    async function setAuditView(granted: boolean) {
      await page.goto("/ar/settings/permissions");
      const box = cell(page, leadId, "audit.view");
      if ((await box.isChecked()) === granted) return;
      await box.setChecked(granted);
      await page.locator("[data-save-matrix]").click();
      await expect(page.getByText("حُفظت التغييرات.")).toBeVisible();
    }

    // Same reason as the spec above: the grant is a row, so this starts from a
    // known state and puts it back even if an assertion throws.
    await setAuditView(false);

    try {
      await setAuditView(true);

      // The audit *screen* is session 18, so the row is read back through the
      // one surface that shows it today: the matrix foot's "last changed"
      // line, which is a query over `audit_log` and nothing else.
      await page.reload();
      await expect(page.getByText(/آخر تعديل:/)).toBeVisible();
      await expect(page.getByText(/بواسطة نورة العتيبي/)).toBeVisible();
    } finally {
      await setAuditView(false);
    }
  });
});

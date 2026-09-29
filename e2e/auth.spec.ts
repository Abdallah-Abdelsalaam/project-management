import { expect, test } from "@playwright/test";
import {
  databaseMissingReason,
  enterCode,
  latestCode,
  latestResetLink,
  SEEDED,
  SEED_PASSWORD,
  signIn,
  submitCredentials,
} from "./fixtures/auth";

/**
 * The session-2 acceptance criteria, as tests.
 *
 * Everything below the first block needs a database and a seeded organisation
 * (`pnpm db:migrate && pnpm db:seed`) plus `AUTH_MAIL_OUTBOX` pointing at a
 * writable path. Without them the specs skip with a reason rather than failing —
 * see `e2e/fixtures/auth.ts`.
 */

/* -------------------------------------------------------------------------- */
/*  No database needed: the guard and the screens themselves                   */
/* -------------------------------------------------------------------------- */

test.describe("the route guard", () => {
  for (const path of ["/dashboard", "/tasks", "/settings/roles", "/my-work"]) {
    test(`an unauthenticated request to ${path} redirects to /login`, async ({ page }) => {
      await page.goto(`/ar${path}`);
      await expect(page).toHaveURL(/\/ar\/login/);
    });
  }

  test("the sign-in screen itself is reachable", async ({ page }) => {
    await page.goto("/ar/login");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("تسجيل الدخول");
  });
});

test.describe("the auth screens render", () => {
  const SCREENS = [
    { path: "/login", ar: "تسجيل الدخول", en: "Sign in" },
    { path: "/forgot-password", ar: "استعادة كلمة المرور", en: "Recover your password" },
  ] as const;

  for (const screen of SCREENS) {
    test(`${screen.path} in ar is RTL`, async ({ page }) => {
      await page.goto(`/ar${screen.path}`);
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(screen.ar);
    });

    test(`${screen.path} in en is LTR`, async ({ page }) => {
      await page.goto(`/en${screen.path}`);
      await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(screen.en);
    });
  }

  test("reset-password without a token offers a way to get one", async ({ page }) => {
    await page.goto("/ar/reset-password");
    await expect(page.getByText("الرابط غير صالح أو انتهت صلاحيته")).toBeVisible();
    await expect(page.getByRole("link", { name: "طلب رابط جديد" })).toBeVisible();
  });

  test("two-factor without a challenge sends you back to sign in", async ({ page }) => {
    await page.goto("/ar/two-factor");
    await expect(page).toHaveURL(/\/ar\/login/);
  });

  test("the forgot-password confirmation does not reveal whether the address exists", async ({
    page,
  }) => {
    await page.goto("/ar/forgot-password");
    await page.getByLabel("بريد العمل").fill("definitely-not-a-user@nuwa.sa");
    await page.getByRole("button", { name: "إرسال رابط الاستعادة" }).click();

    await expect(page.getByText("تم إرسال الرابط إن كان البريد مسجّلًا")).toBeVisible();
  });
});

/* -------------------------------------------------------------------------- */
/*  The flow                                                                  */
/* -------------------------------------------------------------------------- */

test.describe("sign in", () => {
  test.skip(() => databaseMissingReason() !== false, "needs a database and an outbox");

  test("credentials then a correct code reaches the dashboard", async ({ page }) => {
    const since = Date.now() - 1;
    await submitCredentials(page, SEEDED.manager);
    await expect(page).toHaveURL(/\/two-factor/);

    await enterCode(page, await latestCode(SEEDED.manager, since));

    await expect(page).toHaveURL(/\/ar\/dashboard/);
    await expect(page.getByText("أحمد سالم")).toBeVisible();
  });

  test("an agent lands on their own work, not the dashboard", async ({ page }) => {
    // docs/OPEN_QUESTIONS.md Q12: the dashboard is manager-shaped.
    await signIn(page, SEEDED.agent);
    await expect(page).toHaveURL(/\/ar\/my-work/);
  });

  test("the topbar shows the real signed-in name and role", async ({ page }) => {
    await signIn(page, SEEDED.lead);
    await expect(page.getByText("خالد الدوسري")).toBeVisible();
    await expect(page.getByText("قائد الفريق")).toBeVisible();
  });

  test("a wrong password is refused without saying whether the account exists", async ({
    page,
  }) => {
    await submitCredentials(page, SEEDED.manager, "WrongPassword!1x");

    await expect(page.getByText("بيانات الدخول غير صحيحة")).toBeVisible();
    // The same message an unknown address produces.
    await submitCredentials(page, "nobody@nuwa.sa", "WrongPassword!1x");
    await expect(page.getByText("بيانات الدخول غير صحيحة")).toBeVisible();
  });

  test("a wrong code is its own state, distinct from a wrong password", async ({ page }) => {
    await submitCredentials(page, SEEDED.head);
    await expect(page).toHaveURL(/\/two-factor/);

    await enterCode(page, "000000");
    await expect(page.getByText("الرمز غير صحيح")).toBeVisible();
    await expect(page).toHaveURL(/\/two-factor/);
  });

  test("resend is refused until its cooldown has passed", async ({ page }) => {
    await submitCredentials(page, SEEDED.head);
    await expect(page).toHaveURL(/\/two-factor/);

    // Seeded from the server, so the button is already disabled on first paint.
    await expect(page.getByRole("button", { name: /إعادة الإرسال بعد/ })).toBeDisabled();
  });
});

test.describe("lockout", () => {
  test.skip(() => databaseMissingReason() !== false, "needs a database and an outbox");

  test("locks the account after the configured number of failures", async ({ page }) => {
    // A dedicated address, so the lock does not bleed into the other specs.
    const email = "lockout-target@nuwa.sa";

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await submitCredentials(page, email, "WrongPassword!1x");
      await expect(page.getByRole("alert")).toBeVisible();
    }

    await submitCredentials(page, email, "WrongPassword!1x");
    await expect(page.getByText("الحساب موقوف مؤقتًا")).toBeVisible();
  });
});

test.describe("trusted devices", () => {
  test.skip(() => databaseMissingReason() !== false, "needs a database and an outbox");

  test("a trusted device skips the second factor on the next sign-in", async ({ page }) => {
    await signIn(page, SEEDED.manager, { trust: true });

    // Sign out, then sign in again on the same browser context: the trust
    // cookie survives, so there is no second factor this time.
    await page.getByRole("button", { name: "تسجيل الخروج" }).click();
    await expect(page).toHaveURL(/\/ar\/login/);

    await submitCredentials(page, SEEDED.manager);
    await expect(page).toHaveURL(/\/ar\/dashboard/);
  });

  test("a different browser context is not trusted", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await submitCredentials(page, SEEDED.manager);
    await expect(page).toHaveURL(/\/two-factor/);

    await context.close();
  });
});

test.describe("password reset", () => {
  test.skip(() => databaseMissingReason() !== false, "needs a database and an outbox");

  test("a reset link works exactly once and enforces the policy", async ({ page }) => {
    const email = SEEDED.agent;
    const since = Date.now() - 1;

    await page.goto("/ar/forgot-password");
    await page.getByLabel("بريد العمل").fill(email);
    await page.getByRole("button", { name: "إرسال رابط الاستعادة" }).click();
    await expect(page.getByText("تم إرسال الرابط إن كان البريد مسجّلًا")).toBeVisible();

    const link = await latestResetLink(email, since);
    await page.goto(link);

    // A password that fails the policy is refused, with the failing rows marked.
    await page.locator("#password").fill("short");
    await page.locator("#confirm").fill("short");
    await page.getByRole("button", { name: "حفظ كلمة المرور" }).click();
    await expect(page.locator('[data-pass="false"]').first()).toBeVisible();

    // A compliant password is accepted.
    const next = "Nuwa!Reset2026z";
    await page.locator("#password").fill(next);
    await page.locator("#confirm").fill(next);
    await page.getByRole("button", { name: "حفظ كلمة المرور" }).click();
    await expect(page).toHaveURL(/\/ar\/login/);
    await expect(page.getByText("تم حفظ كلمة المرور الجديدة")).toBeVisible();

    // The same link a second time is refused.
    await page.goto(link);
    await expect(page.getByText("الرابط غير صالح أو انتهت صلاحيته")).toBeVisible();

    // And the new password signs in, which is the proof the reset took effect.
    await page.goto("/ar/login");
    await page.getByLabel("بريد العمل").fill(email);
    await page.locator("#password").fill(next);
    await page.getByRole("button", { name: "متابعة" }).click();
    await expect(page).toHaveURL(/\/two-factor/);
  });

  test("mismatched passwords are caught before the round trip", async ({ page }) => {
    const email = SEEDED.lead;
    const since = Date.now() - 1;

    await page.goto("/ar/forgot-password");
    await page.getByLabel("بريد العمل").fill(email);
    await page.getByRole("button", { name: "إرسال رابط الاستعادة" }).click();

    await page.goto(await latestResetLink(email, since));
    await page.locator("#password").fill(SEED_PASSWORD);
    await page.locator("#confirm").fill(`${SEED_PASSWORD}x`);
    await page.getByRole("button", { name: "حفظ كلمة المرور" }).click();

    await expect(page.getByText("كلمتا المرور غير متطابقتين")).toBeVisible();
  });
});

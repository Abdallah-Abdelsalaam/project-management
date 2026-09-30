import { expect, test, type Page } from "@playwright/test";
import {
  databaseMissingReason,
  SACRIFICIAL,
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

/**
 * The identity the topbar is rendering, asserted at the width it is drawn for.
 *
 * `src/components/shell/topbar.tsx` wraps the name and role in
 * `hidden … sm:flex`, so below 640px the chip is the avatar initials alone and
 * the text is present but not visible. A plain visibility assertion passes on
 * desktop and fails at 390px against a layout behaving exactly as designed —
 * so presence is checked at every width and visibility only where the design
 * shows it.
 */
async function expectSignedInAs(
  page: Page,
  viewport: { width: number; height: number } | null,
  text: string,
) {
  const label = page.getByText(text);
  await expect(label).toBeAttached();
  if ((viewport?.width ?? 0) >= 640) await expect(label).toBeVisible();
}

test.describe("sign in", () => {
  test.skip(() => databaseMissingReason() !== false, "needs a database and an outbox");

  test("credentials then a correct code reaches the dashboard", async ({ page, viewport }) => {
    const since = Date.now() - 1;
    await submitCredentials(page, SEEDED.manager);
    await expect(page).toHaveURL(/\/two-factor/);

    await enterCode(page, await latestCode(SEEDED.manager, since));

    await expect(page).toHaveURL(/\/ar\/dashboard/);
    await expectSignedInAs(page, viewport, "أحمد سالم");
  });

  test("an agent lands on their own work, not the dashboard", async ({ page }) => {
    // docs/OPEN_QUESTIONS.md Q12: the dashboard is manager-shaped.
    await signIn(page, SEEDED.agent);
    await expect(page).toHaveURL(/\/ar\/my-work/);
  });

  test("the topbar shows the real signed-in name and role", async ({ page, viewport }) => {
    await signIn(page, SEEDED.lead);
    await expectSignedInAs(page, viewport, "خالد الدوسري");
    await expectSignedInAs(page, viewport, "قائد الفريق");
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
    const since = Date.now() - 1;
    await submitCredentials(page, SEEDED.head);
    await expect(page).toHaveURL(/\/two-factor/);

    await enterCode(page, "000000");
    await expect(page.getByText("الرمز غير صحيح")).toBeVisible();
    await expect(page).toHaveURL(/\/two-factor/);

    // Then finish with the real code — which is not decoration.
    //
    // The two-factor plugin keeps a per-account budget of five failed
    // verifications in `two_factor.failed_verification_count`, and only a
    // successful verification clears it. Spending one attempt per run and
    // never clearing it meant the fifth run found the account locked out of
    // its second factor, so the screen answered with a lock rather than
    // "الرمز غير صحيح" and this spec failed for a reason it was not testing.
    // Reload before retyping: the six boxes still hold the rejected digits,
    // and `enterCode` types rather than replaces, so without this the second
    // attempt submits the wrong code again.
    await page.reload();
    await enterCode(page, await latestCode(SEEDED.head, since));
    await expect(page).not.toHaveURL(/\/two-factor/);
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
    // A dedicated address, so the lock does not bleed into the other specs —
    // and a *fresh* one per run, because the ledger is a persistent table and
    // the lock it leaves behind would otherwise still be standing next time,
    // failing the first attempt with the message the last assertion expects.
    const email = `lockout-${Date.now()}@nuwa.sa`;

    // Each attempt must be answered before the next is sent. The lockout
    // counts consecutive *committed* failures, so overlapping requests all
    // read a ledger that is still empty and none of them trips the limit.
    //
    // Waiting on `getByRole("alert")` did not do that: the sign-in screen
    // always renders an empty live region, so the locator matched instantly
    // and all six attempts landed inside 650ms. Waiting on the message itself
    // is what makes this sequential.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await submitCredentials(page, email, "WrongPassword!1x");
      await expect(page.getByText("بيانات الدخول غير صحيحة")).toBeVisible();
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
    // Not a shared identity: this spec proves the new password signs in, so it
    // necessarily leaves the account changed. Against a persistent database
    // that would break every later spec that expects SEED_PASSWORD, and the
    // last-five-passwords rule forbids putting the old one back.
    const email = SACRIFICIAL;
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

    // Reload from the link before the second attempt.
    //
    // The rejected submit re-renders the form, and that re-render was landing
    // between the two fills below — clearing `#password` after it had been
    // filled and leaving `#confirm` set, so the form submitted a blank
    // password. The checklist assertion above cannot prevent it: those rows
    // are live as you type, so it is satisfied before the submit is answered.
    await page.goto(link);

    // A compliant password, and a different one on every run — the account is
    // reused, and the policy remembers the last five.
    const next = `Nuwa!R${Date.now()}z`;
    await page.locator("#password").fill(next);
    await page.locator("#confirm").fill(next);
    await expect(page.locator("#password")).toHaveValue(next);
    await expect(page.locator("#confirm")).toHaveValue(next);
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

import { readFile } from "node:fs/promises";
import { expect, type Page } from "@playwright/test";
import { SEED_EMAIL_BY_ROLE, SEED_PASSWORD, SEED_SACRIFICIAL } from "../../src/db/seed-identities";

export { SEED_PASSWORD };

/**
 * Shared sign-in helpers for the E2E suite.
 *
 * ## Why these tests need a database
 *
 * Authentication is not mockable from the browser: the session is a row, the
 * second-factor challenge is a row, and the lockout ledger is a row. A run
 * without `DATABASE_URL` therefore cannot exercise any of it, and every spec
 * that signs in calls `requiresDatabase()` to skip rather than to fail — an
 * unconfigured machine should report "not run", never "broken".
 *
 * ## Why the code comes from a file
 *
 * The code is stored hashed and delivered by email, so nothing readable is left
 * behind for a test to find. `AUTH_MAIL_OUTBOX` (see
 * `src/features/auth/mail.ts`) appends every message to a JSON-lines file, and
 * that is where `latestCode` reads it from.
 */

/**
 * The identities come from the seed itself rather than being repeated here.
 *
 * They used to be repeated, and they drifted: the database was edited to use
 * deliverable addresses and this list was not, so every spec below signed in
 * as an account that did not exist. `src/db/seed-identities.ts` carries the
 * full account of it.
 */
export const SEEDED = SEED_EMAIL_BY_ROLE;

/** The account the destructive password-reset spec is allowed to damage. */
export const SACRIFICIAL = SEED_SACRIFICIAL.email;

export const OUTBOX = process.env.AUTH_MAIL_OUTBOX;

/** The reason string is what Playwright prints, so it explains the gap. */
export function databaseMissingReason(): string | false {
  if (!process.env.DATABASE_URL) {
    return "DATABASE_URL is not set — the auth flow needs a database. See docs/PROGRESS.md session 2.";
  }
  if (!OUTBOX) {
    return "AUTH_MAIL_OUTBOX is not set — the suite cannot read the emailed code.";
  }
  return false;
}

type OutboxMessage = { to: string; subject: string; text: string; at: number };

async function readOutbox(): Promise<OutboxMessage[]> {
  if (!OUTBOX) return [];
  const raw = await readFile(OUTBOX, "utf8").catch(() => "");
  return raw
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as OutboxMessage);
}

/**
 * The newest code sent to `email`.
 *
 * Polls, because the send happens in the request that produced the redirect and
 * the file write may land a moment after the navigation settles. `since` lets a
 * resend test wait for a *new* code rather than matching the one already there.
 */
export async function latestCode(email: string, since = 0): Promise<string> {
  const deadline = Date.now() + 10_000;

  while (Date.now() < deadline) {
    const messages = await readOutbox();
    const match = messages
      .filter((message) => message.to === email && message.at > since)
      .filter((message) => /\d{6}/.test(message.subject))
      .at(-1);

    if (match) {
      const code = match.subject.match(/(\d{6})/)?.[1];
      if (code) return code;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`No verification code for ${email} appeared in the outbox.`);
}

/** The newest reset link sent to `email`. */
export async function latestResetLink(email: string, since = 0): Promise<string> {
  const deadline = Date.now() + 10_000;

  while (Date.now() < deadline) {
    const messages = await readOutbox();
    const match = messages
      .filter((message) => message.to === email && message.at > since)
      .map((message) => message.text.match(/https?:\/\/\S+/)?.[0])
      .filter((url): url is string => Boolean(url))
      .at(-1);

    if (match) return match;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`No reset link for ${email} appeared in the outbox.`);
}

/**
 * The two strings the sign-in form is driven by, per locale.
 *
 * `messages/{ar,en}.json` own them; they are repeated here because a test that
 * imported the message files would assert the app against itself and pass
 * however the copy was mangled.
 */
const LOGIN_COPY = {
  ar: { email: "بريد العمل", submit: "متابعة" },
  en: { email: "Work email", submit: "Continue" },
} as const;

export type TestLocale = keyof typeof LOGIN_COPY;

/**
 * Fills and submits the sign-in form. Does not assume where it lands.
 *
 * `locale` matters for more than copy: the two-factor screen is only reachable
 * mid-challenge, so it can be screenshotted in English only by starting the
 * challenge in English. Signing in through `/ar/login` and navigating
 * afterwards works for every *other* screen and silently does not for that one.
 */
export async function submitCredentials(
  page: Page,
  email: string,
  password = SEED_PASSWORD,
  { trust = false, locale = "ar" }: { trust?: boolean; locale?: TestLocale } = {},
) {
  const copy = LOGIN_COPY[locale];
  await page.goto(`/${locale}/login`);
  await page.getByLabel(copy.email).fill(email);
  await page.locator("#password").fill(password);
  if (trust) {
    await page.getByRole("checkbox").check();
  }
  await page.getByRole("button", { name: copy.submit }).click();
}

/** Types a code into the six boxes by pasting into the first. */
export async function enterCode(page: Page, code: string) {
  const first = page.getByLabel("الرقم 1");
  await first.click();
  // One character per box; typing into the first auto-advances.
  for (const digit of code) {
    await page.keyboard.type(digit);
  }
  await page.getByRole("button", { name: "تأكيد الرمز" }).click();
}

/** The whole happy path: credentials, then the emailed code. */
export async function signIn(
  page: Page,
  email: string = SEEDED.manager,
  { trust = false }: { trust?: boolean } = {},
) {
  const since = Date.now() - 1;
  await submitCredentials(page, email, SEED_PASSWORD, { trust });
  await expect(page).toHaveURL(/\/two-factor/);
  await enterCode(page, await latestCode(email, since));
  await expect(page).not.toHaveURL(/\/two-factor/);
}

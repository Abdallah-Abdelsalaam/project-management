import { readFile } from "node:fs/promises";
import { expect, type Page } from "@playwright/test";

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

export const SEED_PASSWORD = process.env.SEED_PASSWORD ?? "Nuwa!Ops2026x";

export const SEEDED = {
  admin: "n.alotaibi@nuwa.sa",
  manager: "a.salem@nuwa.sa",
  head: "r.alqahtani@nuwa.sa",
  lead: "k.aldosari@nuwa.sa",
  agent: "s.alharbi@nuwa.sa",
} as const;

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

/** Fills and submits the sign-in form. Does not assume where it lands. */
export async function submitCredentials(
  page: Page,
  email: string,
  password = SEED_PASSWORD,
  { trust = false }: { trust?: boolean } = {},
) {
  await page.goto("/ar/login");
  await page.getByLabel("بريد العمل").fill(email);
  await page.locator("#password").fill(password);
  if (trust) {
    await page.getByRole("checkbox").check();
  }
  await page.getByRole("button", { name: "متابعة" }).click();
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

import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

/**
 * `.env.local` is loaded here, before anything reads `process.env`.
 *
 * Without this the suite looked configured and was not. `databaseMissingReason()`
 * runs in the Playwright process, which Next never boots, so `DATABASE_URL`
 * was absent no matter what `.env.local` said — and every database-backed spec
 * reported **skipped**, which reads like "not applicable here" rather than
 * "this never ran". Fifty-eight specs stayed unexecuted across three sessions
 * behind that one missing line. `dotenv` does not overwrite a variable that is
 * already set, so CI still wins.
 */
config({ path: ".env.local", quiet: true });

/**
 * The suite runs against `DATABASE_URL_TEST` when one exists.
 *
 * It has to. These specs create and delete roles, toggle permissions, write
 * audit rows, trip the lockout ledger and change an account's password — and
 * the deployed app at https://pm.apqrinu-co.com serves from `DATABASE_URL`.
 * Pointing a destructive suite at the database a live app is reading is not a
 * risk to manage, it is a mistake to design out.
 */
const databaseUrl = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;

/**
 * The browser and the app must agree on the origin, or authentication breaks
 * in a way that looks like nothing to do with the origin.
 *
 * Better Auth signs and scopes its cookies against `BETTER_AUTH_URL` and
 * checks the request's origin against it. Browsing `127.0.0.1:3000` while the
 * app believes it is `localhost:3000` means the second-factor cookie set by
 * `signInEmail` is rejected on the very next call, and the failure surfaces as
 * `APIError: Invalid two factor cookie` on the *login* screen — a message that
 * names the cookie and not the mismatch that caused it.
 *
 * So the default follows `BETTER_AUTH_URL` rather than hard-coding a host.
 * `PLAYWRIGHT_BASE_URL` still wins, for pointing the suite at a deploy.
 */
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ?? process.env.BETTER_AUTH_URL ?? "http://127.0.0.1:3000";

/**
 * Two viewports in both directions — the /end-session protocol screenshots
 * every touched screen at 1440px and 390px, in AR and EN.
 *
 * The readiness URL is `/ar/login`, not `/ar/dashboard`: since session 2 the
 * dashboard is behind the route guard, so waiting on it would wait on a
 * redirect. The login screen is the one page a signed-out visitor is meant to
 * get, which makes it the right health check.
 *
 * Specs that sign in need `DATABASE_URL`, a seeded organisation and
 * `AUTH_MAIL_OUTBOX`; they skip with a reason when those are absent. See
 * `e2e/fixtures/auth.ts`.
 */
export default defineConfig({
  testDir: "./e2e",

  /**
   * Serial, deliberately, and this is not a performance oversight.
   *
   * The suite shares five seeded identities, and almost everything
   * authentication owns is global per account rather than per browser context:
   * the lockout ledger counts consecutive failures, a reset consumes a
   * single-use token, `password_history` remembers the last five, and
   * `AUTH_MAIL_OUTBOX` is keyed by address alone — so two tests signing in as
   * the same person at the same time can read each other's verification code.
   * Run in parallel this suite is not slow, it is wrong.
   *
   * Making it parallel again means one identity set per worker, not more
   * workers.
   */
  fullyParallel: false,
  workers: 1,

  /**
   * 10s, not Playwright's 5s.
   *
   * Every assertion that waits on a page here is waiting on a round trip to a
   * MySQL instance in Frankfurt, and a sign-in adds a scrypt verify and a mail
   * write on top. Submissions were being caught mid-flight — the button still
   * reading "جارٍ التحقق…" and disabled when the assertion gave up — which is
   * latency reported as a product failure.
   *
   * This raises the ceiling on waiting; it does not slow a passing run, since
   * every `expect` resolves as soon as its condition holds.
   */
  expect: { timeout: 10_000 },

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: {
    command: "pnpm build && pnpm start",
    url: new URL("/ar/login", baseURL).toString(),
    /**
     * Never reused, even locally.
     *
     * A server already listening on the port was started with whatever
     * environment it was started with — and that silently cost this suite a
     * full run against the production database, because the reused process
     * predated `DATABASE_URL_TEST`. A suite that decides which database it
     * writes to by whatever happens to be listening is not isolated at all.
     * The price is one build per run.
     */
    reuseExistingServer: false,
    timeout: 180_000,
    /**
     * Passed explicitly rather than inherited: the server must read the same
     * database the specs assert against, and `.env.local` would otherwise hand
     * it the production one.
     */
    env: databaseUrl ? { DATABASE_URL: databaseUrl } : {},
  },
});

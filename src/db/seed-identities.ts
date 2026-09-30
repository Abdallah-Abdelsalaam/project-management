import { type RoleKey } from "@/lib/permissions";

/**
 * Who the seed creates — the one place the E2E suite and `pnpm db:seed` agree
 * on.
 *
 * ## Why this file exists
 *
 * Until session 3 closed, `e2e/fixtures/auth.ts` re-declared these five
 * addresses rather than importing them. The deployed database was then edited
 * by hand to use real, deliverable addresses so a live 2FA code could actually
 * be received while probing the deploy, and nothing connected the two lists.
 * The suite went on signing in as accounts that no longer existed: every
 * attempt was an unknown address, five of them tripped the lockout, and the
 * failure read as "الحساب موقوف مؤقتًا" rather than "this address is wrong".
 *
 * One exported list, imported by both, is what stops that recurring.
 *
 * ## Overriding the addresses
 *
 * The committed defaults are fabricated `@nuwa.sa` addresses. They are
 * deliberately undeliverable — the suite reads codes from `AUTH_MAIL_OUTBOX`
 * and never needs mail to arrive, and a real send to a fabricated address is a
 * hard bounce against the sending domain's reputation.
 *
 * A deployment that *does* need to receive mail (to sign in to the deployed
 * app by hand) sets `SEED_EMAIL_PATTERN`, where `{slot}` is replaced by the
 * role key, or by the slot name for the accounts below that have no role of
 * their own:
 *
 *     SEED_EMAIL_PATTERN="someone+{slot}@gmail.com"
 *
 * Set it in `.env.local` and both the seed and the suite follow it together.
 */

export const SEED_PASSWORD = process.env.SEED_PASSWORD ?? "Nuwa!Ops2026x";

/** `{slot}` → the role key, or the sacrificial account's name. */
function seedEmail(slot: string, fallback: string): string {
  const pattern = process.env.SEED_EMAIL_PATTERN;
  return (pattern ? pattern.replace("{slot}", slot) : fallback).toLowerCase();
}

export type SeedPerson = {
  /** The slot name: a role key, or a label for an account with no role of its own. */
  slot: string;
  role: RoleKey;
  name: string;
  email: string;
};

/**
 * One account per role. The names are the wireframe's own — `أحمد سالم` is the
 * manager the topbar renders in `wireframe/pages/dashboard.html`, so a seeded
 * manager reproduces that screen exactly.
 */
export const SEED_PEOPLE: ReadonlyArray<SeedPerson> = [
  {
    slot: "admin",
    role: "admin",
    name: "نورة العتيبي",
    email: seedEmail("admin", "n.alotaibi@nuwa.sa"),
  },
  {
    slot: "manager",
    role: "manager",
    name: "أحمد سالم",
    email: seedEmail("manager", "a.salem@nuwa.sa"),
  },
  {
    slot: "head",
    role: "head",
    name: "ريم القحطاني",
    email: seedEmail("head", "r.alqahtani@nuwa.sa"),
  },
  {
    slot: "lead",
    role: "lead",
    name: "خالد الدوسري",
    email: seedEmail("lead", "k.aldosari@nuwa.sa"),
  },
  {
    slot: "agent",
    role: "agent",
    name: "سارة الحربي",
    email: seedEmail("agent", "s.alharbi@nuwa.sa"),
  },
];

/**
 * An account the E2E suite is allowed to damage.
 *
 * The password-reset spec proves a reset link works exactly once *and that the
 * new password signs in* — which means it necessarily leaves the account with
 * a different password than it started with. Against a throwaway database that
 * is free; against a persistent one it breaks the next run, because
 * `SEED_PASSWORD` no longer opens the account and the last-five-passwords rule
 * forbids putting it back.
 *
 * So the destructive spec gets its own account and the five above stay intact.
 *
 * It holds `lead` rather than `agent` on purpose: `e2e/access.spec.ts` asserts
 * that the `agent` role has exactly one holder, and a sixth account must not
 * quietly change a number a test is reading.
 */
export const SEED_SACRIFICIAL: SeedPerson = {
  slot: "reset",
  role: "lead",
  name: "حساب اختبار الاستعادة",
  email: seedEmail("reset", "e2e-reset@nuwa.sa"),
};

/** Everyone the seed creates, in insertion order. */
export const SEED_ACCOUNTS: ReadonlyArray<SeedPerson> = [...SEED_PEOPLE, SEED_SACRIFICIAL];

/** The five addresses by role, which is how both the seed and the suite ask for one. */
export const SEED_EMAIL_BY_ROLE = Object.fromEntries(
  SEED_PEOPLE.map((person) => [person.role, person.email]),
) as Record<RoleKey, string>;

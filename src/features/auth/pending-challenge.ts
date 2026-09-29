import { cookies } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { user, verification } from "@/db/schema";

/**
 * The half-authenticated state behind `/two-factor`.
 *
 * Better Auth's sign-in leaves a signed cookie holding a `verification`
 * identifier whose value is the user id. The screen needs that user's email —
 * "أرسلنا رمزًا من ستة أرقام إلى a.salem@nuwa.sa" — and needs to know the
 * challenge is still alive before rendering a form that cannot succeed.
 *
 * Reading the cookie here rather than calling an endpoint is deliberate: there
 * is no Better Auth endpoint that answers "who is mid-challenge", and inventing
 * one would mean an unauthenticated route that maps a cookie to an email
 * address. This stays on the server, in the page that already needs it.
 *
 * Note what this is **not**: it is not an authorisation check. Knowing the email
 * behind a challenge grants nothing — the code still has to be right, and
 * `verifyTwoFactorOTP` re-reads and re-validates the same cookie itself.
 */

export type PendingChallenge = {
  userId: string;
  email: string;
  name: string;
  expiresAt: Date;
};

/**
 * Better Auth signs the cookie as `<value>.<signature>`. Only the value is
 * needed, and using it to *look up* a row rather than to trust a claim is why
 * the signature does not have to be verified here: a forged identifier finds no
 * row, and a real one reveals only what the legitimate holder of the cookie
 * would see anyway.
 */
function unsign(value: string | undefined): string | null {
  if (!value) return null;
  const identifier = value.includes(".") ? value.slice(0, value.lastIndexOf(".")) : value;
  return identifier.startsWith("2fa-") ? identifier : null;
}

export async function pendingChallenge(): Promise<PendingChallenge | null> {
  const jar = await cookies();

  // The cookie name carries Better Auth's prefix and, over HTTPS, a
  // `__Secure-` prefix on top of it — so it is matched by suffix.
  const raw = jar.getAll().find((cookie) => cookie.name.endsWith("two_factor"))?.value;
  const identifier = unsign(raw);
  if (!identifier) return null;

  // Fail closed, for the same reason `currentSession` does: "cannot tell" has
  // to mean "no challenge", so the screen sends the visitor back to /login
  // rather than rendering a form that cannot succeed.
  try {
    const [challenge] = await db()
      .select({ value: verification.value, expiresAt: verification.expiresAt })
      .from(verification)
      .where(and(eq(verification.identifier, identifier), gt(verification.expiresAt, new Date())))
      .limit(1);

    if (!challenge) return null;

    const [account] = await db()
      .select({ id: user.id, email: user.email, name: user.name })
      .from(user)
      .where(eq(user.id, challenge.value))
      .limit(1);

    if (!account) return null;

    return {
      userId: account.id,
      email: account.email,
      name: account.name,
      expiresAt: challenge.expiresAt,
    };
  } catch (error) {
    console.error("[auth] could not read the pending challenge:", error);
    return null;
  }
}

/**
 * Masks an address for display: `a.salem@nuwa.sa` → `a.s•••@nuwa.sa`.
 *
 * The wireframe shows the address in full, and this is available for the screens
 * that should not. It is exported from here rather than inlined so there is one
 * masking rule if the answer to that question ever changes.
 */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at);
  if (local.length <= 3) return `${local[0] ?? ""}•••${domain}`;
  return `${local.slice(0, 3)}•••${domain}`;
}

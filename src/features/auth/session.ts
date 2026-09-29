import { headers } from "next/headers";
import { redirectLocale } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { securityPolicy } from "@/lib/policy";
import { ROLE_KEYS, type Capability, type RoleKey, can } from "@/lib/permissions";
import type { Locale } from "@/i18n/routing";

/**
 * Resolving who is asking.
 *
 * This is the only place in the application that answers that question. The
 * shell takes the identity as a prop and no component decides it for itself —
 * which is what makes the topbar and the sidebar impossible to disagree with
 * the server.
 */

export type SignedInUser = {
  id: string;
  name: string;
  email: string;
  role: RoleKey;
  /** Two letters for the topbar chip, derived rather than stored. */
  initials: string;
};

export type ResolvedSession = {
  user: SignedInUser;
  sessionId: string;
  expiresAt: Date;
};

/**
 * The first letter of each of the first two words — "أحمد سالم" → "أ س".
 *
 * Grapheme-aware, because an Arabic name may begin with a combining mark and
 * `name[0]` would slice it in half. Falls back to a single letter for a
 * one-word name and to an empty string for none, never to a placeholder.
 */
export function initialsOf(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => [...word][0] ?? "");

  return letters.join(" ");
}

function isRoleKey(value: unknown): value is RoleKey {
  return typeof value === "string" && (ROLE_KEYS as readonly string[]).includes(value);
}

/**
 * The signed-in user, or `null`.
 *
 * Enforces the absolute session ceiling that Better Auth's single rolling
 * expiry cannot express. `session.expiresIn` is the *idle* window (ساعتان); the
 * organisation also caps a session's total age (7 أيام) regardless of how
 * active it has been, so a session older than that is refused here and the
 * record is revoked so the next request does not have to decide again.
 *
 * ## Why every failure becomes `null`
 *
 * A missing `DATABASE_URL`, an unreachable database and a forged cookie all end
 * up here as "no session". That is fail-closed, and it is the only direction
 * that is safe: this function can deny access but never grant it, so an error
 * that it swallowed can only ever cost a signed-in user a redirect to `/login`.
 * The alternative — letting the error escape — turns a database blip into a 500
 * on every page including the sign-in screen, which is both less useful to an
 * operator and no more secure.
 *
 * The error is logged rather than hidden, so a misconfiguration is visible where
 * it matters instead of only in a user-facing stack trace.
 */
export async function currentSession(): Promise<ResolvedSession | null> {
  const requestHeaders = await headers();

  let result: Awaited<ReturnType<ReturnType<typeof auth>["api"]["getSession"]>> | null = null;
  try {
    result = await auth().api.getSession({ headers: requestHeaders });
  } catch (error) {
    console.error("[auth] could not resolve the session:", error);
    return null;
  }

  if (!result?.session || !result.user) return null;

  const policy = securityPolicy();
  const createdAt = new Date(result.session.createdAt);
  const ceiling = createdAt.getTime() + policy.sessionMaxAgeDays * 24 * 60 * 60 * 1000;

  if (Date.now() >= ceiling) {
    await auth()
      .api.signOut({ headers: requestHeaders })
      .catch(() => null);
    return null;
  }

  // A role that is not one of the five means the row was tampered with or the
  // enum moved under us. Fail to the least privileged role rather than trusting
  // the value or throwing a 500 at the user.
  const role: RoleKey = isRoleKey(result.user.role) ? result.user.role : "agent";

  return {
    user: {
      id: result.user.id,
      name: result.user.name,
      email: result.user.email,
      role,
      initials: initialsOf(result.user.name),
    },
    sessionId: result.session.id,
    expiresAt: new Date(result.session.expiresAt),
  };
}

/**
 * The session, or a redirect to `/login`.
 *
 * `next` carries the path the user was trying to reach so signing in returns
 * them there instead of dumping them on a landing page.
 */
export async function requireSession(locale: Locale, next?: string): Promise<ResolvedSession> {
  const session = await currentSession();
  if (session) return session;

  const target =
    next && next.startsWith("/") ? `/login?next=${encodeURIComponent(next)}` : "/login";
  redirectLocale({ href: target, locale });
}

/**
 * The capability gate for Server Actions and pages.
 *
 * Throws rather than redirects: a request for something the user may not do is
 * not a navigation problem, and the `error` boundary is the right place for it.
 * Every gated action calls this on the server even when the UI already hid the
 * control.
 */
export async function requireCapability(
  locale: Locale,
  capability: Capability,
): Promise<ResolvedSession> {
  const session = await requireSession(locale);
  if (!can(session.user.role, capability)) {
    throw new Error(`Forbidden: ${session.user.role} lacks ${capability}`);
  }
  return session;
}

/**
 * Where a user lands after signing in.
 *
 * The dashboard is explicitly manager-shaped — the مهامي screen says so in as
 * many words: "لوحة التحكم تعرض الصورة الإدارية الكاملة؛ هذه الصفحة تعرض عملك
 * فقط". An agent landing there would land on a page mostly about other people,
 * so agents go to their own work instead.
 *
 * This is the assumption recorded as docs/OPEN_QUESTIONS.md Q12, still
 * unanswered. Changing it is changing this one function.
 */
export function landingPathFor(role: RoleKey): string {
  return role === "agent" ? "/my-work" : "/dashboard";
}

/**
 * Validates a `next` parameter before redirecting to it.
 *
 * Only a same-site, locale-relative path is allowed. A protocol-relative value
 * such as `//evil.example` is a *relative* URL to a browser and would send the
 * user off-site, so the second character is checked too.
 */
export function safeNextPath(next: string | undefined, role: RoleKey): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return landingPathFor(role);
  // A backslash is normalised to a slash by some browsers, so `/\evil.example`
  // is the same trick in a different costume.
  if (next.startsWith("/\\")) return landingPathFor(role);
  return next;
}

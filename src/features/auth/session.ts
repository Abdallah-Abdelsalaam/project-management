import { headers } from "next/headers";
import { redirectLocale } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { securityPolicy } from "@/lib/policy";
import { grantsInclude, type Capability, type Scope } from "@/lib/permissions";
import { accessModel, type ResolvedRole } from "@/features/access/model";
import { withinScope, type ScopeSubject } from "@/features/access/scope";
import type { Locale } from "@/i18n/routing";

/**
 * Resolving who is asking, and what they may do.
 *
 * This is the only place in the application that answers either question. The
 * shell takes the identity as a prop and no component decides it for itself —
 * which is what makes the topbar and the sidebar impossible to disagree with
 * the server.
 *
 * Since session 3 the second question is answered from the database. A user
 * carries their role's **grants**, resolved once per request from
 * `role_permission`, rather than a role key that the UI would look up in a
 * constant. That is the difference between a permission matrix that can be
 * edited and one that can only be looked at.
 */

export type SignedInUser = {
  id: string;
  name: string;
  email: string;
  /** Two letters for the topbar chip, derived rather than stored. */
  initials: string;
  roleId: string;
  /** `lead` — stable across renames, for tests and logs, never for a branch. */
  roleKey: string;
  /** `قائد الفريق` — user-entered data, so it is not a message key. */
  roleName: string;
  /** How far this user can see. Checked separately from every capability. */
  scope: Scope;
  /** Literal grant rows, wildcards included. Resolved by `grantsInclude`. */
  grants: string[];
  /**
   * The org columns scope compares against. Both arrive in session 5; until
   * then they are null, and every `team`/`dept` scope check therefore denies.
   */
  teamId: string | null;
  departmentId: string | null;
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
 * A missing `DATABASE_URL`, an unreachable database, a forged cookie and a
 * `role_id` pointing at a role that no longer exists all end up here as "no
 * session". That is fail-closed, and it is the only direction that is safe:
 * this function can deny access but never grant it, so an error that it
 * swallowed can only ever cost a signed-in user a redirect to `/login`. The
 * alternative — letting the error escape — turns a database blip into a 500 on
 * every page including the sign-in screen, which is both less useful to an
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

  const roleId = typeof result.user.roleId === "string" ? result.user.roleId : null;
  if (!roleId) return null;

  let resolved: ResolvedRole | undefined;
  try {
    resolved = (await accessModel()).byId[roleId];
  } catch (error) {
    console.error("[access] could not resolve the role:", error);
    return null;
  }

  // A `role_id` with no row means the role was deleted out from under a live
  // session. Refusing is the only safe reading: the alternative is inventing a
  // set of capabilities for a user whose role no longer exists.
  if (!resolved) return null;

  return {
    user: {
      id: result.user.id,
      name: result.user.name,
      email: result.user.email,
      initials: initialsOf(result.user.name),
      roleId: resolved.id,
      roleKey: resolved.key,
      roleName: resolved.name,
      scope: resolved.scope,
      grants: resolved.grants,
      teamId: null,
      departmentId: null,
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

/** Whether a resolved session holds a capability. */
export function sessionCan(session: ResolvedSession, capability: Capability): boolean {
  return grantsInclude(session.user.grants, capability);
}

/**
 * Raised by the two gates below. A distinct class so a route handler can map
 * it to 403 rather than guessing from a message string.
 */
export class ForbiddenError extends Error {
  constructor(readonly detail: string) {
    super(`Forbidden: ${detail}`);
    this.name = "ForbiddenError";
  }
}

/**
 * The capability gate for Server Actions, route handlers and pages.
 *
 * Throws rather than redirects: a request for something the user may not do is
 * not a navigation problem, and the `error` boundary is the right place for it.
 * Every gated action calls this on the server even when the UI already hid the
 * control — hiding a button is a usability affordance, never a boundary.
 */
export async function requireCapability(
  locale: Locale,
  capability: Capability,
): Promise<ResolvedSession> {
  const session = await requireSession(locale);
  if (!sessionCan(session, capability)) {
    throw new ForbiddenError(`${session.user.roleKey} lacks ${capability}`);
  }
  return session;
}

/**
 * The capability gate **and** the scope gate, which are not the same gate.
 *
 * `requireCapability` answers "may this role assign tasks at all?".
 * `requireScope` answers "over *this* task?" — and a team leader holding
 * `tasks.assign` must still be refused someone else's team. Any action that
 * touches a specific row calls this one; only the row-less ones (opening a
 * settings screen, listing the catalog) may stop at the capability.
 */
export async function requireScope(
  locale: Locale,
  capability: Capability,
  subject: ScopeSubject,
): Promise<ResolvedSession> {
  const session = await requireCapability(locale, capability);

  const allowed = withinScope(
    {
      userId: session.user.id,
      scope: session.user.scope,
      teamId: session.user.teamId,
      departmentId: session.user.departmentId,
    },
    subject,
  );

  if (!allowed) {
    throw new ForbiddenError(
      `${session.user.roleKey} holds ${capability} but its ${session.user.scope} scope does not reach this row`,
    );
  }

  return session;
}

/**
 * Where a user lands after signing in.
 *
 * The dashboard is explicitly manager-shaped — the مهامي screen says so in as
 * many words: "لوحة التحكم تعرض الصورة الإدارية الكاملة؛ هذه الصفحة تعرض عملك
 * فقط". Someone who can only see their own work would land on a page mostly
 * about other people, so they go to their own work instead.
 *
 * Decided from capabilities rather than from the role key, so a sixth role
 * created in the matrix lands somewhere sensible without this function
 * learning its name. This is the assumption recorded as
 * docs/OPEN_QUESTIONS.md Q12, still unanswered.
 */
export function landingPathFor(grants: readonly string[] | undefined): string {
  if (!grants) return "/my-work";
  const seesOthers =
    grantsInclude(grants, "tasks.view.team") || grantsInclude(grants, "tasks.view.dept");
  return seesOthers ? "/dashboard" : "/my-work";
}

/**
 * Validates a `next` parameter before redirecting to it.
 *
 * Only a same-site, locale-relative path is allowed. A protocol-relative value
 * such as `//evil.example` is a *relative* URL to a browser and would send the
 * user off-site, so the second character is checked too.
 */
export function safeNextPath(next: string | undefined, fallback: string): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
  // A backslash is normalised to a slash by some browsers, so `/\evil.example`
  // is the same trick in a different costume.
  if (next.startsWith("/\\")) return fallback;
  return next;
}

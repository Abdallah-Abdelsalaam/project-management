import { SCOPE_RANK, type Scope } from "@/lib/permissions";

/**
 * Scope — the half of authorization that capability strings cannot express.
 *
 * A team leader and a department head both hold `tasks.assign`. Nothing in
 * that string says the leader may assign only inside their own team, and no
 * amount of splitting it (`tasks.assign.team`, `tasks.assign.dept`, …) fixes
 * it, because the answer depends on the *row* being acted on and not on the
 * action. So the check has two parts and both are mandatory:
 *
 *     capability  — may this role perform this action at all?
 *     scope       — over this particular row?
 *
 * Everything here is pure, so the rule is unit-tested without a database and
 * long before the tables it will guard exist. `team` and `dept` compare
 * columns that arrive in sessions 5 and 6; until then an actor has neither, so
 * those scopes deny — which is the correct direction to be wrong in.
 */

/** The actor's position in the organisation, plus the reach their role grants. */
export type ScopeActor = {
  userId: string;
  scope: Scope;
  teamId?: string | null;
  departmentId?: string | null;
};

/** The row being acted on, as far as scope is concerned. */
export type ScopeSubject = {
  /** Whoever the row belongs to — a task's assignee, a profile's user. */
  ownerId?: string | null;
  teamId?: string | null;
  departmentId?: string | null;
};

/**
 * Whether `actor` may act on `subject`.
 *
 * Each scope compares exactly one pair of values, and a null on **either**
 * side denies. That matters: an actor with no department and a subject with no
 * department are not "the same department", they are two unknowns, and
 * treating `null === null` as a match would hand every unassigned user
 * authority over every unassigned row.
 */
export function withinScope(actor: ScopeActor, subject: ScopeSubject): boolean {
  switch (actor.scope) {
    case "all":
      return true;
    case "dept":
      return matches(actor.departmentId, subject.departmentId);
    case "team":
      return matches(actor.teamId, subject.teamId);
    case "own":
      return matches(actor.userId, subject.ownerId);
  }
}

function matches(a: string | null | undefined, b: string | null | undefined): boolean {
  return Boolean(a) && Boolean(b) && a === b;
}

/**
 * Whether `actor` reaches at least as far as `required`.
 *
 * For the places that need a floor rather than a row — "this screen is for
 * someone who can see a whole department" — where there is no subject to
 * compare against yet.
 */
export function scopeAtLeast(actor: Pick<ScopeActor, "scope">, required: Scope): boolean {
  return SCOPE_RANK[actor.scope] >= SCOPE_RANK[required];
}

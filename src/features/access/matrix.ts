import { expandGrants, grantsInclude, type Capability } from "@/lib/permissions";

/**
 * Turning checkbox changes into grant rows.
 *
 * The matrix shows one checkbox per (role, capability). The table stores
 * something else: grant strings, which may be exact (`tasks.bulk`) or
 * wildcards (`tasks.*`, `*`). Wildcards are stored literally and on purpose —
 * "the manager can do everything under tasks" must stay true the day a
 * fifteenth task capability is added, and an expanded set would quietly stop
 * being true.
 *
 * Which makes unchecking a box interesting. There is no row to delete when the
 * box is ticked *because of* a wildcard, so revoking has to break the wildcard
 * open: remove it, and write back explicit rows for everything it covered
 * except the capability being revoked. The role keeps exactly the access it
 * had, minus one.
 *
 * Pure, so every one of those cases is unit-tested without a database.
 */

export type CellChange = { capability: Capability; granted: boolean };

export type GrantUpdate = {
  /** The role's grants after the change, as rows to store. */
  grants: string[];
  /** Rows to insert. */
  added: string[];
  /** Rows to delete. */
  removed: string[];
  /** The cells whose effective state actually flipped — what gets audited. */
  applied: CellChange[];
};

/**
 * Applies a set of cell changes to one role's grants.
 *
 * A change that asks for a state the role already has is dropped rather than
 * written, so a save that touched nothing produces no rows and no audit
 * entries. That matters for the audit log's credibility: every row in it
 * should be a real change.
 */
export function applyCellChanges(
  current: readonly string[],
  changes: readonly CellChange[],
): GrantUpdate {
  // Only the changes that actually flip something survive.
  const applied = changes.filter(
    (change) => grantsInclude(current, change.capability) !== change.granted,
  );

  if (applied.length === 0) {
    return { grants: [...current], added: [], removed: [], applied: [] };
  }

  const revoked = new Set(
    applied.filter((change) => !change.granted).map((change) => change.capability),
  );

  const next = new Set<string>();

  for (const grant of current) {
    const covers = [...revoked].filter((capability) => grantsInclude([grant], capability));

    if (covers.length === 0) {
      next.add(grant);
      continue;
    }

    // An exact grant for a revoked capability simply goes away. A wildcard is
    // replaced by what it still ought to cover.
    if (!grant.endsWith(".*") && grant !== "*") continue;

    for (const capability of expandGrants([grant])) {
      if (!revoked.has(capability)) next.add(capability);
    }
  }

  for (const change of applied) {
    if (change.granted && !grantsInclude([...next], change.capability)) {
      next.add(change.capability);
    }
  }

  const grants = [...next].sort();
  const before = new Set(current);

  return {
    grants,
    added: grants.filter((grant) => !before.has(grant)),
    removed: [...before].filter((grant) => !next.has(grant)).sort(),
    applied,
  };
}

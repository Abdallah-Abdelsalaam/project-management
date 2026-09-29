import { describe, expect, it } from "vitest";
import { applyCellChanges } from "@/features/access/matrix";
import { ROLES, expandGrants, grantsInclude } from "@/lib/permissions";

/**
 * The matrix's whole difficulty is that a ticked box and a stored row are not
 * the same thing. These tests are written against that gap.
 */

describe("granting", () => {
  it("adds an exact row for a capability the role lacks", () => {
    const result = applyCellChanges(
      ["tasks.view.own"],
      [{ capability: "tasks.approve", granted: true }],
    );

    expect(result.added).toEqual(["tasks.approve"]);
    expect(result.removed).toEqual([]);
    expect(result.grants).toEqual(["tasks.approve", "tasks.view.own"]);
  });

  it("writes nothing when the capability is already held exactly", () => {
    const result = applyCellChanges(
      ["tasks.approve"],
      [{ capability: "tasks.approve", granted: true }],
    );

    expect(result.applied).toEqual([]);
    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
  });

  it("writes nothing when the capability is already held through a wildcard", () => {
    const result = applyCellChanges(["tasks.*"], [{ capability: "tasks.approve", granted: true }]);

    expect(result.applied).toEqual([]);
    expect(result.grants).toEqual(["tasks.*"]);
  });
});

describe("revoking", () => {
  it("deletes the exact row", () => {
    const result = applyCellChanges(
      ["tasks.view.own", "tasks.approve"],
      [{ capability: "tasks.approve", granted: false }],
    );

    expect(result.removed).toEqual(["tasks.approve"]);
    expect(result.grants).toEqual(["tasks.view.own"]);
  });

  it("writes nothing when the capability was not held", () => {
    const result = applyCellChanges(
      ["tasks.view.own"],
      [{ capability: "tasks.approve", granted: false }],
    );

    expect(result.applied).toEqual([]);
    expect(result.grants).toEqual(["tasks.view.own"]);
  });

  /**
   * The case the whole module exists for. There is no `tasks.bulk` row to
   * delete, so the wildcard has to be broken open and written back minus one.
   */
  it("expands a wildcard rather than failing to find a row", () => {
    const result = applyCellChanges(
      ["tasks.*", "reports.view"],
      [{ capability: "tasks.bulk", granted: false }],
    );

    expect(result.removed).toContain("tasks.*");
    expect(result.grants).not.toContain("tasks.*");
    expect(result.grants).not.toContain("tasks.bulk");
    expect(grantsInclude(result.grants, "tasks.approve")).toBe(true);
    // Everything else the wildcard covered survives, and nothing outside it
    // is touched.
    expect(result.grants).toContain("reports.view");
    expect(result.grants.filter((grant) => grant.startsWith("tasks."))).toHaveLength(
      expandGrants(["tasks.*"]).length - 1,
    );
  });

  it("expands the root wildcard the same way", () => {
    const result = applyCellChanges(["*"], [{ capability: "audit.view", granted: false }]);

    expect(result.grants).not.toContain("*");
    expect(grantsInclude(result.grants, "audit.view")).toBe(false);
    expect(grantsInclude(result.grants, "tasks.approve")).toBe(true);
  });

  it("revokes several capabilities covered by one wildcard in a single pass", () => {
    const result = applyCellChanges(
      ["tasks.*"],
      [
        { capability: "tasks.bulk", granted: false },
        { capability: "tasks.approve", granted: false },
      ],
    );

    expect(grantsInclude(result.grants, "tasks.bulk")).toBe(false);
    expect(grantsInclude(result.grants, "tasks.approve")).toBe(false);
    expect(grantsInclude(result.grants, "tasks.reject")).toBe(true);
    expect(result.applied).toHaveLength(2);
  });
});

describe("mixed saves", () => {
  it("applies a grant and a revoke together", () => {
    const result = applyCellChanges(
      ["tasks.view.own", "tasks.approve"],
      [
        { capability: "tasks.approve", granted: false },
        { capability: "tasks.reject", granted: true },
      ],
    );

    expect(grantsInclude(result.grants, "tasks.approve")).toBe(false);
    expect(grantsInclude(result.grants, "tasks.reject")).toBe(true);
    expect(result.applied).toHaveLength(2);
  });

  it("drops the no-ops and keeps the rest", () => {
    const result = applyCellChanges(
      ["tasks.view.own"],
      [
        { capability: "tasks.view.own", granted: true },
        { capability: "tasks.create", granted: true },
      ],
    );

    expect(result.applied).toEqual([{ capability: "tasks.create", granted: true }]);
  });

  it("leaves the grants untouched when every change is a no-op", () => {
    const result = applyCellChanges(ROLES.agent.grants, [
      { capability: "tasks.view.own", granted: true },
      { capability: "tasks.approve", granted: false },
    ]);

    expect(result.applied).toEqual([]);
    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
    expect(result.grants).toEqual([...ROLES.agent.grants]);
  });
});

describe("the seed roles survive a round trip", () => {
  it("revoking then re-granting restores the same effective set", () => {
    const before = expandGrants(ROLES.manager.grants);

    const revoked = applyCellChanges(ROLES.manager.grants, [
      { capability: "tasks.bulk", granted: false },
    ]);
    const restored = applyCellChanges(revoked.grants, [
      { capability: "tasks.bulk", granted: true },
    ]);

    expect(expandGrants(restored.grants).sort()).toEqual(before.sort());
  });
});

import { describe, expect, it } from "vitest";
import { scopeAtLeast, withinScope, type ScopeActor } from "@/features/access/scope";

const lead: ScopeActor = {
  userId: "u-lead",
  scope: "team",
  teamId: "t-1",
  departmentId: "d-1",
};

const head: ScopeActor = {
  userId: "u-head",
  scope: "dept",
  teamId: null,
  departmentId: "d-1",
};

describe("scope is not capability", () => {
  /**
   * The case that motivates the whole module: two roles, the same capability,
   * different answers — and the capability string is identical in both.
   */
  it("lets a team leader reach their own team and not another", () => {
    expect(withinScope(lead, { teamId: "t-1" })).toBe(true);
    expect(withinScope(lead, { teamId: "t-2" })).toBe(false);
  });

  it("lets a department head reach any team in their department", () => {
    expect(withinScope(head, { teamId: "t-2", departmentId: "d-1" })).toBe(true);
    expect(withinScope(head, { teamId: "t-2", departmentId: "d-9" })).toBe(false);
  });
});

describe("own", () => {
  const agent: ScopeActor = { userId: "u-1", scope: "own" };

  it("reaches a row they own", () => {
    expect(withinScope(agent, { ownerId: "u-1" })).toBe(true);
  });

  it("does not reach somebody else's", () => {
    expect(withinScope(agent, { ownerId: "u-2" })).toBe(false);
  });

  it("does not reach a row with no owner", () => {
    expect(withinScope(agent, { ownerId: null })).toBe(false);
  });
});

describe("all", () => {
  const manager: ScopeActor = { userId: "u-9", scope: "all" };

  it("reaches everything, including a row with nothing set", () => {
    expect(withinScope(manager, {})).toBe(true);
    expect(withinScope(manager, { ownerId: "u-1", teamId: "t-5", departmentId: "d-3" })).toBe(true);
  });
});

describe("two unknowns are not a match", () => {
  /**
   * The rule that keeps the gap between sessions 3 and 5 safe. Until users
   * carry a team and a department, both sides of these comparisons are null —
   * and `null === null` would hand every user authority over every
   * unassigned row.
   */
  it("denies when the actor has no team", () => {
    const unassigned: ScopeActor = { userId: "u-1", scope: "team", teamId: null };
    expect(withinScope(unassigned, { teamId: null })).toBe(false);
    expect(withinScope(unassigned, { teamId: "t-1" })).toBe(false);
  });

  it("denies when the subject has no department", () => {
    expect(withinScope(head, { departmentId: null })).toBe(false);
    expect(withinScope(head, {})).toBe(false);
  });

  it("denies when the actor's column is an empty string", () => {
    const empty: ScopeActor = { userId: "u-1", scope: "dept", departmentId: "" };
    expect(withinScope(empty, { departmentId: "" })).toBe(false);
  });
});

describe("scopeAtLeast", () => {
  it("orders the four scopes by reach", () => {
    expect(scopeAtLeast({ scope: "all" }, "dept")).toBe(true);
    expect(scopeAtLeast({ scope: "dept" }, "team")).toBe(true);
    expect(scopeAtLeast({ scope: "team" }, "own")).toBe(true);
    expect(scopeAtLeast({ scope: "own" }, "team")).toBe(false);
    expect(scopeAtLeast({ scope: "team" }, "dept")).toBe(false);
  });

  it("is satisfied by an equal scope", () => {
    expect(scopeAtLeast({ scope: "team" }, "team")).toBe(true);
  });
});

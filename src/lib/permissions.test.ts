import { describe, expect, it } from "vitest";
import { CAPABILITIES, ROLES, can, canAll, canAny, grantsInclude } from "@/lib/permissions";

describe("capability matching", () => {
  it("matches an exact grant", () => {
    expect(grantsInclude(["tasks.assign"], "tasks.assign")).toBe(true);
  });

  it("matches a prefix wildcard", () => {
    expect(grantsInclude(["tasks.*"], "tasks.status.any")).toBe(true);
  });

  it("does not let a wildcard leak across groups", () => {
    expect(grantsInclude(["tasks.*"], "team.settings")).toBe(false);
  });

  it("matches everything under the root wildcard", () => {
    for (const capability of CAPABILITIES) {
      expect(grantsInclude(["*"], capability)).toBe(true);
    }
  });
});

describe("seed roles", () => {
  it("gives an agent only their own tasks", () => {
    expect(can("agent", "tasks.view.own")).toBe(true);
    expect(can("agent", "tasks.view.team")).toBe(false);
    expect(can("agent", "tasks.approve")).toBe(false);
  });

  it("lets a lead review and approve but not manage heads", () => {
    expect(canAll("lead", ["tasks.review", "tasks.approve", "tasks.reject"])).toBe(true);
    expect(can("lead", "heads.manage")).toBe(false);
  });

  it("lets a head move employees and manage leads", () => {
    expect(canAll("head", ["employee.move", "leads.manage", "org.view"])).toBe(true);
    expect(can("head", "heads.manage")).toBe(false);
  });

  it("resolves the manager's wildcards", () => {
    expect(can("manager", "tasks.bulk")).toBe(true);
    expect(can("manager", "dept.manage")).toBe(true);
    expect(can("manager", "settings.view")).toBe(true);
  });

  it("gives the admin every capability", () => {
    for (const capability of CAPABILITIES) {
      expect(can("admin", capability)).toBe(true);
    }
  });

  it("escalates monotonically for the shared view capability", () => {
    expect(canAny("agent", ["tasks.assign"])).toBe(false);
    expect(canAny("lead", ["tasks.assign"])).toBe(true);
  });

  it("labels every role for the user chip", () => {
    for (const role of Object.values(ROLES)) {
      expect(role.label.length).toBeGreaterThan(0);
      expect(role.scope.length).toBeGreaterThan(0);
    }
  });
});

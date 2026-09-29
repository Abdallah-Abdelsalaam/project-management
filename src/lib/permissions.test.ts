import { describe, expect, it } from "vitest";
import {
  CAPABILITIES,
  CAPABILITY_GROUPS,
  CAPABILITY_META,
  ROLES,
  can,
  canAll,
  canAny,
  expandGrants,
  grantBreadth,
  grantsInclude,
  isCapability,
} from "@/lib/permissions";

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

describe("the capability catalog", () => {
  it("describes every capability the code can check", () => {
    for (const capability of CAPABILITIES) {
      const meta = CAPABILITY_META[capability];
      expect(meta, capability).toBeDefined();
      expect(meta.labelAr.length, capability).toBeGreaterThan(0);
      expect(meta.labelEn.length, capability).toBeGreaterThan(0);
      expect(CAPABILITY_GROUPS).toContain(meta.group);
    }
  });

  it("describes nothing the code cannot check", () => {
    expect(Object.keys(CAPABILITY_META).sort()).toEqual([...CAPABILITIES].sort());
  });

  it("recognises a capability string and rejects anything else", () => {
    expect(isCapability("tasks.approve")).toBe(true);
    expect(isCapability("tasks.*")).toBe(false);
    expect(isCapability("tasks.nonexistent")).toBe(false);
    expect(isCapability(42)).toBe(false);
  });

  /**
   * The seed is the source the `permission` table is written from, so a grant
   * naming a capability that is not in the catalog would seed a row nothing
   * can ever satisfy.
   */
  it("only grants capabilities that exist, or wildcards over them", () => {
    for (const role of Object.values(ROLES)) {
      for (const grant of role.grants) {
        if (grant === "*" || grant.endsWith(".*")) {
          expect(expandGrants([grant]).length, `${role.key} ${grant}`).toBeGreaterThan(0);
        } else {
          expect(CAPABILITIES, `${role.key} ${grant}`).toContain(grant);
        }
      }
    }
  });
});

describe("expandGrants", () => {
  it("resolves a wildcard to the capabilities under it", () => {
    const expanded = expandGrants(["team.*"]);
    expect(expanded).toEqual(["team.view", "team.settings", "team.assign"]);
  });

  it("resolves the root wildcard to the whole catalog", () => {
    expect(expandGrants(["*"])).toEqual([...CAPABILITIES]);
  });

  it("de-duplicates overlapping grants", () => {
    expect(expandGrants(["tasks.*", "tasks.approve"])).toEqual(expandGrants(["tasks.*"]));
  });

  it("gives the manager every capability, through wildcards alone", () => {
    expect(expandGrants(ROLES.manager.grants)).toEqual([...CAPABILITIES]);
  });
});

describe("grantBreadth", () => {
  /**
   * Which of the roles list's three phrasings applies. The manager is the
   * interesting one: it holds everything today, but through wildcards, so
   * printing a number would state a total that stops being true the day a
   * capability is added.
   */
  it("calls the admin's root wildcard 'all'", () => {
    expect(grantBreadth(ROLES.admin.grants)).toBe("all");
  });

  it("calls the manager's group wildcards 'wildcard'", () => {
    expect(grantBreadth(ROLES.manager.grants)).toBe("wildcard");
  });

  it("counts the three explicit roles", () => {
    expect(grantBreadth(ROLES.agent.grants)).toBe("counted");
    expect(grantBreadth(ROLES.lead.grants)).toBe("counted");
    expect(grantBreadth(ROLES.head.grants)).toBe("counted");
  });
});

describe("role metadata for the roles list", () => {
  it("gives every role a reach, a description and a glyph", () => {
    for (const role of Object.values(ROLES)) {
      expect(["own", "team", "dept", "all"], role.key).toContain(role.reach);
      expect(role.description.length, role.key).toBeGreaterThan(0);
      expect(role.icon.length, role.key).toBeGreaterThan(0);
    }
  });

  it("escalates reach with the role", () => {
    expect(ROLES.agent.reach).toBe("own");
    expect(ROLES.lead.reach).toBe("team");
    expect(ROLES.head.reach).toBe("dept");
    expect(ROLES.manager.reach).toBe("all");
  });
});

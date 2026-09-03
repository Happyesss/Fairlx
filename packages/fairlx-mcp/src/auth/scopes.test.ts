import { describe, expect, it } from "vitest";
import { PERMISSIONS } from "../runtime/types";
import {
  ALL_SCOPES,
  hasScope,
  resolveEffectiveScopes,
  scopesFromPermissions,
} from "./scopes";

const MEMBER_PERMISSIONS = [
  PERMISSIONS.VIEW_PROJECT,
  PERMISSIONS.VIEW_TASKS,
  PERMISSIONS.VIEW_SPRINTS,
  PERMISSIONS.VIEW_DOCS,
  PERMISSIONS.VIEW_MEMBERS,
  PERMISSIONS.CREATE_TASKS,
  PERMISSIONS.EDIT_TASKS,
];

const VIEWER_PERMISSIONS = [
  PERMISSIONS.VIEW_PROJECT,
  PERMISSIONS.VIEW_TASKS,
  PERMISSIONS.VIEW_SPRINTS,
  PERMISSIONS.VIEW_DOCS,
  PERMISSIONS.VIEW_MEMBERS,
];

const ADMIN_PERMISSIONS = [
  PERMISSIONS.VIEW_PROJECT,
  PERMISSIONS.VIEW_TASKS,
  PERMISSIONS.VIEW_SPRINTS,
  PERMISSIONS.VIEW_DOCS,
  PERMISSIONS.CREATE_TASKS,
  PERMISSIONS.EDIT_TASKS,
  PERMISSIONS.DELETE_TASKS,
  PERMISSIONS.CREATE_SPRINTS,
  PERMISSIONS.EDIT_SPRINTS,
  PERMISSIONS.START_SPRINT,
  PERMISSIONS.COMPLETE_SPRINT,
  PERMISSIONS.DELETE_SPRINTS,
  PERMISSIONS.CREATE_COMMENTS,
  PERMISSIONS.DELETE_COMMENTS,
  PERMISSIONS.CREATE_DOCS,
  PERMISSIONS.EDIT_DOCS,
  PERMISSIONS.DELETE_DOCS,
  PERMISSIONS.EDIT_SETTINGS,
  PERMISSIONS.MANAGE_TEAMS,
];

describe("hasScope", () => {
  it("requires every listed scope", () => {
    expect(hasScope(["a"], ["a", "b"])).toBe(false);
    expect(hasScope(["a", "b"], ["a", "b"])).toBe(true);
    expect(hasScope(["a", "b", "c"], ["a"])).toBe(true);
  });
});

describe("scopesFromPermissions", () => {
  it("gives owners the full catalog", () => {
    expect(scopesFromPermissions([], { isOwner: true })).toEqual([...ALL_SCOPES]);
  });

  it("gives members write but not delete", () => {
    const scopes = scopesFromPermissions(MEMBER_PERMISSIONS);
    expect(scopes).toContain("tasks:write");
    expect(scopes).not.toContain("tasks:delete");
    expect(scopes).not.toContain("admin:manage");
    expect(scopes).not.toContain("comments:write");
  });

  it("gives viewers read-only scopes", () => {
    const scopes = scopesFromPermissions(VIEWER_PERMISSIONS);
    expect(scopes).toEqual([
      "project:read",
      "members:read",
      "tasks:read",
      "sprints:read",
      "docs:read",
      "workflows:read",
    ]);
  });

  it("gives admins write, delete, and admin:manage but not via DELETE_PROJECT", () => {
    const scopes = scopesFromPermissions(ADMIN_PERMISSIONS);
    expect(scopes).toContain("tasks:write");
    expect(scopes).toContain("tasks:delete");
    expect(scopes).toContain("admin:manage");
    expect(scopes).toContain("docs:write");
  });
});

describe("resolveEffectiveScopes", () => {
  it("inherits role scopes when the token has no explicit scopes", () => {
    expect(resolveEffectiveScopes({ roleScopes: ["tasks:read", "tasks:write"] })).toEqual([
      "tasks:read",
      "tasks:write",
    ]);
  });

  it("inherits ALL_SCOPES when neither explicit nor role scopes are known", () => {
    expect(resolveEffectiveScopes({})).toEqual([...ALL_SCOPES]);
  });

  it("intersects explicit scopes as a least-privilege ceiling", () => {
    expect(
      resolveEffectiveScopes({
        explicitScopes: ["tasks:read", "tasks:write", "tasks:delete"],
        roleScopes: ["tasks:read", "tasks:write"],
      })
    ).toEqual(["tasks:read", "tasks:write"]);
  });
});

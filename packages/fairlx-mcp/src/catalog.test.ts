import { describe, expect, it } from "vitest";
import { scopesFromPermissions } from "./auth/scopes";
import { PROMPT_CATALOG } from "./prompts/catalog";
import { RESOURCE_TEMPLATES } from "./resources/catalog";
import { PERMISSIONS } from "./runtime/types";
import { SKILLS } from "./skills/registry";
import { listToolsForClient, TOOL_CATALOG } from "./tools/catalog";

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
];

function toolNames(permissions: string[], isOwner = false) {
  return listToolsForClient({
    scopes: scopesFromPermissions(permissions, { isOwner }),
    projectPermissions: isOwner ? undefined : permissions,
  }).map((tool) => tool.name);
}

describe("MCP surface counts", () => {
  it("exposes 40 tools, 9 resource templates, 6 prompts, 6 skills", () => {
    expect(TOOL_CATALOG).toHaveLength(40);
    expect(RESOURCE_TEMPLATES).toHaveLength(9);
    expect(PROMPT_CATALOG).toHaveLength(6);
    expect(SKILLS).toHaveLength(6);
  });
});

describe("listToolsForClient role filter", () => {
  it("hides write and delete tools from viewers", () => {
    const names = toolNames(VIEWER_PERMISSIONS);
    expect(names).toContain("fairlx_work_item_get");
    expect(names).not.toContain("fairlx_work_item_update");
    expect(names).not.toContain("fairlx_work_item_delete");
  });

  it("gives members write but not delete", () => {
    const names = toolNames(MEMBER_PERMISSIONS);
    expect(names).toContain("fairlx_work_item_update");
    expect(names).not.toContain("fairlx_work_item_delete");
    expect(names).not.toContain("fairlx_project_delete");
  });

  it("gives admins delete tools except project delete", () => {
    const names = toolNames(ADMIN_PERMISSIONS);
    expect(names).toContain("fairlx_work_item_update");
    expect(names).toContain("fairlx_work_item_delete");
    expect(names).not.toContain("fairlx_project_delete");
  });

  it("gives owners the full catalog including project delete", () => {
    const names = toolNames([], true);
    expect(names).toHaveLength(40);
    expect(names).toContain("fairlx_project_delete");
  });
});

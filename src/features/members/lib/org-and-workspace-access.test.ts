import { describe, expect, it } from "vitest";

import { canAddToOrganizationAndWorkspace, isWorkspaceAdminRole } from "./org-and-workspace-access";

describe("isWorkspaceAdminRole", () => {
  it("treats OWNER, ADMIN, and WS_ADMIN as workspace admins", () => {
    expect(isWorkspaceAdminRole("OWNER")).toBe(true);
    expect(isWorkspaceAdminRole("ADMIN")).toBe(true);
    expect(isWorkspaceAdminRole("WS_ADMIN")).toBe(true);
    expect(isWorkspaceAdminRole("MEMBER")).toBe(false);
  });
});

describe("canAddToOrganizationAndWorkspace", () => {
  it("allows a workspace admin even when they are not the organization owner", () => {
    expect(
      canAddToOrganizationAndWorkspace({
        isOrgOwner: false,
        hasMembersManage: false,
        actorWorkspaceRole: "ADMIN",
      }),
    ).toBe(true);
  });

  it("allows the organization owner or a members-manage grant", () => {
    expect(
      canAddToOrganizationAndWorkspace({
        isOrgOwner: true,
        hasMembersManage: false,
        actorWorkspaceRole: "MEMBER",
      }),
    ).toBe(true);
    expect(
      canAddToOrganizationAndWorkspace({
        isOrgOwner: false,
        hasMembersManage: true,
        actorWorkspaceRole: null,
      }),
    ).toBe(true);
  });

  it("refuses a workspace member without org invite rights", () => {
    expect(
      canAddToOrganizationAndWorkspace({
        isOrgOwner: false,
        hasMembersManage: false,
        actorWorkspaceRole: "MEMBER",
      }),
    ).toBe(false);
  });
});

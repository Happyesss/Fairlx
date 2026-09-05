import { describe, expect, it, vi } from "vitest";
import { jwtToAuthContext } from "../auth/context";
import { PERMISSIONS, type McpRuntime } from "../runtime/types";
import { callTool } from "./index";

function teamRuntime(options?: {
  isOwner?: boolean;
  permissions?: string[];
  members?: Record<string, unknown>[];
  teams?: Record<string, unknown>[];
  teamMembers?: Record<string, unknown>[];
  projectMembers?: Record<string, unknown>[];
  projectRoles?: Record<string, unknown>[];
}) {
  const members = (options?.members ?? []).map((doc) => ({ ...doc }));
  const teams = (options?.teams ?? []).map((doc) => ({ ...doc }));
  const teamMembers = (options?.teamMembers ?? []).map((doc) => ({ ...doc }));
  const projectMembers = (options?.projectMembers ?? []).map((doc) => ({ ...doc }));
  const projectRoles = (options?.projectRoles ?? []).map((doc) => ({ ...doc }));
  const permissions: Record<string, unknown>[] = [];
  const onProjectTeamChanged = vi.fn();
  const profiles = new Map(
    members.map((doc) => [
      String(doc.userId),
      {
        id: String(doc.userId),
        name: String(doc.displayName ?? doc.userId),
        email: String(doc.displayEmail ?? `${doc.userId}@fairlx.dev`),
      },
    ]),
  );

  const table = (collection: string) => {
    if (collection === "members") return members;
    if (collection === "project_teams") return teams;
    if (collection === "project_team_members") return teamMembers;
    if (collection === "project_members") return projectMembers;
    if (collection === "project_roles") return projectRoles;
    if (collection === "project_permissions") return permissions;
    return [];
  };

  const runtime = {
    collections: {
      members: "members",
      projects: "projects",
      projectTeams: "project_teams",
      projectTeamMembers: "project_team_members",
      projectMembers: "project_members",
      projectRoles: "project_roles",
      projectPermissions: "project_permissions",
    },
    store: {
      list: async (collection: string, queries: Array<{ type: string; field?: string; value?: unknown }>) => {
        let filtered = table(collection);
        for (const query of queries) {
          if (query.type === "equal" && query.field) {
            filtered = filtered.filter((doc) => doc[query.field as string] === query.value);
          }
        }
        return { documents: filtered, total: filtered.length };
      },
      get: async (collection: string, id: string) => {
        if (collection === "projects" && id === "proj_1") {
          return { $id: "proj_1", workspaceId: "ws_1", name: "School Stacker" };
        }
        const docs = table(collection);
        const doc = docs.find((item) => item.$id === id);
        if (!doc) throw new Error("missing");
        return doc;
      },
      create: async (collection: string, data: Record<string, unknown>) => {
        const docs = table(collection);
        const doc = { $id: `${collection}_${docs.length + 1}`, ...data };
        docs.push(doc);
        return doc;
      },
      update: async (collection: string, id: string, data: Record<string, unknown>) => {
        const docs = table(collection);
        const doc = docs.find((item) => item.$id === id);
        if (!doc) throw new Error("missing");
        Object.assign(doc, data);
        return doc;
      },
      delete: async (collection: string, id: string) => {
        const docs = table(collection);
        const index = docs.findIndex((item) => item.$id === id);
        if (index >= 0) docs.splice(index, 1);
      },
    },
    resolveUserProjectAccess: async () => ({
      hasAccess: true,
      isOwner: options?.isOwner ?? true,
      isAdmin: true,
      permissions: options?.permissions ?? [],
    }),
    hasProjectPermission: (
      access: { isOwner: boolean; permissions: string[] },
      permission: string,
    ) => access.isOwner || access.permissions.includes(permission),
    lookupUsers: async (userIds: string[]) =>
      userIds.map((id) => profiles.get(id) ?? { id, name: "", email: "" }),
    now: () => "2026-09-03T18:00:00.000Z",
    logAudit: vi.fn(),
    onProjectTeamChanged,
  } as unknown as McpRuntime;

  return { runtime, teams, teamMembers, projectMembers, projectRoles, onProjectTeamChanged };
}

const ownerAuth = jwtToAuthContext("admin_1", {
  workspaceId: "ws_1",
  scopes: ["admin:manage", "members:read"],
});

describe("fairlx_project_team_create", () => {
  it("creates a project team", async () => {
    const { runtime, teams } = teamRuntime({
      members: [{ $id: "mem_actor", workspaceId: "ws_1", userId: "admin_1", role: "OWNER" }],
    });
    const result = await callTool(
      "fairlx_project_team_create",
      { projectId: "proj_1", name: "Developers" },
      runtime,
      ownerAuth,
    );
    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0]?.text ?? "{}")).toMatchObject({
      created: true,
      team: { name: "Developers", color: "#4F46E5" },
    });
    expect(teams).toHaveLength(1);
    expect(teams[0]).toMatchObject({ projectId: "proj_1", workspaceId: "ws_1", name: "Developers" });
  });

  it("rejects a duplicate team name", async () => {
    const { runtime } = teamRuntime({
      teams: [{ $id: "team_1", projectId: "proj_1", name: "Developers" }],
    });
    const result = await callTool(
      "fairlx_project_team_create",
      { projectId: "proj_1", name: "Developers" },
      runtime,
      ownerAuth,
    );
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0]?.text ?? "{}").error).toMatch(/already exists/i);
  });

  it("refuses without MANAGE_TEAMS", async () => {
    const { runtime } = teamRuntime({ isOwner: false, permissions: [PERMISSIONS.VIEW_MEMBERS] });
    await expect(
      callTool(
        "fairlx_project_team_create",
        { projectId: "proj_1", name: "Developers" },
        runtime,
        ownerAuth,
      ),
    ).rejects.toMatchObject({ httpStatus: 403 });
  });
});

describe("fairlx_project_team_member_add", () => {
  it("adds a workspace member to the team and project", async () => {
    const { runtime, teamMembers, projectMembers, onProjectTeamChanged } = teamRuntime({
      members: [
        { $id: "mem_actor", workspaceId: "ws_1", userId: "admin_1", role: "OWNER", displayName: "Ada" },
        {
          $id: "mem_surendra",
          workspaceId: "ws_1",
          userId: "user_surendra",
          role: "ADMIN",
          displayName: "Surendra",
          displayEmail: "surendra@fairlx.dev",
        },
      ],
      teams: [{ $id: "team_dev", projectId: "proj_1", workspaceId: "ws_1", name: "Developers" }],
      projectRoles: [
        { $id: "role_admin", projectId: "proj_1", name: "ADMIN" },
        { $id: "role_member", projectId: "proj_1", name: "MEMBER" },
      ],
    });

    const result = await callTool(
      "fairlx_project_team_member_add",
      { projectId: "proj_1", teamName: "Developers", name: "Surendra" },
      runtime,
      ownerAuth,
    );

    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0]?.text ?? "{}")).toMatchObject({
      added: true,
      addedToProject: true,
      member: { name: "Surendra", email: "surendra@fairlx.dev", team: "Developers" },
    });
    expect(teamMembers).toHaveLength(1);
    expect(teamMembers[0]).toMatchObject({
      teamId: "team_dev",
      userId: "user_surendra",
      role: "member",
    });
    expect(teamMembers[0]).not.toHaveProperty("teamRole");
    expect(teamMembers[0]).not.toHaveProperty("joinedAt");
    expect(teamMembers[0]).not.toHaveProperty("addedBy");
    expect(projectMembers).toHaveLength(1);
    expect(projectMembers[0]).toMatchObject({
      workspaceId: "ws_1",
      projectId: "proj_1",
      userId: "user_surendra",
      roleId: "role_admin",
      roleName: "ADMIN",
      role: "PROJECT_ADMIN",
      status: "ACTIVE",
    });
    expect(onProjectTeamChanged).toHaveBeenCalledWith({
      projectId: "proj_1",
      userIds: ["user_surendra"],
    });
  });

  it("rejects someone who is not a workspace member", async () => {
    const { runtime } = teamRuntime({
      members: [{ $id: "mem_actor", workspaceId: "ws_1", userId: "admin_1", role: "OWNER", displayName: "Ada" }],
      teams: [{ $id: "team_dev", projectId: "proj_1", workspaceId: "ws_1", name: "Developers" }],
    });
    const result = await callTool(
      "fairlx_project_team_member_add",
      { teamId: "team_dev", name: "Surendra" },
      runtime,
      ownerAuth,
    );
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0]?.text ?? "{}").error).toMatch(/workspace member/i);
  });

  it("stores lead from teamRole without writing unknown attributes", async () => {
    const { runtime, teamMembers } = teamRuntime({
      members: [
        { $id: "mem_actor", workspaceId: "ws_1", userId: "admin_1", role: "OWNER", displayName: "Ada" },
        {
          $id: "mem_fogef",
          workspaceId: "ws_1",
          userId: "user_fogef",
          role: "MEMBER",
          displayName: "fogef",
          displayEmail: "fogefe9321@94an.com",
        },
      ],
      teams: [{ $id: "team_dev", projectId: "proj_1", workspaceId: "ws_1", name: "Developers" }],
      projectRoles: [{ $id: "role_member", projectId: "proj_1", name: "MEMBER" }],
    });

    const result = await callTool(
      "fairlx_project_team_member_add",
      {
        teamId: "team_dev",
        projectId: "proj_1",
        name: "fogef",
        email: "fogefe9321@94an.com",
        teamRole: "Lead",
      },
      runtime,
      ownerAuth,
    );

    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0]?.text ?? "{}").member.role).toBe("lead");
    expect(teamMembers[0]).toMatchObject({ role: "lead", userId: "user_fogef" });
    expect(teamMembers[0]).not.toHaveProperty("teamRole");
  });

  it("creates a MEMBER role and project membership when the project has no roles", async () => {
    const { runtime, projectMembers, projectRoles } = teamRuntime({
      members: [
        { $id: "mem_actor", workspaceId: "ws_1", userId: "admin_1", role: "OWNER", displayName: "Ada" },
        {
          $id: "mem_fogef",
          workspaceId: "ws_1",
          userId: "user_fogef",
          role: "MEMBER",
          displayName: "fogef",
          displayEmail: "fogefe9321@94an.com",
        },
      ],
      teams: [{ $id: "team_dev", projectId: "proj_1", workspaceId: "ws_1", name: "Developers" }],
    });

    const result = await callTool(
      "fairlx_project_team_member_add",
      {
        projectId: "proj_1",
        teamName: "Developers",
        name: "fogef",
        email: "fogefe9321@94an.com",
      },
      runtime,
      ownerAuth,
    );

    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0]?.text ?? "{}")).toMatchObject({
      added: true,
      addedToProject: true,
      alreadyOnProject: false,
      member: { name: "fogef", team: "Developers" },
    });
    expect(projectRoles).toHaveLength(1);
    expect(projectRoles[0]).toMatchObject({ projectId: "proj_1", name: "MEMBER" });
    expect(projectMembers).toHaveLength(1);
    expect(projectMembers[0]).toMatchObject({
      userId: "user_fogef",
      projectId: "proj_1",
      roleId: projectRoles[0]?.$id,
      status: "ACTIVE",
    });
  });
});

describe("fairlx_project_member_add", () => {
  it("adds a workspace member to the project without a team", async () => {
    const { runtime, projectMembers, teamMembers, onProjectTeamChanged } = teamRuntime({
      members: [
        { $id: "mem_actor", workspaceId: "ws_1", userId: "admin_1", role: "OWNER", displayName: "Ada" },
        {
          $id: "mem_fogef",
          workspaceId: "ws_1",
          userId: "user_fogef",
          role: "MEMBER",
          displayName: "fogef",
          displayEmail: "fogefe9321@94an.com",
        },
      ],
      projectRoles: [{ $id: "role_member", projectId: "proj_1", name: "MEMBER" }],
    });

    const result = await callTool(
      "fairlx_project_member_add",
      { projectId: "proj_1", name: "fogef", email: "fogefe9321@94an.com" },
      runtime,
      ownerAuth,
    );

    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0]?.text ?? "{}")).toMatchObject({
      added: true,
      addedToProject: true,
      alreadyOnProject: false,
      member: { name: "fogef", email: "fogefe9321@94an.com" },
    });
    expect(projectMembers).toHaveLength(1);
    expect(projectMembers[0]).toMatchObject({
      workspaceId: "ws_1",
      projectId: "proj_1",
      userId: "user_fogef",
      roleId: "role_member",
      status: "ACTIVE",
    });
    expect(teamMembers).toHaveLength(0);
    expect(onProjectTeamChanged).toHaveBeenCalledWith({
      projectId: "proj_1",
      userIds: ["user_fogef"],
    });
  });
});

describe("fairlx_project_team_update", () => {
  it("renames a team", async () => {
    const { runtime, teams } = teamRuntime({
      teams: [{ $id: "team_dev", projectId: "proj_1", name: "Devs" }],
    });
    const result = await callTool(
      "fairlx_project_team_update",
      { teamId: "team_dev", name: "Developers" },
      runtime,
      ownerAuth,
    );
    expect(result.isError).toBeUndefined();
    expect(teams[0]?.name).toBe("Developers");
  });
});

describe("fairlx_project_team_member_remove", () => {
  it("removes a person from the team", async () => {
    const { runtime, teamMembers } = teamRuntime({
      members: [
        {
          $id: "mem_surendra",
          workspaceId: "ws_1",
          userId: "user_surendra",
          role: "ADMIN",
          displayName: "Surendra",
          displayEmail: "surendra@fairlx.dev",
        },
      ],
      teams: [{ $id: "team_dev", projectId: "proj_1", name: "Developers" }],
      teamMembers: [
        { $id: "tm_1", teamId: "team_dev", projectId: "proj_1", userId: "user_surendra" },
      ],
    });
    const result = await callTool(
      "fairlx_project_team_member_remove",
      { teamId: "team_dev", name: "Surendra" },
      runtime,
      ownerAuth,
    );
    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0]?.text ?? "{}")).toMatchObject({
      removed: true,
      member: { name: "Surendra", team: "Developers" },
    });
    expect(teamMembers).toHaveLength(0);
  });
});

describe("fairlx_project_team_delete", () => {
  it("deletes the team and its memberships", async () => {
    const { runtime, teams, teamMembers } = teamRuntime({
      teams: [{ $id: "team_dev", projectId: "proj_1", name: "Developers" }],
      teamMembers: [
        { $id: "tm_1", teamId: "team_dev", projectId: "proj_1", userId: "user_surendra" },
      ],
    });
    const result = await callTool(
      "fairlx_project_team_delete",
      { teamId: "team_dev" },
      runtime,
      ownerAuth,
    );
    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0]?.text ?? "{}")).toMatchObject({
      deleted: true,
      team: { name: "Developers" },
    });
    expect(teams).toHaveLength(0);
    expect(teamMembers).toHaveLength(0);
  });
});

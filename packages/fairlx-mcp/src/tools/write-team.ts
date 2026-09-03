import { forbiddenError, invalidParams, notFoundError } from "../protocol/errors";
import type { McpToolResult } from "../protocol/types";
import type { AuthContext } from "../auth/context";
import { hasScope } from "../auth/scopes";
import { PERMISSIONS, type McpRuntime } from "../runtime/types";
import { hydrateMembers, toolResult, withId } from "../runtime/output";
import { requireProjectAccess } from "../runtime/rbac";
import { loadProject } from "../runtime/tenant";
import { audit, listAllDocuments, optionalString, requireString } from "./helpers";
import { isWorkspaceAdminRole, matchWorkspaceMember, type NamedMember } from "./member-match";

const DEFAULT_TEAM_COLOR = "#4F46E5";
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

function optionalColor(args: Record<string, unknown>): string | undefined {
  const raw = optionalString(args, "color");
  if (!raw) return undefined;
  if (!HEX_COLOR.test(raw)) {
    throw invalidParams("color must be a hex value like #4F46E5");
  }
  return raw;
}

async function requireTeamManage(
  runtime: McpRuntime,
  auth: AuthContext,
  projectId: string
) {
  if (!hasScope(auth.scopes, ["admin:manage"])) {
    throw forbiddenError("Insufficient MCP scope");
  }
  return requireProjectAccess(runtime, auth, projectId, PERMISSIONS.MANAGE_TEAMS, ["admin:manage"]);
}

async function loadTeam(
  runtime: McpRuntime,
  teamId: string
): Promise<Record<string, unknown>> {
  try {
    return await runtime.store.get<Record<string, unknown>>(runtime.collections.projectTeams, teamId);
  } catch {
    throw notFoundError("Not found");
  }
}

async function resolveTeam(
  args: Record<string, unknown>,
  runtime: McpRuntime
): Promise<Record<string, unknown>> {
  const teamId = optionalString(args, "teamId");
  if (teamId) return loadTeam(runtime, teamId);

  const projectId = optionalString(args, "projectId");
  const teamName = optionalString(args, "teamName") || optionalString(args, "team");
  if (!projectId || !teamName) {
    throw invalidParams("Provide teamId, or projectId and teamName");
  }
  const teams = await listAllDocuments(runtime, runtime.collections.projectTeams, [
    { type: "equal", field: "projectId", value: projectId },
  ]);
  const needle = teamName.trim().toLowerCase();
  const matches = teams.filter((team) => String(team.name ?? "").trim().toLowerCase() === needle);
  if (matches.length === 0) {
    throw notFoundError("Not found");
  }
  if (matches.length > 1) {
    throw invalidParams(`Several teams are named "${teamName}". Use teamId.`);
  }
  return matches[0]!;
}

async function namedWorkspacePeople(runtime: McpRuntime, workspaceId: string) {
  const docs = await listAllDocuments(runtime, runtime.collections.members, [
    { type: "equal", field: "workspaceId", value: workspaceId },
  ]);
  const hydrated = await hydrateMembers(runtime, docs);
  const named: NamedMember[] = docs.map((doc, index) => ({
    id: String(doc.userId ?? ""),
    name: hydrated[index]?.name ?? "",
    email: hydrated[index]?.email ?? "",
    role: hydrated[index]?.role ?? String(doc.role ?? "MEMBER"),
    status: hydrated[index]?.status ?? String(doc.status ?? "ACTIVE"),
  }));
  return { docs, named };
}

function matchPerson(query: string, named: NamedMember[]) {
  const matched = matchWorkspaceMember(query, named);
  if (matched.kind === "none") {
    return {
      error: true as const,
      payload: {
        error: `No workspace member matches "${query}". Add them to the workspace first.`,
        members: named.map(({ name, email, role }) => ({ name, email, role })),
      },
    };
  }
  if (matched.kind === "many") {
    return {
      error: true as const,
      payload: {
        error: "Several people match. Say which one.",
        matches: matched.members.map(({ name, email, role }) => ({ name, email, role })),
      },
    };
  }
  return { error: false as const, member: matched.member };
}

function canonicalRoleName(name: string): string {
  const folded = name.toUpperCase().replace(/[^A-Z]/g, "");
  if (folded.includes("OWNER")) return "OWNER";
  if (folded.includes("ADMIN")) return "ADMIN";
  if (folded.includes("VIEWER")) return "VIEWER";
  if (folded.includes("MEMBER")) return "MEMBER";
  return folded;
}

function teamMemberRole(teamRole?: string): "lead" | "member" {
  const folded = (teamRole ?? "").toLowerCase();
  if (folded.includes("lead") || folded === "admin" || folded === "owner") return "lead";
  return "member";
}

async function findProjectRole(
  runtime: McpRuntime,
  projectId: string,
  workspaceRole: string
): Promise<{ id: string; name: string } | undefined> {
  const collection = runtime.collections.projectRoles;
  if (!collection) return undefined;
  const roles = await listAllDocuments(runtime, collection, [
    { type: "equal", field: "projectId", value: projectId },
  ]);
  const wanted = isWorkspaceAdminRole(workspaceRole)
    ? ["ADMIN", "OWNER", "MEMBER"]
    : ["MEMBER", "ADMIN"];
  for (const name of wanted) {
    const match = roles.find((role) => canonicalRoleName(String(role.name ?? "")) === name);
    if (match) return { id: String(match.$id ?? match.id ?? ""), name: String(match.name ?? name) };
  }
  const fallback = roles[0];
  if (!fallback) return undefined;
  return { id: String(fallback.$id ?? fallback.id ?? ""), name: String(fallback.name ?? "MEMBER") };
}

async function ensureProjectMember(
  runtime: McpRuntime,
  auth: AuthContext,
  projectId: string,
  workspaceId: string,
  userId: string,
  workspaceRole: string
): Promise<boolean> {
  const existing = await runtime.store.list<Record<string, unknown>>(runtime.collections.projectMembers, [
    { type: "equal", field: "projectId", value: projectId },
    { type: "equal", field: "userId", value: userId },
    { type: "limit", value: 1 },
  ]);
  const doc = existing.documents[0];
  const role = isWorkspaceAdminRole(workspaceRole) ? "PROJECT_ADMIN" : "MEMBER";
  if (!doc) {
    const projectRole = await findProjectRole(runtime, projectId, workspaceRole);
    if (!projectRole) return false;
    await runtime.store.create(runtime.collections.projectMembers, {
      workspaceId,
      projectId,
      userId,
      teamId: "",
      role,
      roleId: projectRole.id,
      roleName: projectRole.name,
      status: "ACTIVE",
      addedBy: auth.actorUserId,
      joinedAt: runtime.now(),
    });
    return true;
  }
  const status = String(doc.status ?? "ACTIVE");
  if (status === "REMOVED" || status === "INVITED") {
    await runtime.store.update(runtime.collections.projectMembers, String(doc.$id ?? doc.id ?? ""), {
      status: "ACTIVE",
      role: String(doc.role || role),
      removedAt: null,
      removedBy: null,
    });
    return true;
  }
  return false;
}

async function notifyTeamChange(runtime: McpRuntime, projectId: string, userIds: string[]) {
  try {
    await runtime.onProjectTeamChanged?.({ projectId, userIds: userIds.filter(Boolean) });
  } catch {
    // Cache invalidation must never fail the write.
  }
}

export async function projectTeamCreate(
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext
): Promise<McpToolResult> {
  const projectId = requireString(args, "projectId");
  const name = requireString(args, "name").trim();
  await requireTeamManage(runtime, auth, projectId);
  const project = await loadProject(runtime, auth, projectId);
  const workspaceId = String(project.workspaceId ?? "");

  const existing = await runtime.store.list<Record<string, unknown>>(runtime.collections.projectTeams, [
    { type: "equal", field: "projectId", value: projectId },
    { type: "equal", field: "name", value: name },
    { type: "limit", value: 1 },
  ]);
  if (existing.documents.length > 0) {
    return toolResult({ error: `A team named "${name}" already exists in this project.` }, true);
  }

  const team = await runtime.store.create<Record<string, unknown>>(runtime.collections.projectTeams, {
    projectId,
    workspaceId,
    name,
    description: optionalString(args, "description") ?? null,
    color: optionalColor(args) ?? DEFAULT_TEAM_COLOR,
    createdBy: auth.actorUserId,
  });
  await audit(runtime, {
    workspaceId,
    projectId,
    userId: auth.actorUserId,
    action: "mcp.project_team.create",
    resourceType: "project_team",
    resourceId: String(team.$id ?? team.id ?? ""),
    resourceName: name,
  });
  return toolResult({ team: withId(team), created: true });
}

export async function projectTeamUpdate(
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext
): Promise<McpToolResult> {
  const teamId = requireString(args, "teamId");
  const team = await loadTeam(runtime, teamId);
  const projectId = String(team.projectId ?? "");
  await requireTeamManage(runtime, auth, projectId);

  const patch: Record<string, unknown> = {};
  const name = optionalString(args, "name")?.trim();
  if (name && name !== String(team.name ?? "")) {
    const existing = await runtime.store.list<Record<string, unknown>>(runtime.collections.projectTeams, [
      { type: "equal", field: "projectId", value: projectId },
      { type: "equal", field: "name", value: name },
      { type: "limit", value: 1 },
    ]);
    if (existing.documents.length > 0) {
      return toolResult({ error: `A team named "${name}" already exists in this project.` }, true);
    }
    patch.name = name;
  }
  if (args.description !== undefined) {
    patch.description = optionalString(args, "description") ?? null;
  }
  const color = optionalColor(args);
  if (color) patch.color = color;
  if (Object.keys(patch).length === 0) {
    return toolResult({ team: withId(team), unchanged: true });
  }

  const updated = await runtime.store.update<Record<string, unknown>>(
    runtime.collections.projectTeams,
    teamId,
    patch
  );
  await audit(runtime, {
    projectId,
    userId: auth.actorUserId,
    action: "mcp.project_team.update",
    resourceType: "project_team",
    resourceId: teamId,
    resourceName: String(updated.name ?? team.name ?? ""),
  });
  return toolResult({ team: withId(updated) });
}

export async function projectTeamDelete(
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext
): Promise<McpToolResult> {
  const teamId = requireString(args, "teamId");
  const team = await loadTeam(runtime, teamId);
  const projectId = String(team.projectId ?? "");
  await requireTeamManage(runtime, auth, projectId);

  const members = await listAllDocuments(runtime, runtime.collections.projectTeamMembers, [
    { type: "equal", field: "teamId", value: teamId },
  ]);
  for (const member of members) {
    await runtime.store.delete(
      runtime.collections.projectTeamMembers,
      String(member.$id ?? member.id ?? "")
    );
  }

  const permissionsCollection = runtime.collections.projectPermissions;
  if (permissionsCollection) {
    const permissions = await listAllDocuments(runtime, permissionsCollection, [
      { type: "equal", field: "assignedToTeamId", value: teamId },
    ]);
    for (const permission of permissions) {
      await runtime.store.delete(permissionsCollection, String(permission.$id ?? permission.id ?? ""));
    }
  }

  await runtime.store.delete(runtime.collections.projectTeams, teamId);
  await notifyTeamChange(
    runtime,
    projectId,
    members.map((member) => String(member.userId ?? ""))
  );
  await audit(runtime, {
    projectId,
    userId: auth.actorUserId,
    action: "mcp.project_team.delete",
    resourceType: "project_team",
    resourceId: teamId,
    resourceName: String(team.name ?? ""),
  });
  return toolResult({ deleted: true, team: { name: String(team.name ?? "") } });
}

export async function projectTeamMemberAdd(
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext
): Promise<McpToolResult> {
  const team = await resolveTeam(args, runtime);
  const projectId = String(team.projectId ?? "");
  const teamId = String(team.$id ?? team.id ?? "");
  await requireTeamManage(runtime, auth, projectId);
  const project = await loadProject(runtime, auth, projectId);
  const workspaceId = String(project.workspaceId ?? team.workspaceId ?? "");

  const query = optionalString(args, "email") || optionalString(args, "name") || "";
  if (!query) throw invalidParams("Provide the person's name or email");

  const { docs, named } = await namedWorkspacePeople(runtime, workspaceId);
  const matched = matchPerson(query, named);
  if (matched.error) return toolResult(matched.payload, true);

  const userId = matched.member.id;
  const workspaceDoc = docs.find((doc) => String(doc.userId ?? "") === userId);
  const addedToProject = await ensureProjectMember(
    runtime,
    auth,
    projectId,
    workspaceId,
    userId,
    String(workspaceDoc?.role ?? matched.member.role)
  );

  const existing = await runtime.store.list<Record<string, unknown>>(runtime.collections.projectTeamMembers, [
    { type: "equal", field: "teamId", value: teamId },
    { type: "equal", field: "userId", value: userId },
    { type: "limit", value: 1 },
  ]);
  if (existing.documents.length > 0) {
    return toolResult(
      {
        error: `${matched.member.name || matched.member.email} is already on ${String(team.name ?? "this team")}.`,
        member: { name: matched.member.name, email: matched.member.email },
      },
      true
    );
  }

  const teamRole = optionalString(args, "teamRole");
  const created = await runtime.store.create<Record<string, unknown>>(runtime.collections.projectTeamMembers, {
    projectId,
    teamId,
    userId,
    role: teamMemberRole(teamRole),
    teamRole: teamRole ?? null,
    joinedAt: runtime.now(),
    addedAt: runtime.now(),
    addedBy: auth.actorUserId,
  });
  await notifyTeamChange(runtime, projectId, [userId]);
  await audit(runtime, {
    workspaceId,
    projectId,
    userId: auth.actorUserId,
    action: "mcp.project_team_member.add",
    resourceType: "project_team_member",
    resourceId: String(created.$id ?? created.id ?? ""),
    resourceName: matched.member.name,
    metadata: { teamId, teamName: team.name },
  });
  return toolResult({
    member: {
      name: matched.member.name,
      email: matched.member.email,
      team: String(team.name ?? ""),
      teamRole: teamRole ?? null,
    },
    added: true,
    addedToProject,
  });
}

export async function projectTeamMemberRemove(
  args: Record<string, unknown>,
  runtime: McpRuntime,
  auth: AuthContext
): Promise<McpToolResult> {
  const team = await resolveTeam(args, runtime);
  const projectId = String(team.projectId ?? "");
  const teamId = String(team.$id ?? team.id ?? "");
  await requireTeamManage(runtime, auth, projectId);

  const query = optionalString(args, "email") || optionalString(args, "name") || "";
  if (!query) throw invalidParams("Provide the member's name or email");

  const docs = await listAllDocuments(runtime, runtime.collections.projectTeamMembers, [
    { type: "equal", field: "teamId", value: teamId },
  ]);
  const hydrated = await hydrateMembers(runtime, docs);
  const named: NamedMember[] = docs.map((doc, index) => ({
    id: String(doc.userId ?? ""),
    name: hydrated[index]?.name ?? "",
    email: hydrated[index]?.email ?? "",
    role: String(doc.teamRole ?? ""),
    status: "ACTIVE",
  }));
  const matched = matchWorkspaceMember(query, named);
  if (matched.kind === "none") {
    return toolResult(
      {
        error: `No team member matches "${query}".`,
        members: named.map(({ name, email }) => ({ name, email })),
      },
      true
    );
  }
  if (matched.kind === "many") {
    return toolResult(
      {
        error: "Several people match. Say which one.",
        matches: matched.members.map(({ name, email }) => ({ name, email })),
      },
      true
    );
  }

  const membership = docs.find((doc) => String(doc.userId ?? "") === matched.member.id);
  if (!membership) throw notFoundError("Not found");
  await runtime.store.delete(
    runtime.collections.projectTeamMembers,
    String(membership.$id ?? membership.id ?? "")
  );
  await notifyTeamChange(runtime, projectId, [matched.member.id]);
  await audit(runtime, {
    projectId,
    userId: auth.actorUserId,
    action: "mcp.project_team_member.remove",
    resourceType: "project_team_member",
    resourceId: String(membership.$id ?? membership.id ?? ""),
    resourceName: matched.member.name,
  });
  return toolResult({
    removed: true,
    member: { name: matched.member.name, email: matched.member.email, team: String(team.name ?? "") },
  });
}

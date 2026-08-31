import { ID, type Databases } from "node-appwrite";

import { DATABASE_ID, PROJECTS_ID } from "@/config";
import { getMember } from "@/features/members/utils";
import { seedProjectRolesAndAssignOwner } from "@/features/projects/lib/utils";
import { CK, invalidateCache } from "@/lib/redis";

export async function createFairlxProject(params: {
  databases: Databases;
  userId: string;
  workspaceId: string;
  name: string;
  description?: string;
}): Promise<{ id: string; name: string; workspaceId: string }> {
  const workspaceId = params.workspaceId.trim();
  const name = params.name.trim();
  if (!workspaceId) throw new Error("workspaceId is required.");
  if (!name) throw new Error("Project name is required.");

  const member = await getMember({
    databases: params.databases,
    workspaceId,
    userId: params.userId,
  });
  if (!member) {
    throw new Error("You are not a member of that workspace.");
  }

  const project = await params.databases.createDocument(DATABASE_ID, PROJECTS_ID, ID.unique(), {
    name,
    description: params.description?.trim() || undefined,
    workspaceId,
  });

  await seedProjectRolesAndAssignOwner(params.databases, project.$id, workspaceId, params.userId);
  await invalidateCache(CK.projectList(workspaceId), CK.authLifecycle(params.userId));

  return { id: project.$id, name, workspaceId };
}

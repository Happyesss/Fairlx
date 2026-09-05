import { Query, type Models } from "node-appwrite";

import { DATABASE_ID, MEMBERS_ID } from "@/config";

type DatabasesLike = {
  listDocuments: (
    databaseId: string,
    collectionId: string,
    queries?: string[]
  ) => Promise<Models.DocumentList<Models.Document>>;
};

/**
 * Work items store assigneeIds as workspace membership document ids.
 * Older agent writes used Appwrite user ids. Resolve both so the board
 * matches Kanban / backlog instead of showing Unassigned.
 */
export async function listMembersForAssigneeIds(
  databases: DatabasesLike,
  assigneeIds: Iterable<string>,
  workspaceId?: string
): Promise<Models.Document[]> {
  const ids = [...new Set([...assigneeIds].map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return [];

  const byMembership = await databases
    .listDocuments(DATABASE_ID, MEMBERS_ID, [
      Query.equal("$id", ids.length === 1 ? ids[0]! : ids),
      Query.limit(Math.max(ids.length, 1)),
    ])
    .catch(() => ({ documents: [] as Models.Document[] }));

  const found = new Set(byMembership.documents.map((doc) => doc.$id));
  const leftover = ids.filter((id) => !found.has(id));
  if (leftover.length === 0) return byMembership.documents;

  const userQueries = [
    Query.equal("userId", leftover.length === 1 ? leftover[0]! : leftover),
    Query.limit(Math.max(leftover.length, 1)),
  ];
  if (workspaceId) userQueries.push(Query.equal("workspaceId", workspaceId));

  const byUser = await databases
    .listDocuments(DATABASE_ID, MEMBERS_ID, userQueries)
    .catch(() => ({ documents: [] as Models.Document[] }));

  const merged = new Map<string, Models.Document>();
  for (const doc of [...byMembership.documents, ...byUser.documents]) {
    merged.set(doc.$id, doc);
  }
  return [...merged.values()];
}

export function indexAssigneesByStoredId<T extends { $id: string; userId?: string }>(
  members: T[]
): Map<string, T> {
  const map = new Map<string, T>();
  for (const member of members) {
    map.set(member.$id, member);
    if (member.userId) map.set(member.userId, member);
  }
  return map;
}

export function pickAssignees<T extends { $id: string; userId?: string }>(
  assigneeIds: string[] | undefined,
  members: T[]
): T[] {
  if (!assigneeIds?.length) return [];
  const index = indexAssigneesByStoredId(members);
  return assigneeIds.flatMap((id) => {
    const member = index.get(id);
    return member ? [member] : [];
  });
}

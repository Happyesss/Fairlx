import { Databases, Query } from "node-appwrite";
import { DATABASE_ID, PROJECTS_ID, WORK_ITEMS_ID } from "@/config";
import { Project } from "@/features/projects/types";
import { WorkItem } from "@/features/sprints/types";

/**
 * Generate a unique work item key for a project (e.g. "PROJ-42").
 * Prefix is the first 4 letters of the project name. Falls back if the
 * (projectId, $createdAt) index is missing.
 */
export async function generateWorkItemKey(
  databases: Databases,
  projectId: string
): Promise<string> {
  const project = (await databases.getDocument(
    DATABASE_ID,
    PROJECTS_ID,
    projectId
  )) as Project;

  const prefix =
    project.name
      .replace(/[^a-zA-Z]/g, "")
      .substring(0, 4)
      .toUpperCase() || "PROJ";

  let workItems;
  try {
    workItems = await databases.listDocuments<WorkItem>(DATABASE_ID, WORK_ITEMS_ID, [
      Query.equal("projectId", projectId),
      Query.orderDesc("$createdAt"),
      Query.limit(100),
    ]);
  } catch {
    workItems = await databases.listDocuments<WorkItem>(DATABASE_ID, WORK_ITEMS_ID, [
      Query.equal("projectId", projectId),
      Query.limit(100),
    ]);
  }

  let highestNumber = 0;
  const keyPattern = new RegExp(`^${prefix}-(\\d+)$`);

  for (const item of workItems.documents) {
    const match = item.key?.match(keyPattern);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > highestNumber) {
        highestNumber = num;
      }
    }
  }

  if (highestNumber === 0) {
    highestNumber = workItems.total;
  }

  return `${prefix}-${highestNumber + 1}`;
}

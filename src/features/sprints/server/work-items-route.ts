import { ID, Query, Databases } from "node-appwrite";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

import { DATABASE_ID, WORK_ITEMS_ID, PROJECTS_ID, MEMBERS_ID, COMMENTS_ID, CUSTOM_COLUMNS_ID, WORKFLOW_STATUSES_ID } from "@/config";
import { sessionMiddleware } from "@/lib/session-middleware";
import { createAdminClient } from "@/lib/appwrite";
import { batchGetUsers } from "@/lib/batch-users";
import { getMember } from "@/features/members/utils";
import { Project } from "@/features/projects/types";
import { logComputeUsage, getComputeUnits } from "@/lib/usage-metering";
import {
  dispatchWorkitemEvent,
} from "@/lib/notifications";
import {
  createTaskCreatedEvent,
  createAssignedEvent,
  createUnassignedEvent,
  createStatusChangedEvent,
  createCompletedEvent,
  createPriorityChangedEvent,
  createDueDateChangedEvent,
  createMentionEvent,
  createDeletedEvent,
  createTaskUpdatedEvent,
} from "@/lib/notifications/events";
import { Task } from "@/features/tasks/types";
import { extractMentions, extractSnippet } from "@/lib/mentions";

import {
  createWorkItemSchema,
  updateWorkItemSchema,
  bulkMoveWorkItemsSchema,
  reorderWorkItemsSchema,
  splitWorkItemSchema,
} from "../schemas";
import {
  WorkItem,
  WorkItemType,
  WorkItemStatus,
  WorkItemPriority,
  PopulatedWorkItem,
} from "../types";


// Generate unique work item key
async function generateWorkItemKey(
  databases: Awaited<ReturnType<typeof createAdminClient>>["databases"],
  projectId: string
): Promise<string> {
  const project = await databases.getDocument(
    DATABASE_ID,
    PROJECTS_ID,
    projectId
  ) as Project;

  // Get project prefix (first 3-4 letters of project name in uppercase)
  const prefix = project.name
    .replace(/[^a-zA-Z]/g, "")
    .substring(0, 4)
    .toUpperCase() || "PROJ";

  // Get all work items for this project to find the highest key number
  let workItems;
  try {
    workItems = await databases.listDocuments<WorkItem>(
      DATABASE_ID,
      WORK_ITEMS_ID,
      [
        Query.equal("projectId", projectId),
        Query.orderDesc("$createdAt"),
        Query.limit(100), // Get more items to find the highest number
      ]
    );
  } catch {
    // Fallback if index on projectId, $createdAt doesn't exist
    workItems = await databases.listDocuments<WorkItem>(
      DATABASE_ID,
      WORK_ITEMS_ID,
      [
        Query.equal("projectId", projectId),
        Query.limit(100),
      ]
    );
  }

  // Extract key numbers and find the highest one
  let highestNumber = 0;
  const keyPattern = new RegExp(`^${prefix}-(\\d+)$`);

  for (const item of workItems.documents) {
    const match = item.key.match(keyPattern);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > highestNumber) {
        highestNumber = num;
      }
    }
  }

  // If no items found, also check the total count as a fallback
  if (highestNumber === 0) {
    highestNumber = workItems.total;
  }

  const nextNumber = highestNumber + 1;
  return `${prefix}-${nextNumber}`;
}

/**
 * Resolve status ID or key to a human-readable name.
 * If it's a standard WorkItemStatus, returns it as-is (formatted).
 * If it's a custom column ID, looks up the column name.
 * Falls back to the original value if not found.
 */
async function resolveStatusName(
  databases: Databases,
  status: string,
  workspaceId: string
): Promise<string> {
  // Check if it's a standard WorkItemStatus enum value
  if (Object.values(WorkItemStatus).includes(status as WorkItemStatus)) {
    // Format the enum value nicely (e.g., "IN_PROGRESS" -> "In Progress")
    return status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  }

  // Otherwise, try to look up in custom columns
  try {
    const customColumns = await databases.listDocuments(
      DATABASE_ID,
      CUSTOM_COLUMNS_ID,
      [Query.equal("workspaceId", workspaceId), Query.equal("$id", status)]
    );
    
    if (customColumns.documents.length > 0) {
      return customColumns.documents[0].name as string;
    }
  } catch {
    // Silent failure - return status as-is
  }

  // Also check workflow statuses (for workflow-managed statuses)
  try {
    const workflowStatuses = await databases.listDocuments(
      DATABASE_ID,
      WORKFLOW_STATUSES_ID,
      [Query.equal("$id", status)]
    );
    
    if (workflowStatuses.documents.length > 0) {
      return workflowStatuses.documents[0].name as string;
    }
  } catch {
    // Silent failure - return status as-is
  }

  return status;
}

const app = new Hono()
  // Get work items with filters
  .get(
    "/",
    sessionMiddleware,
    zValidator(
      "query",
      z.object({
        workspaceId: z.string(),
        projectId: z.string().optional(),
        sprintId: z.string().optional().nullable(),
        type: z.union([z.nativeEnum(WorkItemType), z.string()]).optional(),
        status: z.union([z.nativeEnum(WorkItemStatus), z.string()]).optional(),
        priority: z.union([z.nativeEnum(WorkItemPriority), z.string()]).optional(),
        assigneeId: z.string().optional(),
        epicId: z.string().optional().nullable(),
        parentId: z.string().optional().nullable(),
        flagged: z.string().transform(val => val === "true").optional(),
        search: z.string().optional(),
        includeChildren: z.string().transform(val => val === "true").optional(),
        limit: z.coerce.number().min(1).max(1000).optional(),
      })
    ),
    async (c) => {
      const { users } = await createAdminClient();
      const databases = c.get("databases");
      const user = c.get("user");

      const {
        workspaceId,
        projectId,
        sprintId,
        type,
        status,
        priority,
        assigneeId,
        epicId,
        parentId,
        flagged,
        search,
        includeChildren,
        limit,
      } = c.req.valid("query");

      const member = await getMember({
        databases,
        workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const query = [
        Query.equal("workspaceId", workspaceId),
        Query.orderAsc("position"),
      ];

      if (projectId) {
        query.push(Query.equal("projectId", projectId));
      }

      if (sprintId !== undefined) {
        if (sprintId === null || sprintId === "null") {
          query.push(Query.isNull("sprintId"));
        } else {
          query.push(Query.equal("sprintId", sprintId));
        }
      }

      if (type) {
        query.push(Query.equal("type", type));
      }

      if (status) {
        query.push(Query.equal("status", status));
      }

      if (priority) {
        query.push(Query.equal("priority", priority));
      }

      if (assigneeId) {
        query.push(Query.equal("assigneeIds", assigneeId));
      }

      if (epicId !== undefined) {
        if (epicId === null || epicId === "null") {
          query.push(Query.isNull("epicId"));
        } else {
          query.push(Query.equal("epicId", epicId));
        }
      }

      if (parentId !== undefined) {
        if (parentId === null || parentId === "null") {
          query.push(Query.isNull("parentId"));
        } else {
          query.push(Query.equal("parentId", parentId));
        }
      }

      if (flagged) {
        query.push(Query.equal("flagged", true));
      }

      if (search) {
        query.push(Query.search("title", search));
      }

      // Always set a limit - Appwrite defaults to 25 if not specified
      // Use provided limit or default to 500 for reasonable performance
      query.push(Query.limit(limit || 500));

      const workItems = await databases.listDocuments<WorkItem>(
        DATABASE_ID,
        WORK_ITEMS_ID,
        query
      );

      // Enforce numerical sorting by work item key (e.g. FAIR-2 before FAIR-10) to fix list shuffling.
      workItems.documents.sort((a, b) => {
        const numA = parseInt(a.key.split("-")[1] || "0", 10);
        const numB = parseInt(b.key.split("-")[1] || "0", 10);
        return numA - numB;
      });

      // Populate assignees and related items
      // First, collect all unique assignee IDs from all work items
      const allAssigneeIds = new Set<string>();
      workItems.documents.forEach((workItem) => {
        if (workItem.assigneeIds && Array.isArray(workItem.assigneeIds)) {
          workItem.assigneeIds.forEach(id => {
            if (id && typeof id === 'string') {
              allAssigneeIds.add(id);
            }
          });
        }
      });

      // Fetch all members at once (assigneeIds are member document IDs)
      const membersData = allAssigneeIds.size > 0
        ? await databases.listDocuments(
          DATABASE_ID,
          MEMBERS_ID,
          [Query.equal("$id", Array.from(allAssigneeIds))]
        )
        : { documents: [] };

      // OPTIMIZED: Batch-fetch all related users in one call (was N+1 users.get per member)
      const memberUserIds = membersData.documents.map(m => m.userId);
      const userMap = await batchGetUsers(users, memberUserIds);

      // Build a map of member ID -> user data for quick lookup
      const assigneeMap = new Map<string, { $id: string; name: string; email: string; profileImageUrl: string | null }>();

      membersData.documents.forEach((member) => {
        const userData = userMap.get(member.userId);
        if (userData) {
          assigneeMap.set(member.$id, {
            $id: member.$id,
            name: userData.name || userData.email,
            email: userData.email,
            profileImageUrl: userData.prefs?.profileImageUrl || null,
          });
        }
      });

      // ========================================
      // OPTIMIZED: Batch fetch all related data in bulk instead of per-item
      // ========================================

      // Collect all unique IDs we need to fetch
      const epicIds = new Set<string>();
      const parentIds = new Set<string>();
      const projectIds = new Set<string>();
      const workItemIds = workItems.documents.map(w => w.$id);

      workItems.documents.forEach((workItem) => {
        if (workItem.epicId) epicIds.add(workItem.epicId);
        if (workItem.parentId) parentIds.add(workItem.parentId);
        if (workItem.projectId) projectIds.add(workItem.projectId);
      });

      // Batch fetch epics and parents (they're both work items)
      const relatedWorkItemIds = [...new Set([...epicIds, ...parentIds])];
      const relatedWorkItemsMap = new Map<string, { $id: string; key: string; title: string }>();

      if (relatedWorkItemIds.length > 0) {
        try {
          const relatedWorkItems = await databases.listDocuments<WorkItem>(
            DATABASE_ID,
            WORK_ITEMS_ID,
            [Query.equal("$id", relatedWorkItemIds), Query.limit(relatedWorkItemIds.length)]
          );
          relatedWorkItems.documents.forEach((item) => {
            relatedWorkItemsMap.set(item.$id, {
              $id: item.$id,
              key: item.key,
              title: item.title,
            });
          });
        } catch {
          // Related items fetch failed - continue without them
        }
      }

      // Batch fetch all projects
      const projectMap = new Map<string, { $id: string; name: string; imageUrl?: string }>();
      const projectIdArray = Array.from(projectIds);

      if (projectIdArray.length > 0) {
        try {
          const projects = await databases.listDocuments<Project>(
            DATABASE_ID,
            PROJECTS_ID,
            [Query.equal("$id", projectIdArray), Query.limit(projectIdArray.length)]
          );
          projects.documents.forEach((proj) => {
            projectMap.set(proj.$id, {
              $id: proj.$id,
              name: proj.name,
              imageUrl: proj.imageUrl || undefined,
            });
          });
        } catch {
          // Projects fetch failed - continue without them
        }
      }

      // Batch fetch all children counts in ONE query
      const childrenCountMap = new Map<string, number>();
      const childrenByParentMap = new Map<string, PopulatedWorkItem[]>();

      if (workItemIds.length > 0) {
        try {
          const allChildren = await databases.listDocuments<WorkItem>(
            DATABASE_ID,
            WORK_ITEMS_ID,
            [Query.equal("parentId", workItemIds), Query.limit(2000)]
          );
          // Count children per parent and optionally store children data
          allChildren.documents.forEach((child) => {
            const parentId = child.parentId;
            if (parentId) {
              childrenCountMap.set(parentId, (childrenCountMap.get(parentId) || 0) + 1);

              // If includeChildren is requested, store the child data
              if (includeChildren) {
                const existing = childrenByParentMap.get(parentId) || [];
                existing.push(child as PopulatedWorkItem);
                childrenByParentMap.set(parentId, existing);
              }
            }
          });
        } catch {
          // Children fetch failed - continue with 0 counts
        }
      }

      // Batch fetch comment counts for all work items
      const commentCountMap = new Map<string, number>();
      if (workItemIds.length > 0) {
        try {
          const comments = await databases.listDocuments(
            DATABASE_ID,
            COMMENTS_ID,
            [
              Query.equal("taskId", workItemIds),
              Query.limit(5000),
            ]
          );
          comments.documents.forEach((comment) => {
            const taskId = comment.taskId as string;
            commentCountMap.set(taskId, (commentCountMap.get(taskId) || 0) + 1);
          });
        } catch {
          // Comments collection might not exist yet, ignore errors
        }
      }

      // Now populate work items using the pre-fetched maps (NO individual queries!)
      const populatedWorkItems = workItems.documents.map((workItem) => {
        // Get assignees from the pre-built map
        const assignees = (workItem.assigneeIds || [])
          .map(id => assigneeMap.get(id))
          .filter((a): a is NonNullable<typeof a> => a !== null);

        // Get epic from map
        const epic = workItem.epicId ? relatedWorkItemsMap.get(workItem.epicId) || null : null;

        // Get parent from map
        const parent = workItem.parentId ? relatedWorkItemsMap.get(workItem.parentId) || null : null;

        // Get project from map
        const project = workItem.projectId ? projectMap.get(workItem.projectId) || null : null;

        // Get children count from map
        const childrenCount = childrenCountMap.get(workItem.$id) || 0;

        // Get children data if requested
        const childrenData = includeChildren ? childrenByParentMap.get(workItem.$id) : undefined;

        return {
          ...workItem,
          type: workItem.type || "TASK",
          assignees,
          epic,
          parent,
          project,
          childrenCount,
          children: childrenData,
          commentCount: commentCountMap.get(workItem.$id) || 0,
        };
      });

      return c.json({
        data: {
          ...workItems,
          documents: populatedWorkItems,
        },
      });
    }
  )
  // Get epics (work items of type EPIC)
  .get(
    "/epics",
    sessionMiddleware,
    zValidator(
      "query",
      z.object({
        workspaceId: z.string(),
        projectId: z.string().optional(),
      })
    ),
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");

      const { workspaceId, projectId } = c.req.valid("query");

      const member = await getMember({
        databases,
        workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const query = [
        Query.equal("workspaceId", workspaceId),
        Query.equal("type", WorkItemType.EPIC),
        Query.orderDesc("$createdAt"),
      ];

      if (projectId) {
        query.push(Query.equal("projectId", projectId));
      }

      const epics = await databases.listDocuments<WorkItem>(
        DATABASE_ID,
        WORK_ITEMS_ID,
        query
      );

      return c.json({ data: epics });
    }
  )
  // Get a single work item
  .get(
    "/:workItemId",
    sessionMiddleware,
    async (c) => {
      const { users } = await createAdminClient();
      const databases = c.get("databases");
      const user = c.get("user");
      const { workItemId } = c.req.param();

      const workItem = await databases.getDocument<WorkItem>(
        DATABASE_ID,
        WORK_ITEMS_ID,
        workItemId
      );

      const member = await getMember({
        databases,
        workspaceId: workItem.workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      // Populate assignees - assigneeIds are member document IDs
      const membersData = workItem.assigneeIds && workItem.assigneeIds.length > 0
        ? await databases.listDocuments(
          DATABASE_ID,
          MEMBERS_ID,
          [Query.equal("$id", workItem.assigneeIds)]
        )
        : { documents: [] };

      const assignees = (await Promise.all(
        membersData.documents.map(async (memberDoc) => {
          try {
            const userInfo = await users.get(memberDoc.userId);
            return {
              $id: memberDoc.$id,
              name: userInfo.name || userInfo.email,
              email: userInfo.email,
              profileImageUrl: userInfo.prefs?.profileImageUrl || null,
            };
          } catch {
            return null;
          }
        })
      )).filter((a): a is NonNullable<typeof a> => a !== null);

      let epic = null;
      if (workItem.epicId) {
        try {
          const epicDoc = await databases.getDocument<WorkItem>(
            DATABASE_ID,
            WORK_ITEMS_ID,
            workItem.epicId
          );
          epic = {
            $id: epicDoc.$id,
            key: epicDoc.key,
            title: epicDoc.title,
          };
        } catch {
          // Epic might be deleted
        }
      }

      let parent = null;
      if (workItem.parentId) {
        try {
          const parentDoc = await databases.getDocument<WorkItem>(
            DATABASE_ID,
            WORK_ITEMS_ID,
            workItem.parentId
          );
          parent = {
            $id: parentDoc.$id,
            key: parentDoc.key,
            title: parentDoc.title,
          };
        } catch {
          // Parent might be deleted
        }
      }

      // Get children
      const children = await databases.listDocuments<WorkItem>(
        DATABASE_ID,
        WORK_ITEMS_ID,
        [Query.equal("parentId", workItem.$id), Query.orderAsc("position")]
      );

      return c.json({
        data: {
          ...workItem,
          assignees,
          epic,
          parent,
          childrenCount: children.total,
          children: children.documents,
        },
      });
    }
  )
  // Create a new work item
  .post(
    "/",
    sessionMiddleware,
    zValidator("json", createWorkItemSchema),
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");

      const data = c.req.valid("json");

      const member = await getMember({
        databases,
        workspaceId: data.workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      // Determine the target sprint:
      // If sprintId is explicitly provided, use it. Otherwise, leave as null (backlog).
      // We explicitly REMOVED the auto-assignment to active sprint logic here to ensure
      // items created in the Backlog section stay in the Backlog.
      const targetSprintId = data.sprintId || null;

      // Get the highest position
      const queryFilters = [
        Query.equal("projectId", data.projectId),
        Query.orderDesc("position"),
        Query.limit(1),
      ];

      if (targetSprintId) {
        queryFilters.push(Query.equal("sprintId", targetSprintId));
      } else {
        queryFilters.push(Query.isNull("sprintId"));
      }

      let highestPosition = 0;
      try {
        const positionWorkItems = await databases.listDocuments(
          DATABASE_ID,
          WORK_ITEMS_ID,
          queryFilters
        );
        highestPosition = positionWorkItems.documents.length > 0 ? positionWorkItems.documents[0].position : 0;
      } catch {
        // Fallback without unsupported index
        const fallbackWorkItems = await databases.listDocuments(
          DATABASE_ID,
          WORK_ITEMS_ID,
          [
            Query.equal("projectId", data.projectId),
            Query.limit(100)
          ]
        );
        highestPosition = fallbackWorkItems.documents.length > 0 ?
          Math.max(...fallbackWorkItems.documents.map(d => d.position || 0)) : 0;
      }

      // Retry logic for work item creation in case of key conflicts
      let workItem: WorkItem | null = null;
      let attempts = 0;
      const maxAttempts = 3;

      while (!workItem && attempts < maxAttempts) {
        attempts++;

        try {
          // Generate unique key
          const key = await generateWorkItemKey(databases, data.projectId);

          workItem = await databases.createDocument<WorkItem>(
            DATABASE_ID,
            WORK_ITEMS_ID,
            ID.unique(),
            {
              ...data,
              key,
              position: highestPosition + 1000,
              dueDate: data.dueDate?.toISOString(),
              sprintId: targetSprintId,
            }
          );
        } catch (error: unknown) {
          // If it's a conflict error (duplicate key) and we haven't exceeded max attempts, retry
          const isConflictError =
            error &&
            typeof error === 'object' &&
            (('code' in error && error.code === 409) ||
              ('type' in error && (error as { type?: string }).type === 'document_already_exists'));

          if (isConflictError && attempts < maxAttempts) {
            // Wait a bit before retrying to reduce collision chance
            await new Promise(resolve => setTimeout(resolve, 100 * attempts));
            continue;
          }
          // If it's a different error or we've exceeded max attempts, throw
          throw error;
        }
      }

      if (!workItem) {
        return c.json({ error: "Failed to create work item after multiple attempts" }, 500);
      }

      // Log usage for work item creation
      logComputeUsage({
        databases,
        workspaceId: data.workspaceId,
        projectId: data.projectId,
        units: getComputeUnits('task_create'),
        jobType: 'task_create',
        metadata: { workItemId: workItem.$id, type: data.type },
      });

      const userName = user.name || user.email || "Someone";

      // Emit domain event for task creation (webhooks, etc.)
      const taskLike = {
        ...workItem,
        title: workItem.title,
        name: workItem.title,
      } as unknown as Task;
      const createEvent = createTaskCreatedEvent(taskLike, user.$id, userName);
      dispatchWorkitemEvent(createEvent).catch(() => { });

      // Dispatch notification for work item assignment (non-blocking)
      if (data.assigneeIds && data.assigneeIds.length > 0) {
        const event = createAssignedEvent(taskLike, user.$id, userName, data.assigneeIds);
        dispatchWorkitemEvent(event).catch(() => {
          console.debug("[WorkItemsRoute] Notification dispatch failed (non-blocking)");
        });
      }

      return c.json({ data: workItem });
    }
  )
  // Update a work item
  .patch(
    "/:workItemId",
    sessionMiddleware,
    zValidator("json", updateWorkItemSchema),
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");
      const { workItemId } = c.req.param();

      const workItem = await databases.getDocument<WorkItem>(
        DATABASE_ID,
        WORK_ITEMS_ID,
        workItemId
      );

      const member = await getMember({
        databases,
        workspaceId: workItem.workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const updates = c.req.valid("json");

      const updateData = {
        ...updates,
        startDate: updates.startDate !== undefined ? (updates.startDate ? updates.startDate.toISOString() : null) : undefined,
        dueDate: updates.dueDate?.toISOString(),
      };
      (updateData as Record<string, unknown>).lastModifiedBy = user.$id;

      const updatedWorkItem = await databases.updateDocument<WorkItem>(
        DATABASE_ID,
        WORK_ITEMS_ID,
        workItemId,
        updateData
      );

      // Log usage for work item update
      logComputeUsage({
        databases,
        workspaceId: workItem.workspaceId,
        projectId: workItem.projectId,
        units: getComputeUnits('task_update'),
        jobType: 'task_update',
        metadata: { workItemId, updatedFields: Object.keys(updates) },
      });

      // Dispatch notifications for relevant changes (non-blocking)
      const userName = user.name || user.email || "Someone";
      const taskLike = {
        ...updatedWorkItem,
        title: updatedWorkItem.title,
        name: updatedWorkItem.title,
      } as unknown as Task;

      // Status change notification
      if (updates.status && updates.status !== workItem.status) {
        const isDone = updates.status === "DONE";
        if (isDone) {
          const event = createCompletedEvent(taskLike, user.$id, userName);
          dispatchWorkitemEvent(event).catch(() => { });
        } else {
          // Resolve status IDs to human-readable names for notifications (non-blocking)
          Promise.all([
            resolveStatusName(databases, workItem.status, workItem.workspaceId),
            resolveStatusName(databases, updates.status, workItem.workspaceId)
          ]).then(([oldStatusName, newStatusName]) => {
            const event = createStatusChangedEvent(taskLike, user.$id, userName, oldStatusName, newStatusName);
            dispatchWorkitemEvent(event).catch(() => { });
          }).catch(() => { });
        }
      }

      // Priority change notification
      if (updates.priority && updates.priority !== workItem.priority) {
        const event = createPriorityChangedEvent(
          taskLike,
          user.$id,
          userName,
          workItem.priority || "MEDIUM",
          updates.priority
        );
        dispatchWorkitemEvent(event).catch(() => { });
      }

      // Due date change notification
      const oldDueDateStr = workItem.dueDate ? String(workItem.dueDate) : undefined;
      const newDueDateStr = updates.dueDate ? updates.dueDate.toISOString() : undefined;
      if (updates.dueDate !== undefined && oldDueDateStr !== newDueDateStr) {
        const event = createDueDateChangedEvent(
          taskLike,
          user.$id,
          userName,
          oldDueDateStr,
          newDueDateStr
        );
        dispatchWorkitemEvent(event).catch(() => { });
      }

      // Assignee change notification
      if (updates.assigneeIds) {
        const oldIds = workItem.assigneeIds || [];
        const newIds = updates.assigneeIds || [];
        const addedAssignees = newIds.filter((id: string) => !oldIds.includes(id));
        if (addedAssignees.length > 0) {
          const event = createAssignedEvent(taskLike, user.$id, userName, addedAssignees);
          dispatchWorkitemEvent(event).catch(() => { });
        }

        const removedAssignees = oldIds.filter((id: string) => !newIds.includes(id));
        if (removedAssignees.length > 0) {
          const event = createUnassignedEvent(taskLike, user.$id, userName, removedAssignees);
          dispatchWorkitemEvent(event).catch(() => { });
        }
      }

      // Description @mention notifications
      if (updates.description) {
        const mentionedUserIds = extractMentions(updates.description);
        const snippet = extractSnippet(updates.description);

        for (const mentionedUserId of mentionedUserIds) {
          // Skip self-mention
          if (mentionedUserId === user.$id) continue;

          const mentionEvent = createMentionEvent(
            taskLike,
            user.$id,
            userName,
            mentionedUserId,
            snippet
          );
          dispatchWorkitemEvent(mentionEvent).catch(() => { });
        }
      }

      // Generic update event if other fields changed
      if (!updates.status && !updates.priority && !updates.assigneeIds) {
        const event = createTaskUpdatedEvent(taskLike, user.$id, userName, "Work item details updated");
        dispatchWorkitemEvent(event).catch(() => { });
      }

      return c.json({ data: updatedWorkItem });
    }
  )
  // Delete a work item
  .delete(
    "/:workItemId",
    sessionMiddleware,
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");
      const { workItemId } = c.req.param();

      const workItem = await databases.getDocument<WorkItem>(
        DATABASE_ID,
        WORK_ITEMS_ID,
        workItemId
      );

      const member = await getMember({
        databases,
        workspaceId: workItem.workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      // Delete all children (subtasks)
      const children = await databases.listDocuments(
        DATABASE_ID,
        WORK_ITEMS_ID,
        [Query.equal("parentId", workItemId)]
      );

      await Promise.all(
        children.documents.map((child) =>
          databases.deleteDocument(DATABASE_ID, WORK_ITEMS_ID, child.$id)
        )
      );

      await databases.deleteDocument(DATABASE_ID, WORK_ITEMS_ID, workItemId);

      // Log usage for work item deletion
      logComputeUsage({
        databases,
        workspaceId: workItem.workspaceId,
        projectId: workItem.projectId,
        units: getComputeUnits('task_delete'),
        jobType: 'task_delete',
        metadata: { workItemId, deletedChildren: children.total },
      });

      // Dispatch deletion event (non-blocking)
      const userName = user.name || user.email || "Someone";
      const taskLike = {
        ...workItem,
        title: workItem.title,
        name: workItem.title,
      } as unknown as Task;
      const deleteEvent = createDeletedEvent(taskLike, user.$id, userName);
      dispatchWorkitemEvent(deleteEvent).catch(() => { });

      return c.json({ data: { $id: workItem.$id } });
    }
  )
  // Bulk delete work items
  .post(
    "/bulk-delete",
    sessionMiddleware,
    zValidator(
      "json",
      z.object({
        workItemIds: z.array(z.string()),
      })
    ),
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");

      const { workItemIds } = c.req.valid("json");

      if (workItemIds.length === 0) {
        return c.json({ data: { count: 0 } });
      }

      // Verify user has access to the first work item (assume same workspace)
      const firstWorkItem = await databases.getDocument<WorkItem>(
        DATABASE_ID,
        WORK_ITEMS_ID,
        workItemIds[0]
      );

      const member = await getMember({
        databases,
        workspaceId: firstWorkItem.workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      // Delete items and their children
      // We'll do this in parallel chunks to avoid overwhelming the server if many items
      const deleteItem = async (id: string) => {
        try {
          // Find children first
          const children = await databases.listDocuments(
            DATABASE_ID,
            WORK_ITEMS_ID,
            [Query.equal("parentId", id)]
          );

          // Delete children
          await Promise.all(
            children.documents.map(child =>
              databases.deleteDocument(DATABASE_ID, WORK_ITEMS_ID, child.$id)
            )
          );

          // Delete the item itself
          await databases.deleteDocument(DATABASE_ID, WORK_ITEMS_ID, id);
        } catch {
          // Continue with other items
        }
      };

      await Promise.all(workItemIds.map(deleteItem));

      // We emit a single event for the whole workspace if we want to be efficient,
      // but the webhook system is project-scoped.
      // For now, we'll skip detailed individual notifications for bulk delete to avoid DB storms,
      // but we should at least log it.
      console.log(`[WorkItemsRoute] Bulk deleted ${workItemIds.length} items`);

      return c.json({ data: { count: workItemIds.length } });
    }
  )
  // Bulk move work items to a sprint
  .post(
    "/bulk-move",
    sessionMiddleware,
    zValidator("json", bulkMoveWorkItemsSchema),
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");

      const { workItemIds, sprintId } = c.req.valid("json");

      // Verify user has access to the first work item (assume same workspace)
      const firstWorkItem = await databases.getDocument<WorkItem>(
        DATABASE_ID,
        WORK_ITEMS_ID,
        workItemIds[0]
      );

      const member = await getMember({
        databases,
        workspaceId: firstWorkItem.workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const updatedItems = await Promise.all(
        workItemIds.map((id) =>
          databases.updateDocument(DATABASE_ID, WORK_ITEMS_ID, id, {
            sprintId,
            lastModifiedBy: user.$id,
          })
        )
      );

      // Notify of bulk move
      if (updatedItems.length > 0) {
        const userName = user.name || user.email || "Someone";
        const firstItem = updatedItems[0] as unknown as Task;
        const taskLike = {
          ...firstItem,
          title: firstItem.title || "Multiple items",
          name: firstItem.title || "Multiple items",
        } as unknown as Task;
        const event = createTaskUpdatedEvent(taskLike, user.$id, userName, `Bulk moved ${updatedItems.length} items to sprint`);
        dispatchWorkitemEvent(event).catch(() => { });
      }

      return c.json({ data: updatedItems });
    }
  )
  // Reorder work items
  .post(
    "/reorder",
    sessionMiddleware,
    zValidator("json", reorderWorkItemsSchema),
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");

      const { workItemId, newPosition, sprintId } = c.req.valid("json");

      const workItem = await databases.getDocument<WorkItem>(
        DATABASE_ID,
        WORK_ITEMS_ID,
        workItemId
      );

      const member = await getMember({
        databases,
        workspaceId: workItem.workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const updateData: Partial<WorkItem> = { position: newPosition };
      if (sprintId !== undefined) {
        updateData.sprintId = sprintId;
      }
      (updateData as Record<string, unknown>).lastModifiedBy = user.$id;

      const updatedWorkItem = await databases.updateDocument<WorkItem>(
        DATABASE_ID,
        WORK_ITEMS_ID,
        workItemId,
        updateData
      );

      // Notify of update
      const userName = user.name || user.email || "Someone";
      const taskLike = {
        ...updatedWorkItem,
        title: updatedWorkItem.title,
        name: updatedWorkItem.title,
      } as unknown as Task;
      const event = createTaskUpdatedEvent(taskLike, user.$id, userName, "Item reordered or moved");
      dispatchWorkitemEvent(event).catch(() => { });

      return c.json({ data: updatedWorkItem });
    }
  )
  // Split work item
  .post(
    "/split",
    sessionMiddleware,
    zValidator("json", splitWorkItemSchema),
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");

      const { originalWorkItemId, newWorkItems } = c.req.valid("json");

      const originalWorkItem = await databases.getDocument<WorkItem>(
        DATABASE_ID,
        WORK_ITEMS_ID,
        originalWorkItemId
      );

      const member = await getMember({
        databases,
        workspaceId: originalWorkItem.workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      // Create new work items
      const createdItems = await Promise.all(
        newWorkItems.map(async (item, index) => {
          const key = await generateWorkItemKey(
            databases,
            originalWorkItem.projectId
          );

          return databases.createDocument<WorkItem>(
            DATABASE_ID,
            WORK_ITEMS_ID,
            ID.unique(),
            {
              title: item.title,
              key,
              type: originalWorkItem.type,
              status: originalWorkItem.status,
              priority: originalWorkItem.priority,
              storyPoints: item.storyPoints,
              workspaceId: originalWorkItem.workspaceId,
              projectId: originalWorkItem.projectId,
              sprintId: originalWorkItem.sprintId,
              epicId: originalWorkItem.epicId,
              assigneeIds: originalWorkItem.assigneeIds,
              flagged: false,
              position: originalWorkItem.position + (index + 1) * 100,
              labels: originalWorkItem.labels,
            }
          );
        })
      );

      return c.json({ data: { original: originalWorkItem, created: createdItems } });
    }
  );

export default app;

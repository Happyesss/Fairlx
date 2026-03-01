import { ID, Query, Models, Databases } from "node-appwrite";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

import { DATABASE_ID, MEMBERS_ID, PROJECTS_ID, TASKS_ID, TIME_LOGS_ID, COMMENTS_ID, WORKFLOW_TRANSITIONS_ID, PROJECT_TEAM_MEMBERS_ID, WORKFLOW_STATUSES_ID, CUSTOM_COLUMNS_ID } from "@/config";
import { sessionMiddleware } from "@/lib/session-middleware";
import { createAdminClient } from "@/lib/appwrite";
import { batchGetUsers } from "@/lib/batch-users";
import {
  dispatchWorkitemEvent,
} from "@/lib/notifications";
import {
  createTaskCreatedEvent,
  createAssignedEvent,
  createUnassignedEvent,
  createStatusChangedEvent,
  createCompletedEvent,
  createDeletedEvent,
  createPriorityChangedEvent,
  createDueDateChangedEvent,
  createMentionEvent,
} from "@/lib/notifications/events";
import { extractMentions, extractSnippet } from "@/lib/mentions";


import { getMember } from "@/features/members/utils";
import { Project } from "@/features/projects/types";

import { createTaskSchema, updateTaskSchema } from "../schemas";
import { Task, TaskStatus, TaskPriority } from "../types";

/**
 * Validate if a status transition is allowed for the user
 * Checks workflow rules, role restrictions, team restrictions, and approval requirements
 * 
 * @param databases - Database client
 * @param workflowId - The workflow to validate against
 * @param fromStatus - Current status key
 * @param toStatus - Target status key
 * @param userId - User attempting the transition
 * @param projectId - Project ID (for team membership lookup)
 * @param memberRole - User's workspace member role
 */
async function validateStatusTransition(
  databases: Databases,
  workflowId: string,
  fromStatus: string,
  toStatus: string,
  userId: string,
  projectId: string,
  memberRole: string
): Promise<{ allowed: boolean; reason?: string; message?: string }> {
  // If same status, always allowed
  if (fromStatus === toStatus) {
    return { allowed: true };
  }

  try {
    // Get the workflow statuses to find the status IDs from status keys/values
    const workflowStatuses = await databases.listDocuments(
      DATABASE_ID,
      WORKFLOW_STATUSES_ID,
      [Query.equal("workflowId", workflowId)]
    );

    // Find the status documents by key (status value)
    const fromStatusDoc = workflowStatuses.documents.find(s => s.key === fromStatus);
    const toStatusDoc = workflowStatuses.documents.find(s => s.key === toStatus);

    // If statuses are not found in workflow, it means the task uses legacy/default statuses
    // In this case, allow the transition (backward compatibility)
    if (!fromStatusDoc || !toStatusDoc) {
      return { allowed: true };
    }

    // Get the transition between these statuses
    const transitions = await databases.listDocuments(
      DATABASE_ID,
      WORKFLOW_TRANSITIONS_ID,
      [
        Query.equal("workflowId", workflowId),
        Query.equal("fromStatusId", fromStatusDoc.$id),
        Query.equal("toStatusId", toStatusDoc.$id),
      ]
    );

    // No transition defined = not allowed
    if (transitions.total === 0) {
      return {
        allowed: false,
        reason: "TRANSITION_NOT_DEFINED",
        message: `Cannot move from "${fromStatusDoc.name}" to "${toStatusDoc.name}". This transition is not allowed in the workflow.`,
      };
    }

    const transition = transitions.documents[0];

    // Check role restrictions
    if (transition.allowedMemberRoles && transition.allowedMemberRoles.length > 0) {
      if (!transition.allowedMemberRoles.includes(memberRole)) {
        return {
          allowed: false,
          reason: "ROLE_NOT_ALLOWED",
          message: `Your role (${memberRole}) cannot perform this transition. Allowed roles: ${transition.allowedMemberRoles.join(", ")}`,
        };
      }
    }

    // Check team restrictions (uses project-scoped teams)
    if (transition.allowedTeamIds && transition.allowedTeamIds.length > 0) {
      const userTeams = await databases.listDocuments(
        DATABASE_ID,
        PROJECT_TEAM_MEMBERS_ID,
        [Query.equal("userId", userId), Query.equal("projectId", projectId)]
      );

      const userTeamIds = userTeams.documents.map((t) => t.teamId as string);
      const hasAllowedTeam = transition.allowedTeamIds.some(
        (teamId: string) => userTeamIds.includes(teamId)
      );

      if (!hasAllowedTeam) {
        return {
          allowed: false,
          reason: "TEAM_NOT_ALLOWED",
          message: "Your team does not have permission to perform this transition",
        };
      }
    }

    // Check approval requirement (uses project-scoped teams)
    if (transition.requiresApproval) {
      // Check if user is in approver team
      const userTeams = await databases.listDocuments(
        DATABASE_ID,
        PROJECT_TEAM_MEMBERS_ID,
        [Query.equal("userId", userId), Query.equal("projectId", projectId)]
      );

      const userTeamIds = userTeams.documents.map((t) => t.teamId as string);
      const isApprover = transition.approverTeamIds?.some(
        (teamId: string) => userTeamIds.includes(teamId)
      );

      if (!isApprover) {
        return {
          allowed: false,
          reason: "REQUIRES_APPROVAL",
          message: "This transition requires approval from designated approvers",
        };
      }
    }

    return { allowed: true };
  } catch {
    // On error, allow the transition to prevent blocking users due to validation errors
    return { allowed: true };
  }
}

/**
 * Resolve status ID or key to a human-readable name.
 * If it's a standard TaskStatus, returns it as-is (formatted).
 * If it's a custom column ID, looks up the column name.
 * Falls back to the original value if not found.
 */
async function resolveStatusName(
  databases: Databases,
  status: string,
  workspaceId: string
): Promise<string> {
  // Check if it's a standard TaskStatus enum value
  if (Object.values(TaskStatus).includes(status as TaskStatus)) {
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
  .delete("/:taskId", sessionMiddleware, async (c) => {
    const user = c.get("user");
    const databases = c.get("databases");
    const { taskId } = c.req.param();

    const task = await databases.getDocument<Task>(
      DATABASE_ID,
      TASKS_ID,
      taskId
    );

    const member = await getMember({
      databases,
      workspaceId: task.workspaceId,
      userId: user.$id,
    });

    if (!member) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Project permission check: verify user can delete tasks in this project
    const { resolveUserProjectAccess, hasProjectPermission, ProjectPermissionKey } = await import("@/lib/permissions/resolveUserProjectAccess");
    const access = await resolveUserProjectAccess(databases, user.$id, task.projectId);
    if (!access.hasAccess || !hasProjectPermission(access, ProjectPermissionKey.DELETE_TASKS)) {
      return c.json({ error: "Forbidden: No permission to delete tasks in this project" }, 403);
    }

    // Delete related time logs
    try {
      const timeLogs = await databases.listDocuments(
        DATABASE_ID,
        TIME_LOGS_ID,
        [Query.equal("taskId", taskId)]
      );

      for (const timeLog of timeLogs.documents) {
        await databases.deleteDocument(DATABASE_ID, TIME_LOGS_ID, timeLog.$id);
      }

      // Delete the task
      await databases.deleteDocument(DATABASE_ID, TASKS_ID, taskId);

      // Dispatch deletion event (non-blocking)
      const userName = user.name || user.email || "Someone";
      const event = createDeletedEvent(task, user.$id, userName);
      dispatchWorkitemEvent(event).catch(() => { });

      return c.json({ data: { $id: task.$id } });
    } catch {
      return c.json({ error: "Failed to delete task" }, 500);
    }
  })
  .get(
    "/",
    sessionMiddleware,
    zValidator(
      "query",
      z.object({
        workspaceId: z.string(),
        projectId: z.string().nullish(),
        assigneeId: z.string().nullish(),
        status: z.union([z.nativeEnum(TaskStatus), z.string()]).nullish(),
        search: z.string().nullish().transform(val => val === "" ? null : val),
        dueDate: z.string().nullish(),
        priority: z.nativeEnum(TaskPriority).nullish(),
        labels: z.string().nullish(), // Will be comma-separated list
        parentId: z.string().nullish(), // Filter by parent task for sub-issues
      })
    ),
    async (c) => {
      const { users } = await createAdminClient();
      const databases = c.get("databases");
      const user = c.get("user");

      const { workspaceId, projectId, assigneeId, status, dueDate, priority, labels, parentId } =
        c.req.valid("query");

      const member = await getMember({
        databases,
        workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      // Project membership check: if projectId provided, verify access
      if (projectId) {
        const { resolveUserProjectAccess, hasProjectPermission, ProjectPermissionKey } = await import("@/lib/permissions/resolveUserProjectAccess");
        const access = await resolveUserProjectAccess(databases, user.$id, projectId);
        if (!access.hasAccess || !hasProjectPermission(access, ProjectPermissionKey.VIEW_TASKS)) {
          return c.json({ error: "Forbidden: No access to this project" }, 403);
        }
      }

      const query = [
        Query.equal("workspaceId", workspaceId),
        Query.orderDesc("$createdAt"),
      ];

      if (projectId) {
        query.push(Query.equal("projectId", projectId));
      }

      if (status) {
        query.push(Query.equal("status", status));
      }

      if (assigneeId) {
        // Filter by assigneeIds array field only (assigneeId singular field doesn't exist)
        query.push(Query.contains("assigneeIds", assigneeId));
      }

      if (dueDate) {
        query.push(Query.equal("dueDate", dueDate));
      }

      // Client-side search only

      if (priority) {
        query.push(Query.equal("priority", priority));
      }

      if (labels) {
        // For labels, we need to check if any of the provided labels match
        // Since labels is an array field, we'll use Query.contains for each label
        const labelList = labels.split(",").map(label => label.trim());
        for (const label of labelList) {
          query.push(Query.contains("labels", label));
        }
      }

      if (parentId) {
        query.push(Query.equal("parentId", parentId));
      }

      const tasks = await databases.listDocuments<Task>(
        DATABASE_ID,
        TASKS_ID,
        query
      );

      const projectIds = [...new Set(tasks.documents.map((task) => task.projectId).filter(Boolean))];

      // Normalize assignee IDs
      const allAssigneeIds = new Set<string>();
      tasks.documents.forEach((task) => {
        const ids = task.assigneeIds;
        if (Array.isArray(ids) && ids.length > 0) {
          ids.forEach(id => {
            if (id && typeof id === 'string') {
              allAssigneeIds.add(id);
            }
          });
        }
      });

      const projects = await databases.listDocuments<Project>(
        DATABASE_ID,
        PROJECTS_ID,
        projectIds.length > 0 ? [Query.equal("$id", projectIds)] : []
      );

      const members = await databases.listDocuments(
        DATABASE_ID,
        MEMBERS_ID,
        allAssigneeIds.size > 0 ? [Query.equal("$id", Array.from(allAssigneeIds))] : []
      );

      // Get comment counts for all tasks
      const taskIds = tasks.documents.map((task) => task.$id);
      const commentCounts: Record<string, number> = {};

      if (taskIds.length > 0) {
        try {
          // Fetch comments for all tasks and count them
          const comments = await databases.listDocuments(
            DATABASE_ID,
            COMMENTS_ID,
            [
              Query.equal("taskId", taskIds),
              Query.limit(500), // Reduced from 5000 — rarely need that many per batch
            ]
          );

          // Count comments per task
          comments.documents.forEach((comment) => {
            const taskId = comment.taskId as string;
            commentCounts[taskId] = (commentCounts[taskId] || 0) + 1;
          });
        } catch {
          // Comments collection might not exist yet, ignore errors
        }
      }

      // OPTIMIZED: Batch-fetch all users in one call (was N+1 users.get per member)
      const memberUserIds = members.documents.map(m => m.userId);
      const userMap = await batchGetUsers(users, memberUserIds);

      const assignees = members.documents
        .map((member) => {
          const userData = userMap.get(member.userId);
          if (!userData) return null;
          const prefs = userData.prefs as { profileImageUrl?: string | null } | undefined;

          return {
            ...member,
            name: userData.name || userData.email,
            email: userData.email,
            profileImageUrl: prefs?.profileImageUrl ?? null,
          };
        })
        .filter((assignee): assignee is NonNullable<typeof assignee> => assignee !== null);

      const populatedTasks = tasks.documents.map((task) => {
        const project = projects.documents.find(
          (project) => project.$id === task.projectId
        );

        // Get first assignee for backward compatibility
        const firstAssigneeId = task.assigneeIds?.[0];
        const assignee = firstAssigneeId
          ? assignees.find((a) => a.$id === firstAssigneeId)
          : undefined;

        // Handle multiple assignees
        const taskAssignees = task.assigneeIds
          ? assignees.filter((a) => task.assigneeIds!.includes(a.$id))
          : [];

        return {
          ...task,
          type: task.type || "TASK", // Default to TASK if type is not set
          name: task.title, // Add name as alias for title for backward compatibility
          project,
          assignee, // Keep for backward compatibility
          assignees: taskAssignees, // New field for multiple assignees
          commentCount: commentCounts[task.$id] || 0,
        };
      });

      return c.json({ data: { ...tasks, documents: populatedTasks } });
    }
  )
  .post(
    "/",
    sessionMiddleware,
    zValidator("json", createTaskSchema),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { name, type, status, workspaceId, projectId, parentId, startDate, dueDate, assigneeIds, description, estimatedHours, priority, labels } =
        c.req.valid("json");

      const member = await getMember({
        databases,
        workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      // Project membership check: verify user can create tasks in this project
      const { resolveUserProjectAccess, hasProjectPermission, ProjectPermissionKey } = await import("@/lib/permissions/resolveUserProjectAccess");
      const access = await resolveUserProjectAccess(databases, user.$id, projectId);
      if (!access.hasAccess || !hasProjectPermission(access, ProjectPermissionKey.CREATE_TASKS)) {
        return c.json({ error: "Forbidden: No permission to create tasks in this project" }, 403);
      }

      // Auto-assign to sprint
      const { SPRINTS_ID } = await import("@/config");
      const { SprintStatus } = await import("@/features/sprints/types");

      let targetSprintId: string | null = null;

      try {
        const activeSprints = await databases.listDocuments(
          DATABASE_ID,
          SPRINTS_ID,
          [
            Query.equal("projectId", projectId),
            Query.equal("status", SprintStatus.ACTIVE),
            Query.limit(1),
          ]
        );

        if (activeSprints.documents.length > 0) {
          targetSprintId = activeSprints.documents[0].$id;
        }
      } catch {
        // If sprint collection doesn't exist or error occurs, continue without sprint assignment
      }

      const highestPositionTask = await databases.listDocuments(
        DATABASE_ID,
        TASKS_ID,
        [
          Query.equal("status", status),
          Query.equal("workspaceId", workspaceId),
          Query.orderAsc("position"),
          Query.limit(1),
        ]
      );

      const newPosition =
        highestPositionTask.documents.length > 0
          ? highestPositionTask.documents[0].position + 1000
          : 1000;

      // Generate task key
      const existingItems = await databases.listDocuments(
        DATABASE_ID,
        TASKS_ID,
        [Query.equal("projectId", projectId)]
      );

      // Get project for key prefix
      const project = await databases.getDocument<Project>(
        DATABASE_ID,
        PROJECTS_ID,
        projectId
      );

      // ======= INITIAL STATUS VALIDATION =======
      // If project has a workflow, validate that the status is an initial status
      if (project.workflowId) {
        try {
          const workflowStatuses = await databases.listDocuments(
            DATABASE_ID,
            WORKFLOW_STATUSES_ID,
            [
              Query.equal("workflowId", project.workflowId),
              Query.equal("isInitial", true),
            ]
          );

          // Get all initial status keys
          const validInitialStatusKeys = workflowStatuses.documents.map(s => s.key);

          // If there are defined initial statuses and the provided status isn't one of them
          if (validInitialStatusKeys.length > 0 && !validInitialStatusKeys.includes(status)) {
            return c.json({
              error: `Tasks must start with an initial status. Allowed: ${validInitialStatusKeys.join(", ")}`,
              reason: "INVALID_INITIAL_STATUS",
              allowedStatuses: validInitialStatusKeys,
            }, 400);
          }
        } catch {
          // If workflow check fails, continue without validation
        }
      }
      // ======= END INITIAL STATUS VALIDATION =======

      const projectKey = project.name.substring(0, 3).toUpperCase();
      const keyNumber = existingItems.total + 1;
      const key = `${projectKey}-${keyNumber}`;

      const task = await databases.createDocument(
        DATABASE_ID,
        TASKS_ID,
        ID.unique(),
        {
          title: name, // Use title for workItems collection (name is passed from form but stored as title)
          type: type || "TASK", // Use provided type or default to TASK
          key,
          status,
          workspaceId,
          projectId,
          parentId: parentId || null, // Parent task ID for sub-issues
          startDate: startDate || null,
          dueDate: dueDate || null,
          assigneeIds: assigneeIds || [],
          position: newPosition,
          description: description || null,
          estimatedHours: estimatedHours || null,
          priority: priority || "MEDIUM", // Default to MEDIUM if not provided (required field)
          labels: labels || [],
          flagged: false,
          lastModifiedBy: user.$id,
          reporterId: member.$id, // Track who created the task
          sprintId: targetSprintId, // Auto-assign to active sprint if available
        }
      ) as Task;

      const userName = user.name || user.email || "Someone";

      // Emit domain event for task creation (webhooks, etc.)
      const createEvent = createTaskCreatedEvent(task, user.$id, userName);
      dispatchWorkitemEvent(createEvent).catch(() => { });

      // Emit domain event for task assignment (non-blocking)
      if (assigneeIds && assigneeIds.length > 0) {
        const event = createAssignedEvent(task, user.$id, userName, assigneeIds);
        dispatchWorkitemEvent(event).catch(() => {
          // Silent failure for non-critical event dispatch
        });
      }

      return c.json({ data: task });
    }
  )
  .patch(
    "/:taskId",
    sessionMiddleware,
    zValidator("json", updateTaskSchema),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { name, type, status, projectId, startDate, dueDate, assigneeIds, description, estimatedHours, priority, labels, flagged, storyPoints } =
        c.req.valid("json");

      const { taskId } = c.req.param();

      const existingTask = await databases.getDocument<Task>(
        DATABASE_ID,
        TASKS_ID,
        taskId
      );

      const member = await getMember({
        databases,
        workspaceId: existingTask.workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      // Project membership check: verify user can edit tasks in this project
      const { resolveUserProjectAccess, hasProjectPermission, ProjectPermissionKey } = await import("@/lib/permissions/resolveUserProjectAccess");
      const projectAccess = await resolveUserProjectAccess(databases, user.$id, existingTask.projectId);
      if (!projectAccess.hasAccess || !hasProjectPermission(projectAccess, ProjectPermissionKey.EDIT_TASKS)) {
        return c.json({ error: "Forbidden: No permission to edit tasks in this project" }, 403);
      }

      // ======= WORKFLOW TRANSITION VALIDATION =======
      // If status is changing, validate the transition against workflow rules
      if (status !== undefined && existingTask.status !== status) {
        // Get the project to find the associated workflow
        try {
          const project = await databases.getDocument<Project>(
            DATABASE_ID,
            PROJECTS_ID,
            existingTask.projectId
          );

          // Only validate if project has a workflow attached
          if (project.workflowId) {
            const validation = await validateStatusTransition(
              databases,
              project.workflowId,
              existingTask.status,
              status,
              user.$id,
              existingTask.projectId,  // Use projectId for team lookups
              member.role as string
            );

            if (!validation.allowed) {
              return c.json({
                error: validation.message || "This status transition is not allowed",
                reason: validation.reason,
              }, 403);
            }
          }
        } catch {
          // If project fetch fails, continue (project might have been deleted)
        }
      }
      // ======= END WORKFLOW VALIDATION =======

      const updateData: Record<string, unknown> = {};

      // Build update payload
      if (name !== undefined) {
        updateData.title = name;
      }
      if (type !== undefined) updateData.type = type;
      if (status !== undefined) updateData.status = status;
      if (projectId !== undefined) updateData.projectId = projectId;
      if (startDate !== undefined) updateData.startDate = startDate;
      if (dueDate !== undefined) updateData.dueDate = dueDate;
      if (description !== undefined) updateData.description = description;
      if (estimatedHours !== undefined) updateData.estimatedHours = estimatedHours;
      if (storyPoints !== undefined) updateData.storyPoints = storyPoints;
      if (priority !== undefined) updateData.priority = priority;
      if (labels !== undefined) updateData.labels = labels;
      if (flagged !== undefined) updateData.flagged = flagged;

      // Track assignee changes
      const oldAssigneeIds = existingTask.assigneeIds || [];
      const newAssigneeIds = assigneeIds || [];
      const assigneesChanged = assigneeIds !== undefined && (
        oldAssigneeIds.length !== newAssigneeIds.length ||
        !oldAssigneeIds.every((id: string) => newAssigneeIds.includes(id))
      );

      // Handle assignees - always update if provided (even if empty array to clear assignees)
      if (assigneeIds !== undefined) {
        updateData.assigneeIds = assigneeIds;
      }

      // Ensure we have at least some data to update
      if (Object.keys(updateData).length === 0) {
        return c.json({ error: "No data provided for update" }, 400);
      }

      // Add lastModifiedBy to track who made the update (for audit logs)
      (updateData as Record<string, unknown>).lastModifiedBy = user.$id;

      const task = await databases.updateDocument(
        DATABASE_ID,
        TASKS_ID,
        taskId,
        updateData
      ) as Task;

      // Emit domain events for task updates (non-blocking)
      const userName = user.name || user.email || "Someone";

      // Track what changed
      const statusChanged = status !== undefined && existingTask.status !== status;
      const priorityChanged = priority !== undefined && existingTask.priority !== priority;
      const dueDateChanged = dueDate !== undefined && String(existingTask.dueDate) !== String(dueDate);

      // Dispatch appropriate events based on what changed
      // Status change events
      if (statusChanged) {
        if (status === "DONE" || status === "CLOSED") {
          const event = createCompletedEvent(task, user.$id, userName);
          dispatchWorkitemEvent(event).catch(() => {
            // Silent failure for non-critical event dispatch
          });
        } else {
          // Resolve status IDs to human-readable names for notifications
          const [oldStatusName, newStatusName] = await Promise.all([
            resolveStatusName(databases, existingTask.status, task.workspaceId),
            resolveStatusName(databases, status, task.workspaceId)
          ]);
          
          const event = createStatusChangedEvent(
            task,
            user.$id,
            userName,
            oldStatusName,
            newStatusName
          );
          dispatchWorkitemEvent(event).catch(() => {
            // Silent failure for non-critical event dispatch
          });
        }
      }

      // Priority change event
      if (priorityChanged) {
        const event = createPriorityChangedEvent(
          task,
          user.$id,
          userName,
          existingTask.priority || "MEDIUM",
          priority
        );
        dispatchWorkitemEvent(event).catch(() => {
          // Silent failure for non-critical event dispatch
        });
      }

      // Due date change event
      if (dueDateChanged) {
        const oldDueDateStr = existingTask.dueDate ? String(existingTask.dueDate) : undefined;
        const newDueDateStr = dueDate ? String(dueDate) : undefined;
        const event = createDueDateChangedEvent(
          task,
          user.$id,
          userName,
          oldDueDateStr,
          newDueDateStr
        );
        dispatchWorkitemEvent(event).catch(() => {
          // Silent failure for non-critical event dispatch
        });
      }

      // Assignment change event (only for newly added assignees)
      if (assigneesChanged) {
        const addedAssignees = newAssigneeIds.filter(
          (id: string) => !oldAssigneeIds.includes(id)
        );
        if (addedAssignees.length > 0) {
          const event = createAssignedEvent(task, user.$id, userName, addedAssignees);
          dispatchWorkitemEvent(event).catch(() => {
            // Silent failure for non-critical event dispatch
          });
        }

        const removedAssignees = oldAssigneeIds.filter(
          (id: string) => !newAssigneeIds.includes(id)
        );
        if (removedAssignees.length > 0) {
          const event = createUnassignedEvent(task, user.$id, userName, removedAssignees);
          dispatchWorkitemEvent(event).catch(() => {
            // Silent failure for non-critical event dispatch
          });
        }
      }

      // Description @mention notifications
      // Only notify if description changed and only for NEWLY added mentions
      if (description !== undefined && description !== existingTask.description) {
        const oldMentions = existingTask.description ? extractMentions(existingTask.description) : [];
        const currentMentions = extractMentions(description || "");
        const newMentions = currentMentions.filter(id => !oldMentions.includes(id));

        const snippet = extractSnippet(description || "");

        for (const mentionedUserId of newMentions) {
          // Skip self-mention
          if (mentionedUserId === user.$id) continue;

          const mentionEvent = createMentionEvent(
            task,
            user.$id,
            userName,
            mentionedUserId,
            snippet
          );
          dispatchWorkitemEvent(mentionEvent).catch(() => {
            // Silent failure for non-critical event dispatch
          });
        }
      }

      return c.json({ data: task });
    }
  )
  .get("/:taskId", sessionMiddleware, async (c) => {
    const currentUser = c.get("user");
    const databases = c.get("databases");
    const { users } = await createAdminClient();

    const { taskId } = c.req.param();

    try {
      const task = await databases.getDocument<Task>(
        DATABASE_ID,
        TASKS_ID,
        taskId
      );

      const currentMember = await getMember({
        databases,
        workspaceId: task.workspaceId,
        userId: currentUser.$id,
      });

      if (!currentMember) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      // Project permission check: verify user can view tasks in this project
      const { resolveUserProjectAccess, hasProjectPermission, ProjectPermissionKey } = await import("@/lib/permissions/resolveUserProjectAccess");
      const projectAccess = await resolveUserProjectAccess(databases, currentUser.$id, task.projectId);
      if (!projectAccess.hasAccess || !hasProjectPermission(projectAccess, ProjectPermissionKey.VIEW_TASKS)) {
        return c.json({ error: "Forbidden: No permission to view tasks in this project" }, 403);
      }

      // Fetch project safely
      let project;
      try {
        project = await databases.getDocument<Project>(
          DATABASE_ID,
          PROJECTS_ID,
          task.projectId
        );
      } catch {
        // Continue without project data
        project = undefined;
      }

      // Collect all assignee IDs
      const allAssigneeIds = new Set<string>();
      if (task.assigneeIds && task.assigneeIds.length > 0) {
        task.assigneeIds.forEach(id => allAssigneeIds.add(id));
      }

      // Get all assignee members
      let members: Models.DocumentList<Models.Document> = { documents: [], total: 0 };
      if (allAssigneeIds.size > 0) {
        try {
          members = await databases.listDocuments(
            DATABASE_ID,
            MEMBERS_ID,
            [Query.equal("$id", Array.from(allAssigneeIds))]
          ) as unknown as Models.DocumentList<Models.Document>;
        } catch {
          // Silent failure for non-critical member fetch
        }
      }

      const assignees = await Promise.all(
        members.documents.map(async (member: Models.Document) => {
          try {
            const user = await users.get(member.userId);
            const prefs = user.prefs as { profileImageUrl?: string | null } | undefined;

            return {
              ...member,
              name: user.name || user.email,
              email: user.email,
              profileImageUrl: prefs?.profileImageUrl ?? null,
            };
          } catch {
            return null;
          }
        })
      );

      // Filter out nulls
      const validAssignees = assignees.filter((a): a is NonNullable<typeof a> => a !== null);

      // Get first assignee for backward compatibility
      const firstAssigneeId = task.assigneeIds?.[0];
      const assignee = firstAssigneeId
        ? validAssignees.find((a) => a.$id === firstAssigneeId)
        : undefined;

      // Handle multiple assignees
      const taskAssignees = task.assigneeIds
        ? validAssignees.filter((a) => task.assigneeIds!.includes(a.$id))
        : [];

      // Fetch reporter info (task creator)
      let reporter: { $id: string; name: string; email?: string; profileImageUrl?: string | null } | undefined;
      if (task.reporterId) {
        try {
          const reporterMember = await databases.getDocument(
            DATABASE_ID,
            MEMBERS_ID,
            task.reporterId
          ) as Models.Document;
          
          const reporterUser = await users.get(reporterMember.userId as string);
          const reporterPrefs = reporterUser.prefs as { profileImageUrl?: string | null } | undefined;
          
          reporter = {
            $id: reporterMember.$id,
            name: reporterUser.name || reporterUser.email,
            email: reporterUser.email,
            profileImageUrl: reporterPrefs?.profileImageUrl ?? null,
          };
        } catch {
          // Silent failure - reporter info is optional
        }
      }

      return c.json({
        data: {
          ...task,
          type: task.type || "TASK", // Default to TASK if type is not set
          name: task.title, // Add name as alias for title for backward compatibility
          project,
          assignee, // Keep for backward compatibility
          assignees: taskAssignees, // New field for multiple assignees
          reporter, // Task creator info
        },
      });
    } catch {
      return c.json({ error: "Task not found" }, 404);
    }
  })
  .post(
    "/bulk-update",
    sessionMiddleware,
    zValidator(
      "json",
      z.object({
        tasks: z.array(
          z.object({
            $id: z.string(),
            status: z.union([z.nativeEnum(TaskStatus), z.string()]).optional(),
            position: z.number().int().positive().min(1000).max(1_000_000).optional(),
            assigneeId: z.string().optional(), // Keep for backward compatibility
            assigneeIds: z.array(z.string()).optional(), // New field for multiple assignees
          })
        ),
      })
    ),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { tasks } = c.req.valid("json");

      const tasksToUpdate = await databases.listDocuments<Task>(
        DATABASE_ID,
        TASKS_ID,
        [
          Query.contains(
            "$id",
            tasks.map((task) => task.$id)
          ),
        ]
      );

      const workspaceIds = new Set(
        tasksToUpdate.documents.map((task) => task.workspaceId)
      );

      if (workspaceIds.size !== 1) {
        return c.json(
          { error: "All tasks must belong to the same workspace." },
          400
        );
      }

      const workspaceId = workspaceIds.values().next().value;

      if (!workspaceId) {
        return c.json({ error: "Workspace ID is required." }, 400);
      }

      const member = await getMember({
        databases,
        workspaceId: workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      // Project permission check: verify user can edit tasks in each affected project
      const projectIds = [...new Set(tasksToUpdate.documents.map((t) => t.projectId))];
      const { resolveUserProjectAccess, hasProjectPermission, ProjectPermissionKey } = await import("@/lib/permissions/resolveUserProjectAccess");

      for (const projId of projectIds) {
        const projectAccess = await resolveUserProjectAccess(databases, user.$id, projId);
        if (!projectAccess.hasAccess || !hasProjectPermission(projectAccess, ProjectPermissionKey.EDIT_TASKS)) {
          return c.json({ error: `Forbidden: No permission to edit tasks in project ${projId}` }, 403);
        }
      }

      // ======= WORKFLOW TRANSITION VALIDATION FOR BULK UPDATES =======
      // Validate each status transition before performing updates
      const failedValidations: { taskId: string; error: string }[] = [];
      const validTasks: typeof tasks = [];

      // Build a map of existing tasks for quick lookup
      const existingTasksMap = new Map(
        tasksToUpdate.documents.map((task) => [task.$id, task])
      );

      // Get project workflows for validation (reuse projectIds from permission check above)
      const projects = await databases.listDocuments<Project>(
        DATABASE_ID,
        PROJECTS_ID,
        projectIds.length > 0 ? [Query.equal("$id", projectIds)] : []
      );
      const projectWorkflowMap = new Map(
        projects.documents.map((p) => [p.$id, p.workflowId])
      );

      for (const taskUpdate of tasks) {
        const existingTask = existingTasksMap.get(taskUpdate.$id);

        if (!existingTask) {
          failedValidations.push({
            taskId: taskUpdate.$id,
            error: "Task not found",
          });
          continue;
        }

        // If status is changing, validate the transition
        if (taskUpdate.status && existingTask.status !== taskUpdate.status) {
          const workflowId = projectWorkflowMap.get(existingTask.projectId);

          if (workflowId) {
            const validation = await validateStatusTransition(
              databases,
              workflowId,
              existingTask.status,
              taskUpdate.status,
              user.$id,
              existingTask.projectId,  // Use projectId for team lookups
              member.role as string
            );

            if (!validation.allowed) {
              failedValidations.push({
                taskId: taskUpdate.$id,
                error: validation.message || "Status transition not allowed",
              });
              continue;
            }
          }
        }

        validTasks.push(taskUpdate);
      }

      // If all tasks failed validation, return error with details
      if (validTasks.length === 0 && failedValidations.length > 0) {
        return c.json({
          error: "All status transitions were blocked by workflow rules",
          failedValidations,
        }, 403);
      }
      // ======= END WORKFLOW VALIDATION =======

      const updatedTasks = await Promise.all(
        validTasks.map(async (task) => {
          const { $id, status, position, assigneeIds } = task;

          // Get existing task to compare status
          const existingTask = await databases.getDocument<Task>(DATABASE_ID, TASKS_ID, $id);

          const updateData: Partial<Task> = {};

          if (status !== undefined) updateData.status = status;
          if (position !== undefined) updateData.position = position;

          // Handle assignees
          if (assigneeIds !== undefined && assigneeIds.length > 0) {
            updateData.assigneeIds = assigneeIds;
          }

          // Add lastModifiedBy to track who made the update (for audit logs)
          (updateData as Record<string, unknown>).lastModifiedBy = user.$id;

          const updatedTask = await databases.updateDocument<Task>(DATABASE_ID, TASKS_ID, $id, updateData);

          // Notify status changes
          return { task: updatedTask, oldStatus: existingTask.status, statusChanged: status !== undefined && existingTask.status !== status };
        })
      );

      // Send bulk notifications via dispatcher
      const userName = user.name || user.email || "Someone";

      // Process notifications asynchronously (fire and forget)
      (async () => {
        for (const { task, oldStatus, statusChanged } of updatedTasks) {
          // Only emit events for significant changes
          if (statusChanged) {
            if (task.status === "DONE" || task.status === "CLOSED") {
              const event = createCompletedEvent(task, user.$id, userName);
              dispatchWorkitemEvent(event).catch(() => { });
            } else {
              // Resolve status IDs to human-readable names for notifications
              const [oldStatusName, newStatusName] = await Promise.all([
                resolveStatusName(databases, oldStatus || "", task.workspaceId),
                resolveStatusName(databases, task.status, task.workspaceId)
              ]);
              
              const event = createStatusChangedEvent(
                task,
                user.$id,
                userName,
                oldStatusName,
                newStatusName
              );
              dispatchWorkitemEvent(event).catch(() => { });
            }
          }
        }
      })().catch(() => { /* Silent failure for non-critical event dispatch */ });

      // Return success with any partial failures noted
      return c.json({
        data: updatedTasks.map(({ task }) => task),
        ...(failedValidations.length > 0 && {
          partialFailures: failedValidations,
          message: `${validTasks.length} task(s) updated successfully, ${failedValidations.length} blocked by workflow rules`
        })
      });
    }
  );

export default app;

import { ID, Query } from "node-appwrite";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

import { DATABASE_ID, MEMBERS_ID, PROJECTS_ID, TASKS_ID, TIME_LOGS_ID, COMMENTS_ID } from "@/config";
import { sessionMiddleware } from "@/lib/session-middleware";
import { createAdminClient } from "@/lib/appwrite";
import { notifyTaskAssignees, notifyWorkspaceAdmins } from "@/lib/notifications";

import { getMember } from "@/features/members/utils";
import { Project } from "@/features/projects/types";

import { createTaskSchema, updateTaskSchema } from "../schemas";
import { Task, TaskStatus, TaskPriority } from "../types";

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

    // Delete all time logs for this task first
    try {
      const timeLogs = await databases.listDocuments(
        DATABASE_ID,
        TIME_LOGS_ID,
        [Query.equal("taskId", taskId)]
      );

      // Delete all time logs for this task
      for (const timeLog of timeLogs.documents) {
        await databases.deleteDocument(DATABASE_ID, TIME_LOGS_ID, timeLog.$id);
      }

      // Delete the task
      await databases.deleteDocument(DATABASE_ID, TASKS_ID, taskId);

      return c.json({ data: { $id: task.$id } });
    } catch {
      return c.json({ error: "Failed to delete task and related data" }, 500);
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
      })
    ),
    async (c) => {
      const { users } = await createAdminClient();
      const databases = c.get("databases");
      const user = c.get("user");

      const { workspaceId, projectId, assigneeId, status, dueDate, priority, labels } =
        c.req.valid("query");

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
        Query.orderDesc("$createdAt"),
      ];

      if (projectId) {
        query.push(Query.equal("projectId", projectId));
      }

      if (status) {
        query.push(Query.equal("status", status));
      }

      if (assigneeId) {
        // Since Appwrite doesn't support OR queries directly in the native client,
        // we'll handle both assigneeId (legacy) and assigneeIds (new) by using separate queries
        // and merging results, or filtering client-side. For now, we'll query by assigneeIds
        // and handle legacy assigneeId in post-processing.
        query.push(Query.or([
          Query.equal("assigneeId", assigneeId), // Legacy field
          Query.contains("assigneeIds", assigneeId) // New array field
        ]));
      }

      if (dueDate) {
        query.push(Query.equal("dueDate", dueDate));
      }

      // Don't filter by search on server side - we'll do it client side
      // if (search) {
      //   query.push(Query.contains("name", search));
      // }

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

      const tasks = await databases.listDocuments<Task>(
        DATABASE_ID,
        TASKS_ID,
        query
      );

      const projectIds = [...new Set(tasks.documents.map((task) => task.projectId).filter(Boolean))];
      
      // Collect all assignee IDs from both single assignee and multiple assignees
      const allAssigneeIds = new Set<string>();
      tasks.documents.forEach((task) => {
        if (task.assigneeId) {
          allAssigneeIds.add(task.assigneeId);
        }
        if (task.assigneeIds && task.assigneeIds.length > 0) {
          task.assigneeIds.forEach(id => allAssigneeIds.add(id));
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
              Query.limit(5000), // Get enough to count all comments
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

      const assignees = (await Promise.all(
        members.documents.map(async (member) => {
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
            // User not found - skip this member
            return null;
          }
        })
      )).filter((assignee): assignee is NonNullable<typeof assignee> => assignee !== null);

      const populatedTasks = tasks.documents.map((task) => {
        const project = projects.documents.find(
          (project) => project.$id === task.projectId
        );

        // Handle single assignee (backward compatibility)
        const assignee = assignees.find(
          (assignee) => assignee.$id === task.assigneeId
        );

        // Handle multiple assignees
        const taskAssignees = task.assigneeIds
          ? assignees.filter((assignee) => task.assigneeIds!.includes(assignee.$id))
          : assignee ? [assignee] : [];

        return {
          ...task,
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
      const { name, status, workspaceId, projectId, dueDate, assigneeIds, description, estimatedHours, endDate, priority, labels } =
        c.req.valid("json");

      const member = await getMember({
        databases,
        workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
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

      const task = await databases.createDocument(
        DATABASE_ID,
        TASKS_ID,
        ID.unique(),
        {
          name,
          status,
          workspaceId,
          projectId,
          dueDate,
          assigneeId: assigneeIds?.[0] || "", // Keep backward compatibility - use first assignee as primary
          assigneeIds,
          position: newPosition,
          description,
          estimatedHours,
          endDate,
          priority,
          labels,
        }
      ) as Task;

      // Send notifications asynchronously (non-blocking)
      const userName = user.name || user.email || "Someone";
      
      // Notify assignees
      notifyTaskAssignees({
        databases,
        task,
        triggeredByUserId: user.$id,
        triggeredByName: userName,
        notificationType: "task_assigned",
        workspaceId,
      }).catch(() => {});

      // Notify workspace admins
      notifyWorkspaceAdmins({
        databases,
        task,
        triggeredByUserId: user.$id,
        triggeredByName: userName,
        notificationType: "task_assigned",
        workspaceId,
      }).catch(() => {});

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
      const { name, status, projectId, dueDate, assigneeIds, description, estimatedHours, endDate, priority, labels, flagged } =
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

      const updateData: Record<string, unknown> = {};
      
      // Only include fields that are provided
      if (name !== undefined) updateData.name = name;
      if (status !== undefined) updateData.status = status;
      if (projectId !== undefined) updateData.projectId = projectId;
      if (dueDate !== undefined) updateData.dueDate = dueDate;
      if (description !== undefined) updateData.description = description;
      if (estimatedHours !== undefined) updateData.estimatedHours = estimatedHours;
      if (endDate !== undefined) updateData.endDate = endDate;
      if (priority !== undefined) updateData.priority = priority;
      if (labels !== undefined) updateData.labels = labels;
      if (flagged !== undefined) updateData.flagged = flagged;

      // Track if assignees changed for notification purposes
      const oldAssigneeIds = existingTask.assigneeIds || (existingTask.assigneeId ? [existingTask.assigneeId] : []);
      const newAssigneeIds = assigneeIds || [];
      const assigneesChanged = assigneeIds && (
        oldAssigneeIds.length !== newAssigneeIds.length ||
        !oldAssigneeIds.every(id => newAssigneeIds.includes(id))
      );

      // Handle assignees - update both single assignee and multiple assignees
      if (assigneeIds && assigneeIds.length > 0) {
        updateData.assigneeIds = assigneeIds;
        updateData.assigneeId = assigneeIds[0]; // Keep backward compatibility
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

      // Send notifications asynchronously (non-blocking)
      const userName = user.name || user.email || "Someone";
      
      // Track changes for detailed notifications
      const statusChanged = status !== undefined && existingTask.status !== status;
      const priorityChanged = priority !== undefined && existingTask.priority !== priority;
      const dueDateChanged = dueDate !== undefined && String(existingTask.dueDate) !== String(dueDate);
      
      // Determine notification type based on what changed
      let notificationType: "task_assigned" | "task_completed" | "task_updated" | "task_status_changed" | "task_priority_changed" | "task_due_date_changed";
      
      if (assigneesChanged) {
        notificationType = "task_assigned"; // New assignees should get "assigned" notification
      } else if (status === "CLOSED" && statusChanged) {
        notificationType = "task_completed";
      } else if (statusChanged) {
        notificationType = "task_status_changed";
      } else if (priorityChanged) {
        notificationType = "task_priority_changed";
      } else if (dueDateChanged) {
        notificationType = "task_due_date_changed";
      } else {
        notificationType = "task_updated"; // This covers other updates
      }

      // Prepare metadata with change information
      const changeMetadata = {
        ...(statusChanged && { oldStatus: existingTask.status, newStatus: status }),
        ...(priorityChanged && { oldPriority: existingTask.priority, newPriority: priority }),
        ...(dueDateChanged && { oldDueDate: existingTask.dueDate, newDueDate: dueDate }),
      };
      
      // Notify assignees
      notifyTaskAssignees({
        databases,
        task,
        triggeredByUserId: user.$id,
        triggeredByName: userName,
        notificationType,
        workspaceId: existingTask.workspaceId,
        metadata: changeMetadata,
      }).catch((error) => {
        console.error('Failed to notify assignees:', error);
      });

      // Notify workspace admins
      notifyWorkspaceAdmins({
        databases,
        task,
        triggeredByUserId: user.$id,
        triggeredByName: userName,
        notificationType,
        workspaceId: existingTask.workspaceId,
        metadata: changeMetadata,
      }).catch((error) => {
        console.error('Failed to notify workspace admins:', error);
      });

      return c.json({ data: task });
    }
  )
  .get("/:taskId", sessionMiddleware, async (c) => {
    const currentUser = c.get("user");
    const databases = c.get("databases");
    const { users } = await createAdminClient();

    const { taskId } = c.req.param();

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

    const project = await databases.getDocument<Project>(
      DATABASE_ID,
      PROJECTS_ID,
      task.projectId
    );

    // Collect all assignee IDs from both single assignee and multiple assignees
    const allAssigneeIds = new Set<string>();
    if (task.assigneeId) {
      allAssigneeIds.add(task.assigneeId);
    }
    if (task.assigneeIds && task.assigneeIds.length > 0) {
      task.assigneeIds.forEach(id => allAssigneeIds.add(id));
    }

    // Get all assignee members
    const members = await databases.listDocuments(
      DATABASE_ID,
      MEMBERS_ID,
      allAssigneeIds.size > 0 ? [Query.contains("$id", Array.from(allAssigneeIds))] : []
    );

    const assignees = await Promise.all(
      members.documents.map(async (member) => {
        const user = await users.get(member.userId);
        const prefs = user.prefs as { profileImageUrl?: string | null } | undefined;

        return {
          ...member,
          name: user.name || user.email,
          email: user.email,
          profileImageUrl: prefs?.profileImageUrl ?? null,
        };
      })
    );

    // Handle single assignee (backward compatibility)
    const assignee = assignees.find(
      (assignee) => assignee.$id === task.assigneeId
    );

    // Handle multiple assignees
    const taskAssignees = task.assigneeIds
      ? assignees.filter((assignee) => task.assigneeIds!.includes(assignee.$id))
      : assignee ? [assignee] : [];

    return c.json({
      data: {
        ...task,
        project,
        assignee, // Keep for backward compatibility
        assignees: taskAssignees, // New field for multiple assignees
      },
    });
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

      const updatedTasks = await Promise.all(
        tasks.map(async (task) => {
          const { $id, status, position, assigneeId, assigneeIds } = task;
          
          // Get existing task to compare status
          const existingTask = await databases.getDocument<Task>(DATABASE_ID, TASKS_ID, $id);
          
          const updateData: Partial<Task> = {};
          
          if (status !== undefined) updateData.status = status;
          if (position !== undefined) updateData.position = position;
          
          // Handle assignees - prioritize assigneeIds over assigneeId
          if (assigneeIds !== undefined && assigneeIds.length > 0) {
            updateData.assigneeIds = assigneeIds;
            updateData.assigneeId = assigneeIds[0]; // Keep backward compatibility
          } else if (assigneeId !== undefined) {
            updateData.assigneeId = assigneeId;
            updateData.assigneeIds = [assigneeId]; // Convert single to array
          }
          
          // Add lastModifiedBy to track who made the update (for audit logs)
          (updateData as Record<string, unknown>).lastModifiedBy = user.$id;
          
          const updatedTask = await databases.updateDocument<Task>(DATABASE_ID, TASKS_ID, $id, updateData);
          
          // Return both old and new task for notification metadata
          return { task: updatedTask, oldStatus: existingTask.status, statusChanged: status !== undefined && existingTask.status !== status };
        })
      );

      // Send notifications for bulk updates (non-blocking)
      const userName = user.name || user.email || "Someone";
      
      updatedTasks.forEach(({ task, oldStatus, statusChanged }) => {
        // Determine notification type based on what changed
        let notificationType: "task_completed" | "task_status_changed" | "task_updated";
        
        if (task.status === "CLOSED" && statusChanged) {
          notificationType = "task_completed";
        } else if (statusChanged) {
          notificationType = "task_status_changed";
        } else {
          notificationType = "task_updated";
        }
        
        // Notify assignees
        notifyTaskAssignees({
          databases,
          task,
          triggeredByUserId: user.$id,
          triggeredByName: userName,
          notificationType,
          workspaceId: task.workspaceId,
          metadata: statusChanged ? {
            oldStatus,
            newStatus: task.status,
          } : undefined,
        }).catch(() => {});

        // Notify workspace admins
        notifyWorkspaceAdmins({
          databases,
          task,
          triggeredByUserId: user.$id,
          triggeredByName: userName,
          notificationType,
          workspaceId: task.workspaceId,
          metadata: statusChanged ? {
            oldStatus,
            newStatus: task.status,
          } : undefined,
        }).catch(() => {});
      });

      return c.json({ data: updatedTasks.map(({ task }) => task) });
    }
  );

export default app;

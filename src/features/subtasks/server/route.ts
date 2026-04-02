import { ID, Query } from "node-appwrite";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

import { DATABASE_ID, SUBTASKS_ID } from "@/config";
import { sessionMiddleware } from "@/lib/session-middleware";

import { getMember } from "@/features/members/utils";
// Usage metering for billing - every action must be metered
import { logComputeUsage, getComputeUnits } from "@/lib/usage-metering";

import { createSubtaskSchema, updateSubtaskSchema } from "../schemas";
import { Subtask } from "../types";

const app = new Hono()
  // Get all subtasks for a work item
  .get(
    "/",
    sessionMiddleware,
    zValidator(
      "query",
      z.object({
        workspaceId: z.string(),
        parentTaskId: z.string(),
      })
    ),
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");
 
      const { workspaceId, parentTaskId } = c.req.valid("query");
 
      const member = await getMember({
        databases,
        workspaceId,
        userId: user.$id,
      });
 
      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }
 
      const subtasks = await databases.listDocuments<Subtask>(
        DATABASE_ID,
        SUBTASKS_ID,
        [
          Query.equal("parentTaskId", parentTaskId),
          Query.orderAsc("position"),
        ]
      );
 
      return c.json({ data: subtasks });
    }
  )
  .post(
    "/",
    sessionMiddleware,
    zValidator("json", createSubtaskSchema),
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");

      const { 
        title, 
        description,
        parentTaskId, 
        workspaceId, 
        assigneeId, 
        dueDate, 
        estimatedHours, 
        priority, 
        isCompleted 
      } = c.req.valid("json");

      const member = await getMember({
        databases,
        workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      // Get the highest position for this work item
      const existingSubtasks = await databases.listDocuments(
        DATABASE_ID,
        SUBTASKS_ID,
        [
          Query.equal("parentTaskId", parentTaskId),
          Query.orderDesc("position"),
          Query.limit(1),
        ]
      );

      const highestPosition =
        existingSubtasks.documents.length > 0
          ? existingSubtasks.documents[0].position
          : 0;

      const subtask = await databases.createDocument<Subtask>(
        DATABASE_ID,
        SUBTASKS_ID,
        ID.unique(),
        {
          title,
          description,
          parentTaskId,
          workspaceId,
          isCompleted: isCompleted || false,
          position: highestPosition + 1000,
          createdBy: user.$id,
          assigneeId: assigneeId || null,
          dueDate: dueDate || null,
          estimatedHours: estimatedHours || null,
          priority: priority || "MEDIUM",
        }
      );

      // Log compute usage for billing - every action must be metered
      logComputeUsage({
        databases,
        workspaceId,
        units: getComputeUnits('subtask_create'),
        jobType: 'subtask_create',
        operationId: subtask.$id,
      });

      return c.json({ data: subtask });
    }
  )
  // Update a subtask
  .patch(
    "/:subtaskId",
    sessionMiddleware,
    zValidator("json", updateSubtaskSchema),
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");
      const { subtaskId } = c.req.param();

      const subtask = await databases.getDocument<Subtask>(
        DATABASE_ID,
        SUBTASKS_ID,
        subtaskId
      );

      const member = await getMember({
        databases,
        workspaceId: subtask.workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const updates = { ...c.req.valid("json") };
 
      const updatedSubtask = await databases.updateDocument<Subtask>(
        DATABASE_ID,
        SUBTASKS_ID,
        subtaskId,
        updates
      );

      // Log compute usage for billing
      logComputeUsage({
        databases,
        workspaceId: subtask.workspaceId,
        units: getComputeUnits('subtask_update'),
        jobType: 'subtask_update',
        operationId: subtaskId,
      });

      return c.json({ data: updatedSubtask });
    }
  )
  // Delete a subtask
  .delete(
    "/:subtaskId",
    sessionMiddleware,
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");
      const { subtaskId } = c.req.param();

      const subtask = await databases.getDocument<Subtask>(
        DATABASE_ID,
        SUBTASKS_ID,
        subtaskId
      );

      const member = await getMember({
        databases,
        workspaceId: subtask.workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      await databases.deleteDocument(DATABASE_ID, SUBTASKS_ID, subtaskId);

      // Log compute usage for billing
      logComputeUsage({
        databases,
        workspaceId: subtask.workspaceId,
        units: getComputeUnits('subtask_delete'),
        jobType: 'subtask_delete',
        operationId: subtaskId,
      });

      return c.json({ data: { $id: subtask.$id } });
    }
  )
  // Reorder subtasks
  .post(
    "/reorder",
    sessionMiddleware,
    zValidator(
      "json",
      z.object({
        subtaskId: z.string(),
        newPosition: z.number(),
      })
    ),
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");

      const { subtaskId, newPosition } = c.req.valid("json");

      const subtask = await databases.getDocument<Subtask>(
        DATABASE_ID,
        SUBTASKS_ID,
        subtaskId
      );

      const member = await getMember({
        databases,
        workspaceId: subtask.workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const updatedSubtask = await databases.updateDocument<Subtask>(
        DATABASE_ID,
        SUBTASKS_ID,
        subtaskId,
        { position: newPosition }
      );

      return c.json({ data: updatedSubtask });
    }
  );

export default app;

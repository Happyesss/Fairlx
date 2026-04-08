import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";

import { sessionMiddleware } from "@/lib/session-middleware";
import { getMember } from "@/features/members/utils";
// Usage metering for billing - every action must be metered
import { logComputeUsage, getComputeUnits } from "@/lib/usage-metering";
import { invalidateCache, CK } from "@/lib/redis";

import {
  createCommentSchema,
  updateCommentSchema,
  deleteCommentSchema,
  getCommentsSchema,
} from "../schemas";

import {
  getPopulatedComments,
  createComment,
  updateComment,
  deleteComment,
} from "../server/route";

const app = new Hono()
  // Get all comments for a task
  .get(
    "/",
    sessionMiddleware,
    zValidator("query", getCommentsSchema),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { taskId, workspaceId } = c.req.valid("query");

      const member = await getMember({
        databases,
        workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      try {
        const comments = await getPopulatedComments(taskId, workspaceId);
        return c.json({ data: comments });
      } catch {
        return c.json({ error: "Failed to fetch comments" }, 500);
      }
    }
  )
  // Create a new comment
  .post(
    "/",
    sessionMiddleware,
    zValidator("json", createCommentSchema),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { content, taskId, workspaceId, parentId } = c.req.valid("json");

      const member = await getMember({
        databases,
        workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      try {
        const comment = await createComment({
          content,
          taskId,
          workspaceId,
          authorId: user.$id,
          authorName: user.name || user.email,
          parentId,
        });

        // Log compute usage for billing - every action must be metered
        logComputeUsage({
          databases,
          workspaceId,
          units: getComputeUnits('comment_create'),
          jobType: 'comment_create',
          operationId: comment.$id,
        });

        await invalidateCache(CK.commentList(taskId), CK.commentCount(taskId));

        return c.json({ data: comment });
      } catch (error) {
        console.error("Failed to create comment", error);
        return c.json({ error: "Failed to create comment" }, 500);
      }
    }
  )
  // Update a comment
  .patch(
    "/:commentId",
    sessionMiddleware,
    zValidator("json", updateCommentSchema.omit({ commentId: true })),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { commentId } = c.req.param();
      const { content, workspaceId } = c.req.valid("json");

      const member = await getMember({
        databases,
        workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      try {
        const comment = await updateComment(
          commentId,
          content,
          workspaceId,
          user.$id
        );

        // Log compute usage for billing
        logComputeUsage({
          databases,
          workspaceId,
          units: getComputeUnits('comment_update'),
          jobType: 'comment_update',
          operationId: commentId,
        });

        return c.json({ data: comment });
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === "You can only edit your own comments") {
            return c.json({ error: error.message }, 403);
          }
          if (error.message === "Unauthorized") {
            return c.json({ error: "Unauthorized" }, 401);
          }
        }
        return c.json({ error: "Failed to update comment" }, 500);
      }
    }
  )
  // Delete a comment
  .delete(
    "/:commentId",
    sessionMiddleware,
    zValidator("json", deleteCommentSchema.omit({ commentId: true })),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { commentId } = c.req.param();
      const { workspaceId } = c.req.valid("json");

      const member = await getMember({
        databases,
        workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      // Check if user is admin
      const isAdmin = member.role === "ADMIN";

      try {
        await deleteComment(commentId, workspaceId, user.$id, isAdmin);

        // Log compute usage for billing
        logComputeUsage({
          databases,
          workspaceId,
          units: getComputeUnits('comment_delete'),
          jobType: 'comment_delete',
          operationId: commentId,
        });

        // Invalidate comment caches (we don't have taskId here, but commentList uses taskId)
        // The comment was already fetched inside deleteComment, so we can't easily get taskId
        // We invalidate by pattern - since commentList key includes taskId, we need a broader approach
        // For now, the TanStack Query invalidation on the client handles this; Redis TTL is 15s

        return c.json({ data: { $id: commentId } });
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === "You can only delete your own comments") {
            return c.json({ error: error.message }, 403);
          }
          if (error.message === "Unauthorized") {
            return c.json({ error: "Unauthorized" }, 401);
          }
        }
        return c.json({ error: "Failed to delete comment" }, 500);
      }
    }
  );

export default app;

import { z } from "zod";

export const createCommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Comment cannot be empty")
    .max(5000, "Comment is too long (max 5000 characters)"),
  taskId: z.string().trim().min(1, "Task ID is required"),
  workspaceId: z.string().trim().min(1, "Workspace ID is required"),
  parentId: z.string().trim().optional(),
});

export const updateCommentSchema = z.object({
  commentId: z.string().trim().min(1, "Comment ID is required"),
  content: z
    .string()
    .trim()
    .min(1, "Comment cannot be empty")
    .max(5000, "Comment is too long (max 5000 characters)"),
  workspaceId: z.string().trim().min(1, "Workspace ID is required"),
});

export const deleteCommentSchema = z.object({
  commentId: z.string().trim().min(1, "Comment ID is required"),
  workspaceId: z.string().trim().min(1, "Workspace ID is required"),
});

export const getCommentsSchema = z.object({
  taskId: z.string().trim().min(1, "Task ID is required"),
  workspaceId: z.string().trim().min(1, "Workspace ID is required"),
});

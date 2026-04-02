import { z } from "zod";

export const createSubtaskSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().optional(),
  parentTaskId: z.string().trim().min(1, "Parent Task ID is required"),
  workspaceId: z.string().trim().min(1, "Workspace ID is required"),
  isCompleted: z.boolean().default(false),
  assigneeId: z.string().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).default("TODO"),
  dueDate: z.string().optional(),
  estimatedHours: z.number().min(0).max(1000).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  // Backward compatibility
  workItemId: z.string().optional(),
  completed: z.boolean().optional(),
});

export const updateSubtaskSchema = z.object({
  title: z.string().trim().min(1, "Title is required").optional(),
  description: z.string().optional(),
  isCompleted: z.boolean().optional(),
  completed: z.boolean().optional(),
  position: z.number().optional(),
  assigneeId: z.string().nullable().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
  dueDate: z.string().nullable().optional(),
  estimatedHours: z.number().min(0).max(1000).nullable().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
});

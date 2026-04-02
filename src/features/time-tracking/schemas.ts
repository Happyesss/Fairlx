import { z } from "zod";

export const createTimeLogSchema = z.object({
  taskId: z.string().trim().min(1, "Task is required"),
  logDate: z.coerce.date(),
  loggedHours: z.number().min(0.01, "Hours must be at least 0.01").max(24, "Hours cannot exceed 24").step(0.01),
  description: z.string().trim().min(1, "Description is required"),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
});

export const updateTimeLogSchema = z.object({
  logDate: z.coerce.date().optional(),
  loggedHours: z.number().min(0.01, "Hours must be at least 0.01").max(24, "Hours cannot exceed 24").step(0.01).optional(),
  description: z.string().trim().min(1, "Description is required").optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
});

export const timesheetQuerySchema = z.object({
  workspaceId: z.string().trim().min(1, "Workspace is required"),
  userId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  projectId: z.string().optional(),
});

export const estimateVsActualQuerySchema = z.object({
  workspaceId: z.string().trim().min(1, "Workspace is required"),
  projectId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

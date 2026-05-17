import { z } from "zod";

import { WorkItemType, WorkItemPriority, WorkItemStatus, SprintStatus } from "./types";

// Sprint Schemas
export const createSprintSchema = z.object({
  name: z.string().trim().min(1, "Sprint name is required"),
  workspaceId: z.string().trim().min(1, "Required"),
  projectId: z.string().trim().min(1, "Required"),
  status: z.nativeEnum(SprintStatus).default(SprintStatus.PLANNED),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  goal: z.string().trim().optional(),
}).refine(
  (data) => {
    if (data.endDate && data.startDate) {
      return data.endDate >= data.startDate;
    }
    return true;
  },
  {
    message: "End date must be after or equal to start date",
    path: ["endDate"],
  }
);

export const updateSprintSchema = z.object({
  name: z.string().trim().min(1, "Sprint name is required").optional(),
  status: z.nativeEnum(SprintStatus).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  goal: z.string().trim().optional(),
  position: z.number().optional(),
}).refine(
  (data) => {
    if (data.endDate && data.startDate) {
      return data.endDate >= data.startDate;
    }
    return true;
  },
  {
    message: "End date must be after or equal to start date",
    path: ["endDate"],
  }
);

// Work Item Schemas
// Work Item Schemas
export const createWorkItemSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  type: z.union([z.nativeEnum(WorkItemType), z.string()]).default(WorkItemType.STORY),
  status: z.union([z.nativeEnum(WorkItemStatus), z.string()]).default(WorkItemStatus.TODO),
  priority: z.union([z.nativeEnum(WorkItemPriority), z.string()]).default(WorkItemPriority.MEDIUM),
  storyPoints: z.number().min(0).max(100).optional(),
  workspaceId: z.string().trim().min(1, "Required"),
  projectId: z.string().trim().min(1, "Required"),
  sprintId: z.string().trim().optional().nullable(),
  epicId: z.string().trim().optional().nullable(),
  parentId: z.string().trim().optional().nullable(),
  assigneeIds: z.array(z.string().trim().min(1)).default([]),
  description: z.string().nullable().optional(),
  flagged: z.boolean().default(false),
  startDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
  estimatedHours: z
    .union([z.number().min(0), z.string(), z.undefined(), z.null()])
    .transform((val) => {
      if (val === "" || val === null || val === undefined) return undefined;
      const num = typeof val === "string" ? parseFloat(val) : val;
      return isNaN(num) ? undefined : num;
    })
    .optional(),
  labels: z.array(z.string()).optional(),
});

export const updateWorkItemSchema = z.object({
  title: z.string().trim().min(1, "Title is required").optional(),
  type: z.union([z.nativeEnum(WorkItemType), z.string()]).optional(),
  status: z.union([z.nativeEnum(WorkItemStatus), z.string()]).optional(),
  priority: z.union([z.nativeEnum(WorkItemPriority), z.string()]).optional(),
  storyPoints: z.number().min(0).max(100).optional().nullable(),
  sprintId: z.string().trim().optional().nullable(),
  epicId: z.string().trim().optional().nullable(),
  parentId: z.string().trim().optional().nullable(),
  assigneeIds: z.array(z.string().trim().min(1)).optional(),
  description: z.string().nullable().optional(),
  flagged: z.boolean().optional(),
  position: z.number().optional(),
  startDate: z.coerce.date().optional().nullable(),
  dueDate: z.coerce.date().optional(),
  estimatedHours: z
    .union([z.number().min(0), z.string(), z.undefined(), z.null()])
    .transform((val) => {
      if (val === "" || val === null || val === undefined) return undefined;
      const num = typeof val === "string" ? parseFloat(val) : val;
      return isNaN(num) ? undefined : num;
    })
    .optional(),
  labels: z.array(z.string()).optional(),
});

export const bulkMoveWorkItemsSchema = z.object({
  workItemIds: z.array(z.string()),
  sprintId: z.string().nullable(),
});

export const reorderWorkItemsSchema = z.object({
  workItemId: z.string(),
  newPosition: z.number(),
  sprintId: z.string().optional().nullable(),
});

export const reorderSprintsSchema = z.object({
  sprintId: z.string(),
  newPosition: z.number(),
});

export const splitWorkItemSchema = z.object({
  originalWorkItemId: z.string(),
  newWorkItems: z.array(
    z.object({
      title: z.string().trim().min(1),
      storyPoints: z.number().min(0).max(100).optional(),
    })
  ).min(2, "Must create at least 2 items when splitting"),
});

import { z } from "zod";
import { StatusType } from "./types";

// Create a new workflow
export const createWorkflowSchema = z.object({
  name: z.string().trim().min(1, "Workflow name is required").max(100),
  key: z.string().trim().min(1, "Workflow key is required").max(50)
    .transform((v) => v.toUpperCase().replace(/[\s-]+/g, "_"))
    .refine((v) => /^[A-Z][A-Z0-9_]*$/.test(v), "Key must start with a letter and contain only letters, numbers, and underscores"),
  description: z.string().trim().max(500).optional(),
  workspaceId: z.string().min(1),
  projectId: z.string().optional(),
  spaceId: z.string().optional(),
  isDefault: z.boolean().default(false),
  copyFromWorkflowId: z.string().optional(), // Clone from existing workflow
  statuses: z.array(z.object({
    name: z.string().trim().min(1).max(50),
    key: z.string().trim().min(1).max(30)
      .transform((v) => v.toUpperCase().replace(/[\s-]+/g, "_")),
    icon: z.string().min(1).default("Circle"),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    statusType: z.nativeEnum(StatusType).default(StatusType.OPEN),
    position: z.number().min(0).optional(),
    isInitial: z.boolean().default(false),
    isFinal: z.boolean().default(false),
  })).optional(),
  transitions: z.array(z.object({
    fromStatusKey: z.string(),
    toStatusKey: z.string(),
    name: z.string().optional(),
    allowedTeamIds: z.array(z.string()).optional(),
    requiresApproval: z.boolean().optional(),
  })).optional(),
});

// Update workflow
export const updateWorkflowSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  isDefault: z.boolean().optional(),
  isArchived: z.boolean().optional(),
});

// Create a status in a workflow
export const createWorkflowStatusSchema = z.object({
  workflowId: z.string().min(1),
  name: z.string().trim().min(1, "Status name is required").max(50),
  key: z.string().trim().min(1).max(30)
    .transform((v) => v.toUpperCase().replace(/[\s-]+/g, "_"))
    .refine((v) => /^[A-Z][A-Z0-9_]*$/.test(v), "Key must start with a letter and contain only letters, numbers, and underscores"),
  icon: z.string().min(1).default("Circle"),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color"),
  statusType: z.nativeEnum(StatusType).default(StatusType.OPEN),
  description: z.string().trim().max(200).optional(),
  position: z.number().min(0).optional(),
  positionX: z.number().default(0),
  positionY: z.number().default(0),
  isInitial: z.boolean().default(false),
  isFinal: z.boolean().default(false),
});

// Update a status
export const updateWorkflowStatusSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  icon: z.string().min(1).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color").optional(),
  statusType: z.nativeEnum(StatusType).optional(),
  description: z.string().trim().max(200).optional().nullable(),
  position: z.number().min(0).optional(),
  positionX: z.number().optional(),
  positionY: z.number().optional(),
  isInitial: z.boolean().optional(),
  isFinal: z.boolean().optional(),
});

// Transition condition schema
export const transitionConditionSchema = z.object({
  type: z.enum(["ALL_SUBTASKS_DONE", "APPROVAL_RECEIVED", "CUSTOM"]),
  customLogic: z.string().optional(),
}).optional().nullable();

// Create a transition between statuses
export const createWorkflowTransitionSchema = z.object({
  workflowId: z.string().min(1),
  fromStatusId: z.string().min(1),
  toStatusId: z.string().min(1),
  name: z.string().trim().max(50).optional(),
  description: z.string().trim().max(200).optional(),
  
  // Team-based access control
  allowedTeamIds: z.array(z.string()).optional(),
  allowedMemberRoles: z.array(z.string()).optional(),
  
  // Approval workflow
  requiresApproval: z.boolean().default(false),
  approverTeamIds: z.array(z.string()).optional(),
  
  // Automation (not yet implemented in database)
  // autoTransition: z.boolean().default(false),
  // conditions: transitionConditionSchema,
});

// Update a transition
export const updateWorkflowTransitionSchema = z.object({
  name: z.string().trim().max(50).optional().nullable(),
  description: z.string().trim().max(200).optional().nullable(),
  
  // Team-based access control
  allowedTeamIds: z.array(z.string()).optional().nullable(),
  allowedMemberRoles: z.array(z.string()).optional().nullable(),
  
  // Approval workflow
  requiresApproval: z.boolean().optional(),
  approverTeamIds: z.array(z.string()).optional().nullable(),
  
  // Automation (not yet implemented in database)
  // autoTransition: z.boolean().optional(),
  // conditions: transitionConditionSchema,
});

// Validate a status transition (for work item updates)
export const validateTransitionSchema = z.object({
  workflowId: z.string().min(1),
  fromStatusId: z.string().min(1),
  toStatusId: z.string().min(1),
  userId: z.string().min(1),
  userTeamIds: z.array(z.string()).optional(), // User's team memberships for rule checking
  workItemData: z.record(z.unknown()).optional(), // Work item fields for validation
});

// Bulk create statuses (for workflow templates)
export const bulkCreateStatusesSchema = z.object({
  workflowId: z.string().min(1),
  statuses: z.array(z.object({
    name: z.string().trim().min(1).max(50),
    key: z.string().trim().min(1).max(30)
      .transform((v) => v.toUpperCase().replace(/[\s-]+/g, "_")),
    icon: z.string().min(1).default("Circle"),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    statusType: z.nativeEnum(StatusType).default(StatusType.OPEN),
    position: z.number().min(0),
    isInitial: z.boolean().default(false),
    isFinal: z.boolean().default(false),
  })),
});

// Bulk create transitions
export const bulkCreateTransitionsSchema = z.object({
  workflowId: z.string().min(1),
  transitions: z.array(z.object({
    fromStatusKey: z.string(),
    toStatusKey: z.string(),
    name: z.string().optional(),
    allowedTeamIds: z.array(z.string()).optional(),
    requiresApproval: z.boolean().optional(),
  })),
  allowAll: z.boolean().default(false), // If true, create all possible transitions
});

import { z } from "zod";
import { WorkItemLinkType } from "./types";

// Create a link between work items
export const createWorkItemLinkSchema = z.object({
  workspaceId: z.string().min(1),
  sourceItemId: z.string().min(1, "Source work item is required"),
  targetItemId: z.string().min(1, "Target work item is required"),
  linkType: z.nativeEnum(WorkItemLinkType),
  description: z.string().max(500).optional(),
  createInverse: z.boolean().default(true), // Create the inverse link automatically
}).refine(
  (data) => data.sourceItemId !== data.targetItemId,
  { message: "Cannot link a work item to itself", path: ["targetItemId"] }
);

// Update a link (mainly for description)
export const updateWorkItemLinkSchema = z.object({
  description: z.string().max(500).optional().nullable(),
});

// Delete a link
export const deleteWorkItemLinkSchema = z.object({
  linkId: z.string().min(1),
  deleteInverse: z.boolean().default(true), // Delete the inverse link automatically
});

// Bulk create links (for cloning/splitting)
export const bulkCreateLinksSchema = z.object({
  workspaceId: z.string().min(1),
  links: z.array(z.object({
    sourceItemId: z.string().min(1),
    targetItemId: z.string().min(1),
    linkType: z.nativeEnum(WorkItemLinkType),
    description: z.string().max(500).optional(),
  })),
  createInverses: z.boolean().default(true),
});

// Get links for a work item
export const getWorkItemLinksSchema = z.object({
  workItemId: z.string().min(1),
  linkTypes: z.array(z.nativeEnum(WorkItemLinkType)).optional(), // Filter by types
  direction: z.enum(["outgoing", "incoming", "both"]).default("both"),
});

// Check if work item is blocked
export const checkBlockedStatusSchema = z.object({
  workItemId: z.string().min(1),
});

// Find dependency chain (for detecting cycles)
export const findDependencyChainSchema = z.object({
  sourceItemId: z.string().min(1),
  targetItemId: z.string().min(1),
  linkType: z.nativeEnum(WorkItemLinkType),
});

// Link suggestion schema (for AI-powered suggestions)
export const getLinkSuggestionsSchema = z.object({
  workItemId: z.string().min(1),
  workspaceId: z.string().min(1),
  projectId: z.string().optional(),
  limit: z.number().min(1).max(20).default(5),
});

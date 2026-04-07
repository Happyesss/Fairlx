import { Models } from "node-appwrite";

// Types of links between work items
export enum WorkItemLinkType {
  // Dependency links
  BLOCKS = "BLOCKS",               // This item blocks another
  IS_BLOCKED_BY = "IS_BLOCKED_BY", // This item is blocked by another
  
  // Relationship links
  RELATES_TO = "RELATES_TO",       // Generic relationship
  DUPLICATES = "DUPLICATES",       // This is a duplicate of another
  IS_DUPLICATED_BY = "IS_DUPLICATED_BY", // Another item duplicates this
  
  // Derivation links
  SPLIT_FROM = "SPLIT_FROM",       // This was split from another item
  SPLIT_TO = "SPLIT_TO",           // Another item was split from this
  CLONED_FROM = "CLONED_FROM",     // This was cloned from another
  CLONED_TO = "CLONED_TO",         // Another item was cloned from this
  
  // Hierarchical links (alternative to epicId/parentId)
  IS_CHILD_OF = "IS_CHILD_OF",     // Parent-child relationship
  IS_PARENT_OF = "IS_PARENT_OF",   // Parent-child relationship (reverse)
  
  // Cause links
  CAUSES = "CAUSES",               // This issue causes another
  IS_CAUSED_BY = "IS_CAUSED_BY",   // This issue is caused by another
}

// Link type metadata for UI and logic
export const LINK_TYPE_METADATA: Record<WorkItemLinkType, {
  label: string;
  inverseType: WorkItemLinkType;
  description: string;
  category: "dependency" | "relationship" | "derivation" | "hierarchy" | "cause";
  color: string;
}> = {
  [WorkItemLinkType.BLOCKS]: {
    label: "blocks",
    inverseType: WorkItemLinkType.IS_BLOCKED_BY,
    description: "This item blocks another from progressing",
    category: "dependency",
    color: "#EF4444",
  },
  [WorkItemLinkType.IS_BLOCKED_BY]: {
    label: "is blocked by",
    inverseType: WorkItemLinkType.BLOCKS,
    description: "This item cannot progress until another is completed",
    category: "dependency",
    color: "#F59E0B",
  },
  [WorkItemLinkType.RELATES_TO]: {
    label: "relates to",
    inverseType: WorkItemLinkType.RELATES_TO, // Symmetric
    description: "This item is related to another",
    category: "relationship",
    color: "#3B82F6",
  },
  [WorkItemLinkType.DUPLICATES]: {
    label: "duplicates",
    inverseType: WorkItemLinkType.IS_DUPLICATED_BY,
    description: "This item is a duplicate of another",
    category: "relationship",
    color: "#8B5CF6",
  },
  [WorkItemLinkType.IS_DUPLICATED_BY]: {
    label: "is duplicated by",
    inverseType: WorkItemLinkType.DUPLICATES,
    description: "Another item is a duplicate of this",
    category: "relationship",
    color: "#8B5CF6",
  },
  [WorkItemLinkType.SPLIT_FROM]: {
    label: "was split from",
    inverseType: WorkItemLinkType.SPLIT_TO,
    description: "This item was created by splitting another",
    category: "derivation",
    color: "#10B981",
  },
  [WorkItemLinkType.SPLIT_TO]: {
    label: "was split to",
    inverseType: WorkItemLinkType.SPLIT_FROM,
    description: "Another item was created by splitting this",
    category: "derivation",
    color: "#10B981",
  },
  [WorkItemLinkType.CLONED_FROM]: {
    label: "was cloned from",
    inverseType: WorkItemLinkType.CLONED_TO,
    description: "This item was cloned from another",
    category: "derivation",
    color: "#6366F1",
  },
  [WorkItemLinkType.CLONED_TO]: {
    label: "was cloned to",
    inverseType: WorkItemLinkType.CLONED_FROM,
    description: "Another item was cloned from this",
    category: "derivation",
    color: "#6366F1",
  },
  [WorkItemLinkType.IS_CHILD_OF]: {
    label: "is child of",
    inverseType: WorkItemLinkType.IS_PARENT_OF,
    description: "This item is a sub-item of another",
    category: "hierarchy",
    color: "#059669",
  },
  [WorkItemLinkType.IS_PARENT_OF]: {
    label: "is parent of",
    inverseType: WorkItemLinkType.IS_CHILD_OF,
    description: "This item is the parent of another",
    category: "hierarchy",
    color: "#059669",
  },
  [WorkItemLinkType.CAUSES]: {
    label: "causes",
    inverseType: WorkItemLinkType.IS_CAUSED_BY,
    description: "This issue causes another",
    category: "cause",
    color: "#DC2626",
  },
  [WorkItemLinkType.IS_CAUSED_BY]: {
    label: "is caused by",
    inverseType: WorkItemLinkType.CAUSES,
    description: "This issue is caused by another",
    category: "cause",
    color: "#DC2626",
  },
};

// Work item link entity
export type WorkItemLink = Models.Document & {
  workspaceId: string;
  sourceItemId: string;       // The "from" work item
  targetItemId: string;       // The "to" work item
  linkType: WorkItemLinkType;
  description?: string | null;  // Optional description of the link
  createdBy: string;            // User who created the link
};

// Populated types for UI
export type PopulatedWorkItemLink = WorkItemLink & {
  sourceWorkItem?: {
    $id: string;
    key: string;
    title: string;
    type: string;
    status: string;
  };
  targetWorkItem?: {
    $id: string;
    key: string;
    title: string;
    type: string;
    status: string;
  };
  creator?: {
    $id: string;
    name: string;
  };
};

// Grouped links for displaying on work item detail
export type GroupedWorkItemLinks = {
  outgoing: PopulatedWorkItemLink[];  // Links where this item is the source
  incoming: PopulatedWorkItemLink[];  // Links where this item is the target
  byType: Record<WorkItemLinkType, PopulatedWorkItemLink[]>;
  blockingCount: number;              // How many items this blocks
  blockedByCount: number;             // How many items block this
};

// Helper to get inverse link type
export function getInverseLinkType(linkType: WorkItemLinkType): WorkItemLinkType {
  return LINK_TYPE_METADATA[linkType].inverseType;
}

// Helper to check if a link type is blocking
export function isBlockingLinkType(linkType: WorkItemLinkType): boolean {
  return linkType === WorkItemLinkType.BLOCKS || linkType === WorkItemLinkType.IS_BLOCKED_BY;
}

// Helper to get link categories for filtering
export function getLinkCategories(): string[] {
  return ["dependency", "relationship", "derivation", "hierarchy", "cause"];
}

// Helper to get link types by category
export function getLinkTypesByCategory(category: string): WorkItemLinkType[] {
  return Object.entries(LINK_TYPE_METADATA)
    .filter(([, meta]) => meta.category === category)
    .map(([type]) => type as WorkItemLinkType);
}

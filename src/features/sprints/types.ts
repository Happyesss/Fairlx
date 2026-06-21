import { Models } from "node-appwrite";

export enum WorkItemType {
  STORY = "STORY",
  BUG = "BUG",
  TASK = "TASK",
  EPIC = "EPIC",
  SUBTASK = "SUBTASK",
  ISSUE = "ISSUE",
}

export enum WorkItemPriority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  URGENT = "URGENT",
}

export enum WorkItemStatus {
  TODO = "TODO",
  ASSIGNED = "ASSIGNED",
  IN_PROGRESS = "IN_PROGRESS",
  IN_REVIEW = "IN_REVIEW",
  DONE = "DONE",
}

export enum SprintStatus {
  PLANNED = "PLANNED",
  ACTIVE = "ACTIVE",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",  // NEW: Added cancelled status
}

export type Sprint = Models.Document & {
  name: string;
  workspaceId: string;
  projectId: string;
  status: SprintStatus;
  startDate?: string;
  endDate?: string;
  goal?: string;
  position: number;
  // NEW: Sprint metrics (computed on completion)
  completedPoints?: number;
  totalPoints?: number;
  velocity?: number;          // Points completed per day
};

// Custom field value stored on work items
export type CustomFieldValue = {
  fieldId: string;
  value: unknown;
};

export type WorkItem = Models.Document & {
  key: string; // Unique identifier like "PROJ-123"
  title: string;
  type: WorkItemType;
  status: WorkItemStatus;
  statusId?: string;          // NEW: Reference to workflow status (for custom workflows)
  priority: WorkItemPriority;
  storyPoints?: number;
  workspaceId: string;
  projectId: string;
  spaceId?: string;           // NEW: Reference to space
  sprintId?: string | null;
  epicId?: string | null;
  parentId?: string | null; // For subtasks
  assigneeIds: string[];
  reporterId?: string;        // NEW: Who created the item
  description?: string | null;
  flagged: boolean;
  position: number;
  dueDate?: string; // Due date for timeline (this is what exists in Appwrite)
  startDate?: string;         // NEW: Start date for timeline/calendar
  estimatedHours?: number;
  remainingHours?: number;    // NEW: Remaining estimate
  labels?: string[];
  components?: string[];      // NEW: Component IDs
  customFields?: CustomFieldValue[] | null; // NEW: Custom field values

  // Resolution (for completed items)
  resolution?: string | null;        // NEW: Resolution type (e.g., "Fixed", "Won't Fix", "Duplicate")
  resolvedAt?: string | null;        // NEW: When item was resolved
  resolvedBy?: string | null;        // NEW: Who resolved the item

  // Time tracking
  timeSpent?: number;                // NEW: Total time spent in minutes
  originalEstimate?: number;         // NEW: Original time estimate in minutes
};

export type WorkItemAssignee = {
  $id: string;
  name: string;
  email?: string;
  profileImageUrl?: string | null;
};

export type PopulatedWorkItem = WorkItem & {
  assignees?: WorkItemAssignee[];
  epic?: { $id: string; key: string; title: string } | null;
  parent?: { $id: string; key: string; title: string } | null;
  project?: { $id: string; name: string; imageUrl?: string } | null;
  childrenCount?: number;
  children?: PopulatedWorkItem[];
  commentCount?: number;
};

export type PopulatedSprint = Sprint & {
  workItems?: PopulatedWorkItem[];
  workItemCount?: number;
  completedPoints?: number;
  totalPoints?: number;
  project?: { $id: string; name: string; imageUrl?: string } | null;
};

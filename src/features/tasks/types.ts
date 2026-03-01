import { Models } from "node-appwrite";

// TaskStatus - Standard kanban statuses
export enum TaskStatus {
  TODO = "TODO",
  ASSIGNED = "ASSIGNED",
  IN_PROGRESS = "IN_PROGRESS",
  IN_REVIEW = "IN_REVIEW",
  DONE = "DONE",
}

export enum TaskPriority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  URGENT = "URGENT",
}

// Task type is now mapped to WorkItem collection
// Using 'title' as the primary field, 'name' as alias for backward compatibility
export type Task = Models.Document & {
  title: string;           // Primary field (WorkItem uses this)
  name?: string;           // Deprecated: alias for backward compatibility (computed)
  key?: string;            // WorkItem key like "PROJ-123"
  type?: string;           // WorkItem type
  status: TaskStatus | string; // Allow custom column IDs as status
  workspaceId: string;
  assigneeId?: string;     // Deprecated: use assigneeIds instead
  assigneeIds: string[];   // Primary field for assignees
  assignedTeamId?: string; // Single team assignment
  projectId: string;
  spaceId?: string;        // Space reference
  sprintId?: string | null;
  position: number;
  dueDate?: string;
  startDate?: string;
  endDate?: string;
  description?: string | null;
  estimatedHours?: number;
  remainingHours?: number;
  priority?: TaskPriority;
  labels?: string[];
  flagged?: boolean;
  commentCount?: number;   // Number of comments on this task
  storyPoints?: number;    // Story points for agile
  reporterId?: string;     // Who created the item
  parentId?: string | null; // Parent task ID for sub-issues
};

export type TaskAssignee = {
  $id: string;
  name: string;
  email?: string;
  profileImageUrl?: string | null;
};

export type TaskTeam = {
  $id: string;
  name: string;
  imageUrl?: string;
  memberCount?: number;
};

export type PopulatedTask = Task & {
  assignee?: TaskAssignee;
  assignees?: TaskAssignee[]; // Individual assignees
  assignedTeam?: TaskTeam; // Single assigned team
  assignedTeams?: TaskTeam[]; // Multiple assigned teams
  project?: { $id: string; name: string; imageUrl: string };
  reporter?: TaskAssignee; // Who created/reported the task
};

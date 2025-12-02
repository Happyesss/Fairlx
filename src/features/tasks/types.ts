import { Models } from "node-appwrite";

export enum TaskStatus {
  ASSIGNED = "ASSIGNED",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  CLOSED = "CLOSED",
}

export enum TaskPriority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  URGENT = "URGENT",
}

export type Task = Models.Document & {
  name: string;
  status: TaskStatus | string; // Allow custom column IDs as status
  workspaceId: string;
  assigneeId: string; // Keep for backward compatibility
  assigneeIds?: string[]; // Multiple individual assignees
  assignedTeamId?: string; // Single team assignment
  assignedTeamIds?: string[]; // Multiple team assignments
  projectId: string;
  position: number;
  dueDate: string;
  endDate?: string;
  description?: string | null;
  estimatedHours?: number;
  priority?: TaskPriority;
  labels?: string[];
  flagged?: boolean;
  commentCount?: number; // Number of comments on this task
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
};

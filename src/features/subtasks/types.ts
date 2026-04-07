import { Models } from "node-appwrite";

// Subtask status - simpler than task status
export enum SubtaskStatus {
  TODO = "TODO",
  IN_PROGRESS = "IN_PROGRESS",
  DONE = "DONE",
}

// Subtask priority - matches task priority
export enum SubtaskPriority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  URGENT = "URGENT",
}

// Full work item subtask type
export type Subtask = Models.Document & {
  title: string;
  description?: string;
  parentTaskId: string; // Matches schema attribute
  workspaceId: string;
  isCompleted: boolean; // Matches schema attribute
  completed?: boolean;  // Kept for backward compatibility
  workItemId?: string;   // Kept for backward compatibility
  position: number;
  createdBy: string;
  
  // Enhanced properties (new)
  assigneeId?: string;             // Subtask assignee
  status?: SubtaskStatus;          // More granular status
  dueDate?: string;                // Due date for subtask
  estimatedHours?: number;         // Time estimate
  priority?: SubtaskPriority;      // Priority level
};

// Populated subtask with member info
export type PopulatedSubtask = Subtask & {
  assignee?: {
    $id: string;
    name: string;
    email: string;
  } | null;
  creator?: {
    $id: string;
    name: string;
  } | null;
};

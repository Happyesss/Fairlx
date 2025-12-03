// Types for Project AI Context
// This provides comprehensive project context for AI-powered assistance

export interface ProjectAIContext {
  project: {
    id: string;
    name: string;
    description?: string;
    workspaceId: string;
    createdAt: string;
  };
  documents: DocumentContext[];
  tasks: TaskContext[];
  members: MemberContext[];
  summary: {
    totalDocuments: number;
    totalTasks: number;
    totalMembers: number;
    tasksByStatus: Record<string, number>;
    tasksByAssignee: Record<string, number>;
    documentCategories: string[];
  };
}

export interface DocumentContext {
  id: string;
  name: string;
  category: string;
  description?: string;
  tags?: string[];
  extractedText?: string; // Extracted text from PDF/documents
  createdAt: string;
}

export interface TaskContext {
  id: string;
  name: string;
  status: string;
  priority?: string;
  description?: string;
  assigneeId?: string;
  assigneeName?: string;
  dueDate?: string;
  labels?: string[];
}

export interface MemberContext {
  id: string;
  userId: string;
  name: string;
  email?: string;
  role: string;
  tasksAssigned: number;
}

export interface ProjectAIQuestion {
  projectId: string;
  workspaceId: string;
  question: string;
}

export interface ProjectAIAnswer {
  question: string;
  answer: string;
  timestamp: string;
  contextUsed: {
    documentsCount: number;
    tasksCount: number;
    membersCount: number;
    categories: string[];
  };
  // Task action data (when AI suggests or performs task operations)
  taskAction?: AITaskAction;
}

// AI Task Action Types
export type AITaskActionType = "create" | "update" | "suggest_create" | "suggest_update";

export interface AITaskAction {
  type: AITaskActionType;
  taskData?: AITaskData;
  taskId?: string; // For updates
  suggestions?: AITaskSuggestion[];
  executed?: boolean;
  result?: {
    success: boolean;
    taskId?: string;
    message?: string;
  };
}

export interface AITaskData {
  name?: string;
  description?: string | null;
  status?: string;
  priority?: string;
  dueDate?: string | null;
  endDate?: string | null;
  assigneeIds?: string[];
  labels?: string[];
  estimatedHours?: number | null;
}

// Available members for task assignment (sent with suggestions)
export interface AvailableMember {
  id: string;
  name: string;
  email?: string;
  role: string;
}

export interface AITaskSuggestion {
  field: string;
  currentValue?: string;
  suggestedValue: string;
  reason: string;
}

// Request types for AI task operations
export interface AICreateTaskRequest {
  projectId: string;
  workspaceId: string;
  prompt: string; // Natural language description of the task to create
  autoExecute?: boolean; // If true, create the task directly; if false, return suggestion
}

export interface AIUpdateTaskRequest {
  projectId: string;
  workspaceId: string;
  taskId: string;
  prompt: string; // Natural language description of updates
  autoExecute?: boolean;
}

export interface AITaskResponse {
  success: boolean;
  action: AITaskAction;
  message: string;
  task?: {
    id: string;
    name: string;
    status: string;
    [key: string]: unknown;
  };
  // Available members for assignment selection
  availableMembers?: AvailableMember[];
  // Suggested labels based on context
  suggestedLabels?: string[];
}

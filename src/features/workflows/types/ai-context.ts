/**
 * Workflow AI Types - Types for AI-powered workflow operations
 */

// Context about the workflow provided to AI
export interface WorkflowAIContext {
  workflow: {
    id: string;
    name: string;
    description?: string;
  };
  statuses: Array<{
    id: string;
    name: string;
    key: string;
    statusType: string;
    isInitial: boolean;
    isFinal: boolean;
    color: string;
    position: number;
  }>;
  transitions: Array<{
    id: string;
    fromStatus: string;
    toStatus: string;
    name?: string;
    requiresApproval: boolean;
    allowedRoles?: string[];
    allowedTeams?: string[];
  }>;
  summary: {
    totalStatuses: number;
    totalTransitions: number;
    initialStatuses: number;
    finalStatuses: number;
    orphanedStatuses: number;
    unreachableStatuses: number;
    deadEndStatuses: number;
  };
}

// Workflow AI question/answer
export interface WorkflowAIQuestion {
  workflowId: string;
  workspaceId: string;
  question: string;
}

export interface WorkflowAIAnswer {
  question: string;
  answer: string;
  timestamp: string;
  contextUsed: {
    statusesCount: number;
    transitionsCount: number;
  };
  // Action data when AI suggests operations
  action?: WorkflowAIAction;
}

// Types of actions AI can suggest
export type WorkflowAIActionType = 
  | "create_status"
  | "create_transition"
  | "suggest_workflow"
  | "analyze_workflow"
  | "fix_issue"
  | "none";

export interface WorkflowAIAction {
  type: WorkflowAIActionType;
  data?: StatusSuggestion | TransitionSuggestion | WorkflowSuggestion;
  executed?: boolean;
  result?: {
    success: boolean;
    message?: string;
  };
}

import { StatusType } from "../types";

// AI suggestions for creating a status
export interface StatusSuggestion {
  name: string;
  key: string;
  statusType: StatusType;
  color: string;
  isInitial?: boolean;
  isFinal?: boolean;
  description?: string;
}

// AI suggestions for creating transitions
export interface TransitionSuggestion {
  fromStatusKey: string;
  toStatusKey: string;
  name?: string;
  requiresApproval?: boolean;
}

// AI suggestions for a complete workflow template
export interface WorkflowSuggestion {
  name?: string;
  description?: string;
  statuses: StatusSuggestion[];
  transitions: TransitionSuggestion[];
}

// Request to create a status via AI
export interface AICreateStatusRequest {
  workflowId: string;
  workspaceId: string;
  prompt: string;
  autoExecute?: boolean;
}

// Request to create a transition via AI
export interface AICreateTransitionRequest {
  workflowId: string;
  workspaceId: string;
  prompt: string;
  autoExecute?: boolean;
}

// Request to generate a workflow template
export interface AIGenerateWorkflowRequest {
  workflowId: string;
  workspaceId: string;
  prompt: string;
}

// Response from AI workflow operations
export interface WorkflowAIResponse {
  success: boolean;
  message: string;
  action?: WorkflowAIAction;
  status?: StatusSuggestion;
  transition?: TransitionSuggestion;
  workflow?: WorkflowSuggestion;
}

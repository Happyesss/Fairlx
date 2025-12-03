import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { client } from "@/lib/rpc";
import { ProjectAIContext, ProjectAIAnswer, AITaskResponse } from "../types/ai-context";

// Query key factory
export const PROJECT_AI_QUERY_KEYS = {
  context: (projectId: string) => ["project-ai-context", projectId],
  questions: (projectId: string) => ["project-ai-questions", projectId],
};

// Hook to get AI context for a project
export const useGetProjectAIContext = (projectId: string, workspaceId: string) => {
  return useQuery<{ data: ProjectAIContext }>({
    queryKey: PROJECT_AI_QUERY_KEYS.context(projectId),
    queryFn: async () => {
      const response = await client.api["project-docs"].ai.context.$get({
        query: { projectId, workspaceId },
      });

      if (!response.ok) {
        const error = await response.json() as { error?: string };
        throw new Error(error.error || "Failed to fetch AI context");
      }

      return await response.json();
    },
    enabled: !!projectId && !!workspaceId,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
};

// Hook to ask a question about the project
export const useAskProjectQuestion = () => {
  return useMutation<
    { data: ProjectAIAnswer },
    Error,
    { projectId: string; workspaceId: string; question: string }
  >({
    mutationFn: async ({ projectId, workspaceId, question }) => {
      const response = await client.api["project-docs"].ai.ask.$post({
        json: { projectId, workspaceId, question },
      });

      if (!response.ok) {
        const error = await response.json() as { error?: string };
        throw new Error(error.error || "Failed to get AI response");
      }

      return await response.json();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to get AI response");
    },
  });
};

// Hook to create a task using AI
export const useAICreateTask = () => {
  const queryClient = useQueryClient();

  return useMutation<
    AITaskResponse,
    Error,
    { projectId: string; workspaceId: string; prompt: string; autoExecute?: boolean }
  >({
    mutationFn: async ({ projectId, workspaceId, prompt, autoExecute }) => {
      const response = await client.api["project-docs"].ai["create-task"].$post({
        json: { projectId, workspaceId, prompt, autoExecute },
      });

      if (!response.ok) {
        const error = await response.json() as { error?: string };
        throw new Error(error.error || "Failed to create task via AI");
      }

      return await response.json() as AITaskResponse;
    },
    onSuccess: (data) => {
      if (data.action?.executed && data.success) {
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
        queryClient.invalidateQueries({ queryKey: ["project-analytics"] });
        toast.success(data.message || "Task created successfully");
      }
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create task via AI");
    },
  });
};

// Hook to update a task using AI
export const useAIUpdateTask = () => {
  const queryClient = useQueryClient();

  return useMutation<
    AITaskResponse,
    Error,
    { projectId: string; workspaceId: string; taskId: string; prompt: string; autoExecute?: boolean }
  >({
    mutationFn: async ({ projectId, workspaceId, taskId, prompt, autoExecute }) => {
      const response = await client.api["project-docs"].ai["update-task"].$post({
        json: { projectId, workspaceId, taskId, prompt, autoExecute },
      });

      if (!response.ok) {
        const error = await response.json() as { error?: string };
        throw new Error(error.error || "Failed to update task via AI");
      }

      return await response.json() as AITaskResponse;
    },
    onSuccess: (data) => {
      if (data.action?.executed && data.success) {
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
        queryClient.invalidateQueries({ queryKey: ["task", data.task?.id] });
        queryClient.invalidateQueries({ queryKey: ["project-analytics"] });
        toast.success(data.message || "Task updated successfully");
      }
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update task via AI");
    },
  });
};

// Hook to execute a task suggestion (create or update)
export const useExecuteTaskSuggestion = () => {
  const queryClient = useQueryClient();

  return useMutation<
    AITaskResponse,
    Error,
    { 
      projectId: string; 
      workspaceId: string; 
      taskData: {
        name?: string;
        description?: string | null;
        status?: string;
        priority?: string;
        dueDate?: string | null;
        endDate?: string | null;
        assigneeIds?: string[];
        labels?: string[];
        estimatedHours?: number | null;
      }; 
      taskId?: string;
    }
  >({
    mutationFn: async ({ projectId, workspaceId, taskData, taskId }) => {
      const response = await client.api["project-docs"].ai["execute-task"].$post({
        json: { projectId, workspaceId, taskData, taskId },
      });

      if (!response.ok) {
        const error = await response.json() as { error?: string };
        throw new Error(error.error || "Failed to execute task operation");
      }

      return await response.json() as AITaskResponse;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["project-analytics"] });
      if (data.task?.id) {
        queryClient.invalidateQueries({ queryKey: ["task", data.task.id] });
      }
      toast.success(data.message || "Task operation completed");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to execute task operation");
    },
  });
};

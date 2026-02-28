"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { client } from "@/lib/rpc";
import { TaskStatus } from "@/features/tasks/types";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useProjectId } from "@/features/projects/hooks/use-project-id";

export const useMoveTasksFromDisabledColumn = () => {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceId();
  const projectId = useProjectId();

  const mutation = useMutation({
    mutationFn: async ({ fromColumn, toColumn = TaskStatus.TODO }: { 
      fromColumn: TaskStatus; 
      toColumn?: TaskStatus;
    }) => {
      if (!workspaceId) {
        throw new Error("Workspace ID is required");
      }

      // Fetch ALL tasks with the specified status from the API
      // This ensures we get tasks regardless of what's in the cache
      const response = await client.api.tasks.$get({
        query: {
          workspaceId,
          projectId: projectId || undefined,
          status: fromColumn,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch tasks");
      }

      const tasksData = await response.json();
      const documents = tasksData.data?.documents || [];
      
      const tasksToMove = documents
        .filter((task) => task.status === fromColumn)
        .map((task) => task.$id);

      // Move tasks to target column
      if (tasksToMove.length > 0) {
        const updates = tasksToMove.map((taskId: string) => ({
          $id: taskId,
          status: toColumn,
        }));

        // Use bulk-update endpoint directly
        const bulkResponse = await client.api.tasks["bulk-update"].$post({
          json: { tasks: updates },
        });

        if (!bulkResponse.ok) {
          throw new Error("Failed to update tasks");
        }

        return tasksToMove.length;
      }

      return 0;
    },
    onSuccess: (movedCount, { fromColumn, toColumn = TaskStatus.TODO }) => {
      if (movedCount > 0) {
        toast.success(`Moved ${movedCount} task${movedCount === 1 ? '' : 's'} from ${fromColumn} to ${toColumn}`);
      }
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: () => {
      toast.error("Failed to move tasks");
    },
  });

  return mutation;
};

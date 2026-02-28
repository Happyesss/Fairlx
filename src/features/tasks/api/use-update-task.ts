import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";
import { toast } from "sonner";

import { client } from "@/lib/rpc";

type ResponseType = InferResponseType<
  (typeof client.api.tasks)[":taskId"]["$patch"],
  200
>;
type RequestType = InferRequestType<
  (typeof client.api.tasks)[":taskId"]["$patch"]
>;

interface MutationOptions {
  /** Skip success toast */
  silent?: boolean;
  /** Apply optimistic update immediately before API call */
  optimistic?: boolean;
}

export const useUpdateTask = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation<ResponseType, Error, RequestType & MutationOptions, { previousTasks: unknown; previousWorkItems: unknown }>({
    mutationFn: async ({ param, json }) => {
      const response = await client.api.tasks[":taskId"].$patch({
        param,
        json,
      });

      if (!response.ok) {
        // Extract error message from response body
        const errorBody = await response.json().catch(() => ({}));
        const errorMessage = (errorBody as { error?: string }).error || "Failed to update task.";
        throw new Error(errorMessage);
      }

      return await response.json();
    },
    
    // OPTIMISTIC UPDATE: Update cache immediately before API call
    onMutate: async (variables) => {
      if (!variables.optimistic) {
        return { previousTasks: null, previousWorkItems: null };
      }

      const taskId = variables.param.taskId;

      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      await queryClient.cancelQueries({ queryKey: ["work-items"] });

      // Snapshot current cache
      const previousTasks = queryClient.getQueryData(["tasks"]);
      const previousWorkItems = queryClient.getQueryData(["work-items"]);

      // Optimistically update tasks cache
      queryClient.setQueryData(["tasks"], (old: { documents: Array<Record<string, unknown>> } | undefined) => {
        if (!old?.documents) return old;
        return {
          ...old,
          documents: old.documents.map((item) =>
            item.$id === taskId ? { ...item, ...variables.json } : item
          ),
        };
      });

      // Also update work-items cache (same data, different query key)
      queryClient.setQueryData(["work-items"], (old: { documents: Array<Record<string, unknown>> } | undefined) => {
        if (!old?.documents) return old;
        return {
          ...old,
          documents: old.documents.map((item) =>
            item.$id === taskId ? { ...item, ...variables.json } : item
          ),
        };
      });

      return { previousTasks, previousWorkItems };
    },

    // ROLLBACK: If mutation fails, restore previous data
    onError: (error, variables, context) => {
      if (variables.optimistic) {
        if (context?.previousTasks) {
          queryClient.setQueryData(["tasks"], context.previousTasks);
        }
        if (context?.previousWorkItems) {
          queryClient.setQueryData(["work-items"], context.previousWorkItems);
        }
      }
      toast.error("Failed to update task");
    },

    onSuccess: ({ data }, variables) => {
      if (!variables.silent) {
        toast.success("Task updated successfully");
      }
      
      queryClient.invalidateQueries({ queryKey: ["project-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["workspace-analytics"] });
      
      // Only invalidate if not using optimistic updates
      if (!variables.optimistic) {
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
        queryClient.invalidateQueries({ queryKey: ["work-items"] });
      }
      
      queryClient.invalidateQueries({ queryKey: ["sprints"] });
      queryClient.invalidateQueries({ queryKey: ["task", data.$id] });
    },

    // SETTLE: Ensure cache consistency after mutation completes
    onSettled: (data, error, variables) => {
      if (variables.optimistic) {
        // Background refetch to ensure consistency
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
        queryClient.invalidateQueries({ queryKey: ["work-items"] });
      }
    },
  });

  return mutation;
};

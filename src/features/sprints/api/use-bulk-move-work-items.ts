import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";
import { toast } from "sonner";

import { client } from "@/lib/rpc";

type ResponseType = InferResponseType<
  (typeof client.api)["work-items"]["bulk-move"]["$post"],
  200
>;
type RequestType = InferRequestType<
  (typeof client.api)["work-items"]["bulk-move"]["$post"]
>["json"];

export const useBulkMoveWorkItems = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation<
    ResponseType, 
    Error, 
    RequestType,
    { previousQueries: Array<[readonly unknown[], { documents: Array<Record<string, unknown>> } | undefined]> }
  >({
    mutationFn: async (json) => {
      const response = await client.api["work-items"]["bulk-move"].$post({
        json,
      });

      if (!response.ok) {
        throw new Error("Failed to move work items");
      }

      return await response.json();
    },

    // OPTIMISTIC UPDATE: Update cache immediately before API call
    onMutate: async (variables) => {
      const { workItemIds, sprintId } = variables;

      // Cancel ALL work-items queries to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ["work-items"], exact: false });

      // Snapshot ALL work-items queries for rollback
      const previousQueries = queryClient.getQueriesData<{ documents: Array<Record<string, unknown>> }>({ 
        queryKey: ["work-items"],
        exact: false 
      });

      // Optimistically update ALL matching work-items caches
      queryClient.setQueriesData<{ documents: Array<Record<string, unknown>> }>(
        { queryKey: ["work-items"], exact: false },
        (old) => {
          if (!old?.documents) return old;
          return {
            ...old,
            documents: old.documents.map((item) =>
              workItemIds.includes(item.$id as string)
                ? { ...item, sprintId }
                : item
            ),
          };
        }
      );

      // Show toast immediately with optimistic feedback
      toast.success("Work items moved successfully");

      // Return context with previous data for rollback
      return { previousQueries };
    },

    // ROLLBACK: If mutation fails, restore previous data
    onError: (error, variables, context) => {
      if (context?.previousQueries) {
        // Restore all previous queries
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      toast.error("Failed to move work items");
    },

    onSuccess: () => {
      // Invalidate to ensure data is consistent with server
      queryClient.invalidateQueries({ queryKey: ["work-items"] });
      queryClient.invalidateQueries({ queryKey: ["sprints"] });
    },
  });

  return mutation;
};

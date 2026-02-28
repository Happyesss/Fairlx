import { toast } from "sonner";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";

import { client } from "@/lib/rpc";

type ResponseType = InferResponseType<
  (typeof client.api.tasks)["bulk-update"]["$post"],
  200
>;
type RequestType = InferRequestType<
  (typeof client.api.tasks)["bulk-update"]["$post"]
>;

export const useBulkUpdateTasks = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation<ResponseType, Error, RequestType>({
    mutationFn: async ({ json }) => {
      const response = await client.api.tasks["bulk-update"].$post({
        json,
      });

      if (!response.ok) {
        // Extract error message from response body
        const errorBody = await response.json().catch(() => ({}));
        const errorMessage = (errorBody as { error?: string }).error || "Failed to update tasks.";
        throw new Error(errorMessage);
      }

      return await response.json();
    },
    onSuccess: (_data, variables) => {
      // Only show toast for bulk updates (more than 1 item)
      if (variables.json.tasks.length > 1) {
        toast.success("Tasks updated.");
      }
      // Use refetchType: 'none' to avoid immediate refetch that causes flicker
      // The optimistic update already shows the correct state
      queryClient.invalidateQueries({ 
        queryKey: ["project-analytics"],
        refetchType: 'none'
      });
      queryClient.invalidateQueries({ 
        queryKey: ["workspace-analytics"],
        refetchType: 'none'
      });
      queryClient.invalidateQueries({ 
        queryKey: ["tasks"],
        refetchType: 'none'
      });
    },
    onError: () => {
      toast.error("Failed to update tasks.");
    },
  });

  return mutation;
};

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { client } from "@/lib/rpc";

interface BulkUpdateWorkItemsRequest {
  workItems: {
    $id: string;
    status: string; // Changed from WorkItemStatus to string to support custom column IDs
    position: number;
  }[];
}

export const useBulkUpdateWorkItems = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation<void, Error, { json: BulkUpdateWorkItemsRequest }>({
    mutationFn: async ({ json }) => {
      // Update each work item individually
      // For single item updates (most common case - kanban drag), just make one call
      const updatePromises = json.workItems.map(async (item) => {
        const response = await client.api["work-items"][":workItemId"].$patch({
          param: { workItemId: item.$id },
          json: {
            status: item.status,
            position: item.position,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to update work item ${item.$id}`);
        }

        return response.json();
      });

      await Promise.all(updatePromises);
    },
    onSuccess: (_data, variables) => {
      // Only show toast for bulk updates (more than 1 item)
      if (variables.json.workItems.length > 1) {
        toast.success("Work items updated.");
      }
      // Use refetchType: 'none' to avoid immediate refetch that causes flicker
      // The optimistic update already shows the correct state
      queryClient.invalidateQueries({ 
        queryKey: ["work-items"],
        refetchType: 'none'
      });
      queryClient.invalidateQueries({ 
        queryKey: ["sprints"],
        refetchType: 'none'
      });
    },
    onError: () => {
      toast.error("Failed to update work items.");
    },
  });

  return mutation;
};

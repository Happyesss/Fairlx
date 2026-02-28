import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";
import { toast } from "sonner";

import { client } from "@/lib/rpc";

type ResponseType = InferResponseType<
    (typeof client.api)["work-items"]["bulk-delete"]["$post"],
    200
>;
type RequestType = InferRequestType<
    (typeof client.api)["work-items"]["bulk-delete"]["$post"]
>["json"];

export const useBulkDeleteWorkItems = () => {
    const queryClient = useQueryClient();

    const mutation = useMutation<
        ResponseType, 
        Error, 
        RequestType,
        { previousQueries: Array<[readonly unknown[], { documents: Array<Record<string, unknown>> } | undefined]> }
    >({
        mutationFn: async (json) => {
            const response = await client.api["work-items"]["bulk-delete"].$post({
                json,
            });

            if (!response.ok) {
                throw new Error("Failed to delete work items");
            }

            return await response.json();
        },

        // OPTIMISTIC UPDATE: Remove items from cache immediately before API call
        onMutate: async (variables) => {
            const { workItemIds } = variables;

            // Cancel ALL work-items queries to avoid overwriting optimistic update
            await queryClient.cancelQueries({ queryKey: ["work-items"], exact: false });

            // Snapshot ALL work-items queries for rollback
            const previousQueries = queryClient.getQueriesData<{ documents: Array<Record<string, unknown>> }>({ 
                queryKey: ["work-items"],
                exact: false 
            });

            // Optimistically remove items from ALL matching work-items caches
            queryClient.setQueriesData<{ documents: Array<Record<string, unknown>> }>(
                { queryKey: ["work-items"], exact: false },
                (old) => {
                    if (!old?.documents) return old;
                    return {
                        ...old,
                        documents: old.documents.filter((item) =>
                            !workItemIds.includes(item.$id as string)
                        ),
                    };
                }
            );

            // Show toast immediately with optimistic feedback
            toast.success("Work items deleted successfully");

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
            toast.error("Failed to delete work items");
        },

        onSuccess: () => {
            // Invalidate to ensure data is consistent with server
            queryClient.invalidateQueries({ queryKey: ["work-items"] });
            queryClient.invalidateQueries({ queryKey: ["sprints"] });
        },
    });

    return mutation;
};

import { toast } from "sonner";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";

import { client } from "@/lib/rpc";

type ResponseType = InferResponseType<(typeof client.api)["work-item-links"][":linkId"]["$delete"], 200>;
type RequestType = InferRequestType<(typeof client.api)["work-item-links"][":linkId"]["$delete"]>;

interface UseDeleteWorkItemLinkOptions {
  sourceItemId?: string;
  targetItemId?: string;
}

export const useDeleteWorkItemLink = (options?: UseDeleteWorkItemLinkOptions) => {
  const queryClient = useQueryClient();

  const mutation = useMutation<ResponseType, Error, RequestType>({
    mutationFn: async ({ param, query }) => {
      const response = await client.api["work-item-links"][":linkId"].$delete({
        param,
        query,
      });

      if (!response.ok) {
        throw new Error("Failed to delete link.");
      }

      return await response.json();
    },
    onSuccess: () => {
      toast.success("Link deleted.");
      if (options?.sourceItemId) {
        queryClient.invalidateQueries({ queryKey: ["work-item-links", options.sourceItemId] });
      }
      if (options?.targetItemId) {
        queryClient.invalidateQueries({ queryKey: ["work-item-links", options.targetItemId] });
      }
      queryClient.invalidateQueries({ queryKey: ["work-item-links"] });
    },
    onError: () => {
      toast.error("Failed to delete link.");
    },
  });

  return mutation;
};

import { toast } from "sonner";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";

import { client } from "@/lib/rpc";

type ResponseType = InferResponseType<(typeof client.api)["work-item-links"]["$post"], 200>;
type RequestType = InferRequestType<(typeof client.api)["work-item-links"]["$post"]>;

export const useCreateWorkItemLink = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation<ResponseType, Error, RequestType>({
    mutationFn: async ({ json }) => {
      const response = await client.api["work-item-links"].$post({ json });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error((errorData as { error: string }).error || "Failed to create link.");
      }

      return await response.json();
    },
    onSuccess: (_, variables) => {
      toast.success("Link created.");
      queryClient.invalidateQueries({ queryKey: ["work-item-links", variables.json.sourceItemId] });
      queryClient.invalidateQueries({ queryKey: ["work-item-links", variables.json.targetItemId] });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create link.");
    },
  });

  return mutation;
};

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";
import { toast } from "sonner";

import { client } from "@/lib/rpc";

type ResponseType = InferResponseType<typeof client.api.comments.$post, 200>;
type RequestType = InferRequestType<typeof client.api.comments.$post>["json"];

export const useCreateComment = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation<ResponseType, Error, RequestType>({
    mutationFn: async (json) => {
      const response = await client.api.comments.$post({ json });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          (errorData as { error: string }).error || "Failed to create comment"
        );
      }

      return await response.json();
    },
    onSuccess: (_, variables) => {
      toast.success("Comment added");
      queryClient.invalidateQueries({
        queryKey: ["comments", variables.taskId, variables.workspaceId],
      });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to add comment");
    },
  });

  return mutation;
};

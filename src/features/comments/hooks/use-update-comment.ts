import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";
import { toast } from "sonner";

import { client } from "@/lib/rpc";

type ResponseType = InferResponseType<
  (typeof client.api.comments)[":commentId"]["$patch"],
  200
>;
type RequestType = InferRequestType<
  (typeof client.api.comments)[":commentId"]["$patch"]
>;

interface UseUpdateCommentProps {
  taskId: string;
  workspaceId: string;
}

export const useUpdateComment = ({
  taskId,
  workspaceId,
}: UseUpdateCommentProps) => {
  const queryClient = useQueryClient();

  const mutation = useMutation<ResponseType, Error, RequestType>({
    mutationFn: async ({ param, json }) => {
      const response = await client.api.comments[":commentId"]["$patch"]({
        param,
        json,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          (errorData as { error: string }).error || "Failed to update comment"
        );
      }

      return await response.json();
    },
    onSuccess: () => {
      toast.success("Comment updated");
      queryClient.invalidateQueries({
        queryKey: ["comments", taskId, workspaceId],
      });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update comment");
    },
  });

  return mutation;
};

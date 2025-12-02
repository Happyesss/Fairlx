import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";
import { toast } from "sonner";

import { client } from "@/lib/rpc";

type ResponseType = InferResponseType<
  (typeof client.api.comments)[":commentId"]["$delete"],
  200
>;
type RequestType = InferRequestType<
  (typeof client.api.comments)[":commentId"]["$delete"]
>;

interface UseDeleteCommentProps {
  taskId: string;
  workspaceId: string;
}

export const useDeleteComment = ({
  taskId,
  workspaceId,
}: UseDeleteCommentProps) => {
  const queryClient = useQueryClient();

  const mutation = useMutation<ResponseType, Error, RequestType>({
    mutationFn: async ({ param, json }) => {
      const response = await client.api.comments[":commentId"]["$delete"]({
        param,
        json,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          (errorData as { error: string }).error || "Failed to delete comment"
        );
      }

      return await response.json();
    },
    onSuccess: () => {
      toast.success("Comment deleted");
      queryClient.invalidateQueries({
        queryKey: ["comments", taskId, workspaceId],
      });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete comment");
    },
  });

  return mutation;
};

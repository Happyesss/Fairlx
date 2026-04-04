import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";
import { toast } from "sonner";

import { client } from "@/lib/rpc";

type ResponseType = InferResponseType<(typeof client.api.subtasks)[":subtaskId"]["$delete"], 200>;
type RequestType = InferRequestType<(typeof client.api.subtasks)[":subtaskId"]["$delete"]>;

interface DeleteSubtaskContext {
  workspaceId: string;
  parentTaskId: string;
}

export const useDeleteSubtask = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation<
    ResponseType, 
    Error, 
    RequestType & { context: DeleteSubtaskContext }
  >({
    mutationFn: async ({ param }) => {
      const response = await client.api.subtasks[":subtaskId"].$delete({ param });

      if (!response.ok) {
        throw new Error("Failed to delete subtask");
      }

      return await response.json();
    },
    onSuccess: (_, { context }) => {
      toast.success("Subtask deleted");
      queryClient.invalidateQueries({ 
        queryKey: ["subtasks", context.workspaceId, context.parentTaskId] 
      });
    },
    onError: () => {
      toast.error("Failed to delete subtask");
    },
  });

  return mutation;
};

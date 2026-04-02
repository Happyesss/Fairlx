import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";
import { toast } from "sonner";

import { client } from "@/lib/rpc";

type ResponseType = InferResponseType<(typeof client.api.subtasks)[":subtaskId"]["$patch"], 200>;
type RequestType = InferRequestType<(typeof client.api.subtasks)[":subtaskId"]["$patch"]>;

export const useUpdateSubtask = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation<ResponseType, Error, RequestType>({
    mutationFn: async ({ param, json }) => {
      const response = await client.api.subtasks[":subtaskId"].$patch({ 
        param, 
        json 
      });

      if (!response.ok) {
        throw new Error("Failed to update subtask");
      }

      return await response.json();
    },
    onSuccess: ({ data }) => {
      toast.success("Subtask updated");
      queryClient.invalidateQueries({ 
        queryKey: ["subtasks", data.workspaceId, data.parentTaskId] 
      });
    },
    onError: () => {
      toast.error("Failed to update subtask");
    },
  });

  return mutation;
};

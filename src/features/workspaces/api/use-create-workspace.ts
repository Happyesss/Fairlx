import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";

import { client } from "@/lib/rpc";
import { AGENT_CONTEXT_QUERY_KEY } from "@/features/agent/constants";

type ResponseType = InferResponseType<(typeof client.api.workspaces)["$post"]>;
type RequestType = InferRequestType<(typeof client.api.workspaces)["$post"]>;

export const useCreateWorkspace = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation<ResponseType, Error, RequestType>({
    mutationFn: async ({ form }) => {
      const response = await client.api.workspaces.$post({ form });
      return await response.json();
    },
    onSuccess: () => {
      toast.success("Workspace created.");
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["account-lifecycle"] });
      queryClient.invalidateQueries({ queryKey: AGENT_CONTEXT_QUERY_KEY });
    },
    onError: () => {
      toast.error("Failed to create workspace.");
    },
  });

  return mutation;
};

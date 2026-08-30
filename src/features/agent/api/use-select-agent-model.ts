import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";

import { client } from "@/lib/rpc";

import { AGENT_AI_QUERY_KEY } from "../constants";

type ResponseType = InferResponseType<(typeof client.api)["agent"]["ai"]["select"]["$put"], 200>;
type RequestType = InferRequestType<(typeof client.api)["agent"]["ai"]["select"]["$put"]>;

export const useSelectAgentModel = () => {
  const queryClient = useQueryClient();

  return useMutation<ResponseType, Error, RequestType>({
    mutationFn: async ({ json }) => {
      const response = await client.api.agent.ai.select.$put({ json });
      if (!response.ok) {
        throw new Error("Failed to select model.");
      }
      return await response.json();
    },
    onSuccess: (result) => {
      queryClient.setQueryData(AGENT_AI_QUERY_KEY, result.data);
      queryClient.invalidateQueries({ queryKey: AGENT_AI_QUERY_KEY });
    },
    onError: () => {
      toast.error("Failed to select model.");
    },
  });
};

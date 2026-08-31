import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";

import { client } from "@/lib/rpc";

import { AGENT_AI_QUERY_KEY } from "../constants";

type ResponseType = InferResponseType<(typeof client.api)["agent"]["ai"]["$put"], 200>;
type RequestType = InferRequestType<(typeof client.api)["agent"]["ai"]["$put"]>;

export const useUpdateAgentAiConfig = () => {
  const queryClient = useQueryClient();

  return useMutation<ResponseType, Error, RequestType>({
    mutationFn: async ({ json }) => {
      const response = await client.api.agent.ai.$put({ json });
      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: "Failed to save model config." }));
        throw new Error("error" in body && typeof body.error === "string" ? body.error : "Failed to save model config.");
      }
      return await response.json();
    },
    onSuccess: (result) => {
      toast.success("Models saved.");
      queryClient.setQueryData(AGENT_AI_QUERY_KEY, result.data);
      queryClient.invalidateQueries({ queryKey: AGENT_AI_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to save model config.");
    },
  });
};

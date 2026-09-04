import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";

import { client } from "@/lib/rpc";
import { QUERY_CONFIG } from "@/lib/query-config";

import { AGENT_HARNESS_QUERY_KEY, AGENT_PLUGINS_QUERY_KEY, AGENT_RUNS_QUERY_KEY } from "../constants";
import { agentRunQueryKey } from "./use-agent-runs";

type PluginsResponse = InferResponseType<(typeof client.api)["agent"]["plugins"]["$get"], 200>;
type ConnectRequest = InferRequestType<(typeof client.api)["agent"]["plugins"]["$post"]>;

async function readError(response: Response, fallback: string): Promise<never> {
  const body = await response.json().catch(() => ({ error: fallback }));
  throw new Error("error" in body && typeof body.error === "string" ? body.error : fallback);
}

export const useGetAgentPlugins = () => {
  return useQuery({
    queryKey: AGENT_PLUGINS_QUERY_KEY,
    staleTime: QUERY_CONFIG.DYNAMIC.staleTime,
    queryFn: async () => {
      const response = await client.api.agent.plugins.$get();
      if (!response.ok) throw new Error("Failed to load plugins.");
      const { data } = (await response.json()) as PluginsResponse;
      return data;
    },
  });
};

export const useConnectAgentPlugin = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ json }: ConnectRequest) => {
      const response = await client.api.agent.plugins.$post({ json });
      if (!response.ok) await readError(response, "Failed to connect plugin.");
      return response.json();
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: AGENT_PLUGINS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: AGENT_HARNESS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: AGENT_RUNS_QUERY_KEY });
      if (variables.json.runId) {
        queryClient.invalidateQueries({ queryKey: agentRunQueryKey(variables.json.runId) });
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to connect plugin.");
    },
  });
};

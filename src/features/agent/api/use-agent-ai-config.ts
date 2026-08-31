import { useQuery } from "@tanstack/react-query";

import { client } from "@/lib/rpc";
import { QUERY_CONFIG } from "@/lib/query-config";

import { AGENT_AI_QUERY_KEY } from "../constants";

export const useGetAgentAiConfig = () => {
  return useQuery({
    queryKey: AGENT_AI_QUERY_KEY,
    staleTime: QUERY_CONFIG.SEMI_DYNAMIC.staleTime,
    gcTime: QUERY_CONFIG.SEMI_DYNAMIC.gcTime,
    queryFn: async () => {
      const response = await client.api.agent.ai.$get();
      if (!response.ok) {
        throw new Error("Failed to fetch model config.");
      }
      const { data } = await response.json();
      return data;
    },
  });
};

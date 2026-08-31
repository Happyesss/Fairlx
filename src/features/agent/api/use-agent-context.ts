import { useQuery } from "@tanstack/react-query";

import { client } from "@/lib/rpc";
import { QUERY_CONFIG } from "@/lib/query-config";

import { AGENT_CONTEXT_QUERY_KEY } from "../constants";

export const useGetAgentContext = () => {
  return useQuery({
    queryKey: AGENT_CONTEXT_QUERY_KEY,
    staleTime: QUERY_CONFIG.SEMI_DYNAMIC.staleTime,
    gcTime: QUERY_CONFIG.SEMI_DYNAMIC.gcTime,
    queryFn: async () => {
      const response = await client.api.agent.context.$get();
      if (!response.ok) {
        throw new Error("Failed to fetch agent context.");
      }
      const { data } = await response.json();
      return data;
    },
  });
};

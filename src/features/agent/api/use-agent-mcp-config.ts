import { useQuery } from "@tanstack/react-query";

import { client } from "@/lib/rpc";
import { QUERY_CONFIG } from "@/lib/query-config";

import { AGENT_MCP_QUERY_KEY } from "../constants";

export const useGetAgentMcpConfig = () => {
  return useQuery({
    queryKey: AGENT_MCP_QUERY_KEY,
    staleTime: QUERY_CONFIG.SEMI_DYNAMIC.staleTime,
    gcTime: QUERY_CONFIG.SEMI_DYNAMIC.gcTime,
    queryFn: async () => {
      const response = await client.api.agent.mcp.$get();
      if (!response.ok) {
        throw new Error("Failed to fetch MCP config.");
      }
      const { data } = await response.json();
      return data;
    },
  });
};

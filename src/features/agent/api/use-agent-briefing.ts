import { useQuery } from "@tanstack/react-query";

import { client } from "@/lib/rpc";
import { QUERY_CONFIG } from "@/lib/query-config";

import { AGENT_BRIEFING_QUERY_KEY } from "../constants";

export const useGetAgentBriefing = () => {
  return useQuery({
    queryKey: AGENT_BRIEFING_QUERY_KEY,
    staleTime: QUERY_CONFIG.SEMI_DYNAMIC.staleTime,
    gcTime: QUERY_CONFIG.SEMI_DYNAMIC.gcTime,
    queryFn: async () => {
      const response = await client.api.agent.briefing.$get();
      if (!response.ok) {
        throw new Error("Failed to fetch daily briefing.");
      }
      const { data } = await response.json();
      return data;
    },
  });
};

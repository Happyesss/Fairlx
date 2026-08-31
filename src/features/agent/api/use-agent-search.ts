import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { client } from "@/lib/rpc";
import { QUERY_CONFIG } from "@/lib/query-config";

import { AGENT_HARNESS_QUERY_KEY, AGENT_RUNS_QUERY_KEY } from "../constants";
import type { AgentSearchHit } from "../types";

export const agentSearchQueryKey = (query: string) => ["agent-search", query] as const;

export const useSearchAgent = (query: string) => {
  const trimmed = query.trim();
  return useQuery({
    queryKey: agentSearchQueryKey(trimmed),
    enabled: trimmed.length > 0,
    staleTime: QUERY_CONFIG.DYNAMIC.staleTime,
    gcTime: QUERY_CONFIG.DYNAMIC.gcTime,
    queryFn: async () => {
      const response = await client.api.agent.search.$get({ query: { q: trimmed } });
      if (!response.ok) {
        throw new Error("Failed to search the Agent harness.");
      }
      const body = (await response.json()) as { data: AgentSearchHit[]; query: string };
      return body.data;
    },
  });
};

export const useRunAgentAutomation = () => {
  return useMutation({
    mutationFn: async ({ automationId }: { automationId: string }) => {
      const response = await client.api.agent.harness.automations[":automationId"].run.$post({
        param: { automationId },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: "Failed to run automation." }));
        throw new Error(
          "error" in body && typeof body.error === "string" ? body.error : "Failed to run automation.",
        );
      }
      return (await response.json()) as { data: { id: string } };
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to run automation.");
    },
  });
};

export const AGENT_SEARCH_INVALIDATION = [AGENT_RUNS_QUERY_KEY, AGENT_HARNESS_QUERY_KEY] as const;

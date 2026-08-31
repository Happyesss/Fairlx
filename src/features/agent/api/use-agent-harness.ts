import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";

import { client } from "@/lib/rpc";
import { QUERY_CONFIG } from "@/lib/query-config";

import { AGENT_HARNESS_QUERY_KEY, AGENT_RUNS_QUERY_KEY } from "../constants";

type UpdateHarnessResponse = InferResponseType<(typeof client.api)["agent"]["harness"]["$put"], 200>;
type UpdateHarnessRequest = InferRequestType<(typeof client.api)["agent"]["harness"]["$put"]>;
type ResetHarnessResponse = InferResponseType<
  (typeof client.api)["agent"]["harness"]["reset"]["$post"],
  200
>;

async function readError(response: Response, fallback: string): Promise<never> {
  const body = await response.json().catch(() => ({ error: fallback }));
  throw new Error(
    "error" in body && typeof body.error === "string" ? body.error : fallback
  );
}

export const useGetAgentHarness = () => {
  return useQuery({
    queryKey: AGENT_HARNESS_QUERY_KEY,
    staleTime: QUERY_CONFIG.SEMI_DYNAMIC.staleTime,
    gcTime: QUERY_CONFIG.SEMI_DYNAMIC.gcTime,
    queryFn: async () => {
      const response = await client.api.agent.harness.$get();
      if (!response.ok) {
        throw new Error("Failed to fetch agent harness.");
      }
      const { data } = await response.json();
      return data;
    },
  });
};

export const useUpdateAgentHarness = () => {
  const queryClient = useQueryClient();

  return useMutation<UpdateHarnessResponse, Error, UpdateHarnessRequest>({
    mutationFn: async ({ json }) => {
      const response = await client.api.agent.harness.$put({ json });
      if (!response.ok) {
        await readError(response, "Failed to save agent harness.");
      }
      return (await response.json()) as UpdateHarnessResponse;
    },
    onSuccess: (result) => {
      queryClient.setQueryData(AGENT_HARNESS_QUERY_KEY, result.data);
      queryClient.invalidateQueries({ queryKey: AGENT_HARNESS_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to save agent harness.");
    },
  });
};

export const useResetAgentHarness = () => {
  const queryClient = useQueryClient();

  return useMutation<ResetHarnessResponse, Error, void>({
    mutationFn: async () => {
      const response = await client.api.agent.harness.reset.$post();
      if (!response.ok) {
        await readError(response, "Failed to reset agent harness.");
      }
      return (await response.json()) as ResetHarnessResponse;
    },
    onSuccess: (result) => {
      toast.success("Agent harness reset.");
      queryClient.setQueryData(AGENT_HARNESS_QUERY_KEY, result.data);
      queryClient.invalidateQueries({ queryKey: AGENT_HARNESS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: AGENT_RUNS_QUERY_KEY });
      queryClient.removeQueries({ queryKey: ["agent-run"] });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to reset agent harness.");
    },
  });
};

import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";

import { client } from "@/lib/rpc";
import { QUERY_CONFIG } from "@/lib/query-config";

import { PERSONAL_AGENT_QUERY_KEY, AGENT_RUNS_QUERY_KEY, AGENT_HARNESS_QUERY_KEY } from "../constants";

type PersonalResponse = InferResponseType<(typeof client.api)["agent"]["personal"]["$get"], 200>;
type QuestionsResponse = InferResponseType<(typeof client.api)["agent"]["personal"]["questions"]["$get"], 200>;
type CompileRequest = InferRequestType<(typeof client.api)["agent"]["personal"]["compile"]["$post"]>;
type CompileResponse = InferResponseType<(typeof client.api)["agent"]["personal"]["compile"]["$post"], 200>;
type SaveRequest = InferRequestType<(typeof client.api)["agent"]["personal"]["$put"]>;
type SaveResponse = InferResponseType<(typeof client.api)["agent"]["personal"]["$put"], 200>;

async function readError(response: Response, fallback: string): Promise<never> {
  const body = await response.json().catch(() => ({ error: fallback }));
  throw new Error("error" in body && typeof body.error === "string" ? body.error : fallback);
}

export function useGetPersonalAgent() {
  return useQuery({
    queryKey: PERSONAL_AGENT_QUERY_KEY,
    staleTime: QUERY_CONFIG.SEMI_DYNAMIC.staleTime,
    gcTime: QUERY_CONFIG.SEMI_DYNAMIC.gcTime,
    queryFn: async () => {
      const response = await client.api.agent.personal.$get();
      if (!response.ok) throw new Error("Failed to load personal agent.");
      const { data } = (await response.json()) as PersonalResponse;
      return data;
    },
  });
}

type QuestionsQuery = NonNullable<
  InferRequestType<(typeof client.api)["agent"]["personal"]["questions"]["$get"]>["query"]
>;

export function useGetPersonalTrainingQuestions(personaRole?: QuestionsQuery["personaRole"]) {
  return useQuery({
    queryKey: [...PERSONAL_AGENT_QUERY_KEY, "questions", personaRole ?? ""] as const,
    staleTime: QUERY_CONFIG.SEMI_DYNAMIC.staleTime,
    queryFn: async () => {
      const response = await client.api.agent.personal.questions.$get({
        query: personaRole ? { personaRole } : {},
      });
      if (!response.ok) throw new Error("Failed to load training questions.");
      const { data } = (await response.json()) as QuestionsResponse;
      return data;
    },
  });
}

export function useCompilePersonalAgent() {
  return useMutation<CompileResponse, Error, CompileRequest>({
    mutationFn: async ({ json }) => {
      const response = await client.api.agent.personal.compile.$post({ json });
      if (!response.ok) await readError(response, "Failed to compile personal prompt.");
      return (await response.json()) as CompileResponse;
    },
    onError: (error) => {
      toast.error(error.message || "Failed to compile personal prompt.");
    },
  });
}

export function useSavePersonalAgent() {
  const queryClient = useQueryClient();
  return useMutation<SaveResponse, Error, SaveRequest>({
    mutationFn: async ({ json }) => {
      const response = await client.api.agent.personal.$put({ json });
      if (!response.ok) await readError(response, "Failed to save personal agent.");
      return (await response.json()) as SaveResponse;
    },
    onSuccess: () => {
      toast.success("Personal Agent trained and saved.");
      queryClient.invalidateQueries({ queryKey: PERSONAL_AGENT_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to save personal agent.");
    },
  });
}

type StartTrainingResponse = InferResponseType<(typeof client.api)["agent"]["personal"]["start"]["$post"], 200>;

export function useStartPersonalTraining() {
  const queryClient = useQueryClient();
  return useMutation<StartTrainingResponse, Error, void>({
    mutationFn: async () => {
      const response = await client.api.agent.personal.start.$post();
      if (!response.ok) await readError(response, "Failed to start the training chat.");
      return (await response.json()) as StartTrainingResponse;
    },
    onSuccess: (result) => {
      queryClient.setQueryData(["agent-run", result.data.id], { ...result.data, status: "running" });
      queryClient.invalidateQueries({ queryKey: AGENT_RUNS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: AGENT_HARNESS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: PERSONAL_AGENT_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to start the training chat.");
    },
  });
}

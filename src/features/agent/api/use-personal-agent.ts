import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";

import { client } from "@/lib/rpc";
import { QUERY_CONFIG } from "@/lib/query-config";

import { PERSONAL_AGENT_QUERY_KEY, AGENT_RUNS_QUERY_KEY, AGENT_HARNESS_QUERY_KEY, AGENT_BRIEFING_QUERY_KEY } from "../constants";

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

type SelfTrainProgress = { percent: number; stage?: string; answered?: number; total?: number; done?: boolean; error?: string };

async function readSelfTrainStream(
  onProgress?: (event: SelfTrainProgress) => void,
): Promise<void> {
  const response = await fetch("/api/agent/personal/self-train", {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) await readError(response, "Failed to self-train the personal agent.");
  if (!response.body) throw new Error("Failed to self-train the personal agent.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let lastError = "";
  let completed = false;
  const consume = (chunk: string) => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as SelfTrainProgress;
      onProgress?.(event);
      if (event.error) lastError = event.error;
      if (event.done) completed = true;
    }
  };
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    consume(decoder.decode(value, { stream: true }));
  }
  consume(decoder.decode());
  if (buffer.trim()) consume("\n");
  if (lastError) throw new Error(lastError);
  if (!completed) throw new Error("Self-train stopped before the agent was saved.");
}

export function useSelfTrainPersonalAgent() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { onProgress?: (event: SelfTrainProgress) => void } | void>({
    mutationFn: async (input) => {
      await readSelfTrainStream(input && typeof input === "object" ? input.onProgress : undefined);
    },
    onSuccess: () => {
      toast.success("Personal Agent trained from your workspace.");
      queryClient.invalidateQueries({ queryKey: PERSONAL_AGENT_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: AGENT_BRIEFING_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to self-train the personal agent.");
    },
  });
}

type ResetResponse = InferResponseType<(typeof client.api)["agent"]["personal"]["reset"]["$post"], 200>;

export function useResetPersonalAgent() {
  const queryClient = useQueryClient();
  return useMutation<ResetResponse, Error, void>({
    mutationFn: async () => {
      const response = await client.api.agent.personal.reset.$post();
      if (!response.ok) await readError(response, "Failed to reset the personal agent.");
      return (await response.json()) as ResetResponse;
    },
    onSuccess: () => {
      toast.success("Personal Agent reset. Train it again when you are ready.");
      queryClient.setQueryData(PERSONAL_AGENT_QUERY_KEY, (current) => {
        if (!current || typeof current !== "object") return current;
        return {
          ...current,
          profile: null,
          progress: { answered: 0, inferred: 0, total: 13, percent: 0 },
          activeTrainingRunId: null,
        };
      });
      queryClient.invalidateQueries({ queryKey: PERSONAL_AGENT_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: AGENT_BRIEFING_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: AGENT_RUNS_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to reset the personal agent.");
    },
  });
}

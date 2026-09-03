"use client";

import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";

import { useGetPersonalAgent, useStartPersonalTraining } from "../api/use-personal-agent";

export function PersonalAgentBanner() {
  const router = useRouter();
  const { data, isLoading } = useGetPersonalAgent();
  const start = useStartPersonalTraining();
  if (isLoading) return null;

  const trained = data?.profile?.status === "trained" && Boolean(data.profile.compiledPrompt.trim());

  return (
    <button
      type="button"
      onClick={() => {
        start.mutate(undefined, {
          onSuccess: (result) => router.push(`/agent/workflow?runId=${result.data.id}`),
        });
      }}
      disabled={start.isPending}
      className="w-full text-left flex items-center gap-3 rounded-xl px-3.5 py-3 border border-dashed border-violet-300 dark:border-violet-800 bg-card hover:bg-muted/40 transition-colors disabled:opacity-70"
    >
      {start.isPending ? (
        <Loader2 className="size-4 text-violet-600 shrink-0 animate-spin" />
      ) : (
        <Sparkles className="size-4 text-violet-600 shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">
          {start.isPending
            ? "Opening training chat…"
            : trained
              ? "Retrain your Personal Agent"
              : "Train your Personal Agent"}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Starts a chat interview. Answers become your standing prompt.
        </p>
      </div>
    </button>
  );
}

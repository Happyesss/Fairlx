"use client";

import { Bot, Files, Layers, Loader2, Sparkles } from "lucide-react";

import type { AgentRun } from "../types";
import { activeSubagents, editedFilePaths, estimateRunTokens, latestContextMeter } from "../lib/context-meter";
import { useGetAgentAiConfig } from "../api/use-agent-ai-config";

export function AgentRunHud({ run }: { run: AgentRun }) {
  const { data: ai } = useGetAgentAiConfig();
  const events = run.events ?? [];
  const thoughts = events.filter((event) => event.type === "thought");
  const lastThought = thoughts[thoughts.length - 1];
  const subagents = activeSubagents(events);
  const files = editedFilePaths(events);
  const meter = latestContextMeter(events);
  const maxTokens =
    meter?.maxInputTokens ||
    ai?.models.find((model) => model.id === (run.modelId || ai.resolvedModelId))?.maxInputTokens ||
    0;
  const tokens = meter?.tokens || estimateRunTokens(run.messages ?? []);
  const live = run.status === "running" || subagents.length > 0;
  const inFlight = [...events].reverse().find((event) =>
    event.type === "subagent_progress" || event.type === "mcp_call" || event.type === "delegate_agent",
  );

  if (run.status === "idle" && !events.length) return null;

  return (
    <div className="rounded-xl border border-border/80 bg-card/80 px-3 py-2.5 mb-2 shadow-sm space-y-2">
      <div className="flex items-start gap-2 text-xs">
        {live ? <Loader2 className="size-3.5 mt-0.5 animate-spin text-primary shrink-0" /> : <Sparkles className="size-3.5 mt-0.5 text-primary shrink-0" />}
        <p className="text-foreground leading-snug">
          <span className="font-medium">{lastThought?.title || (live ? "Working" : "Idle")}</span>
          {lastThought?.detail ? <span className="text-muted-foreground"> — {lastThought.detail}</span> : null}
          {inFlight && live ? <span className="text-muted-foreground"> · {inFlight.title}</span> : null}
        </p>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Bot className="size-3" />
          {subagents.length
            ? `${subagents.length} subagent${subagents.length === 1 ? "" : "s"}`
            : "Orchestrator"}
        </span>
        {subagents.slice(0, 4).map((item) => (
          <span key={item.id} className="inline-flex items-center gap-1">
            <span className="font-medium text-foreground">{item.specialist}</span>
            <span>from {item.parent}</span>
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <Layers className="size-3" />
          Context {tokens.toLocaleString()}
          {maxTokens ? ` / ${maxTokens.toLocaleString()}` : ""} tokens
        </span>
        <span className="inline-flex items-center gap-1">
          <Files className="size-3" />
          {files.length ? `${files.length} file${files.length === 1 ? "" : "s"} edited` : "No files edited"}
        </span>
      </div>
      {files.length ? (
        <p className="text-[11px] text-muted-foreground truncate">{files.slice(-4).join(" · ")}</p>
      ) : null}
    </div>
  );
}

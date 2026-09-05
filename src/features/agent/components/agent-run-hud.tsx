"use client";

import { useState } from "react";
import { Bot, ChevronUp, Files, Loader2, Sparkles, X } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { AgentRun } from "../types";
import { activeSubagents, editedFilePaths } from "../lib/context-meter";

export function AgentWorkingDropUp({ run }: { run?: AgentRun }) {
  const [open, setOpen] = useState(false);

  if (!run) return null;

  const events = run.events ?? [];
  const thoughts = events.filter((event) => event.type === "thought");
  const lastThought = thoughts[thoughts.length - 1];
  const subagents = activeSubagents(events);
  const files = editedFilePaths(events);
  const live = run.status === "running" || subagents.length > 0;
  const inFlight = [...events].reverse().find((event) =>
    event.type === "subagent_progress" || event.type === "mcp_call" || event.type === "delegate_agent",
  );

  // If run is completely idle and no events yet, don't show
  if (run.status === "idle" && !events.length) return null;

  const statusLabel = lastThought?.title || (live ? "Working" : "Idle");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md hover:bg-muted hover:text-foreground font-medium transition-colors cursor-pointer select-none text-[11px] shrink-0",
            open && "bg-muted text-foreground",
            live ? "text-primary font-semibold" : "text-muted-foreground"
          )}
          title={`Status: ${statusLabel} (click for details)`}
          aria-label={`Status: ${statusLabel}`}
        >
          {live ? (
            <Loader2 className="size-3 animate-spin text-primary shrink-0" />
          ) : (
            <Sparkles className="size-3 text-primary shrink-0" />
          )}
          <span className="truncate max-w-[130px]">{statusLabel}</span>
          <ChevronUp className="size-3 opacity-60 shrink-0" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        side="top"
        align="end"
        sideOffset={8}
        className="w-[340px] sm:w-[400px] p-3.5 bg-popover/95 dark:bg-zinc-900/95 backdrop-blur-md border border-border/80 dark:border-zinc-800 shadow-xl rounded-xl text-popover-foreground space-y-2.5 z-50 select-none"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 text-xs min-w-0">
            {live ? (
              <Loader2 className="size-3.5 mt-0.5 animate-spin text-primary shrink-0" />
            ) : (
              <Sparkles className="size-3.5 mt-0.5 text-primary shrink-0" />
            )}
            <div className="min-w-0 leading-snug">
              <span className="font-semibold text-foreground">{statusLabel}</span>
              {lastThought?.detail ? (
                <p className="text-muted-foreground mt-0.5 text-[11px] leading-relaxed break-words">
                  {lastThought.detail}
                </p>
              ) : null}
              {inFlight && live ? (
                <p className="text-primary mt-0.5 text-[11px] font-medium truncate">
                  · {inFlight.title}
                </p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="size-5 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="size-3.5" />
          </button>
        </div>

        <div className="h-px bg-border/60" />

        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Bot className="size-3 text-primary shrink-0" />
            <span className="text-foreground font-medium">
              {subagents.length
                ? `${subagents.length} subagent${subagents.length === 1 ? "" : "s"}`
                : "Orchestrator"}
            </span>
          </span>

          {subagents.slice(0, 4).map((item) => (
            <span key={item.id} className="inline-flex items-center gap-1">
              <span className="font-medium text-foreground">{item.specialist}</span>
              <span>from {item.parent}</span>
            </span>
          ))}

          <span className="inline-flex items-center gap-1">
            <Files className="size-3 text-primary shrink-0" />
            <span className="text-foreground font-medium">
              {files.length ? `${files.length} file${files.length === 1 ? "" : "s"} edited` : "No files edited"}
            </span>
          </span>
        </div>

        {files.length ? (
          <p className="text-[11px] text-muted-foreground truncate font-mono bg-muted/40 px-2 py-1 rounded">
            {files.slice(-4).join(" · ")}
          </p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

// Backwards-compatible export
export const AgentRunHud = AgentWorkingDropUp;

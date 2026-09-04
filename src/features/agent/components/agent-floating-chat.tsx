"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bot,
  ExternalLink,
  Loader2,
  Maximize2,
  Minimize2,
  SquarePen,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCurrent } from "@/features/auth/api/use-current";
import { useProjectId } from "@/features/projects/hooks/use-project-id";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { cn } from "@/lib/utils";

import {
  useConfirmAgentRun,
  useContinueAgentRun,
  useDenyAgentRun,
  useGetAgentRun,
  useSendAgentMessage,
  useStopAgentRun,
} from "../api/use-agent-runs";
import { firstName, greetingForNow } from "../lib/agent-ui";
import type { AgentRun } from "../types";
import { AgentChatThread } from "./agent-chat-thread";
import { AgentCommandInput } from "./agent-command-input";
import { AgentShell } from "./agent-ui-context";

const STORAGE_KEY = "fairlx.agent.floating-run-id";

function routeId(value?: string | null): string | undefined {
  if (!value || value === "undefined" || value === "null") return undefined;
  return value;
}

function readStoredRunId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function persistRunId(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (id) window.localStorage.setItem(STORAGE_KEY, id);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore quota / private mode
  }
}

function statusCopy(status?: AgentRun["status"]) {
  if (status === "running") return { label: "Running", tone: "live" as const };
  if (status === "awaiting_confirmation") return { label: "Needs approval", tone: "live" as const };
  if (status === "completed") return { label: "Completed", tone: "done" as const };
  if (status === "failed") return { label: "Failed", tone: "bad" as const };
  if (status === "stopped") return { label: "Stopped", tone: "bad" as const };
  return { label: "Ready", tone: "idle" as const };
}

export function AgentFloatingChat() {
  return (
    <AgentShell>
      <AgentFloatingChatInner />
    </AgentShell>
  );
}

function AgentFloatingChatInner() {
  const { data: user } = useCurrent();
  const workspaceId = routeId(useWorkspaceId());
  const projectId = routeId(useProjectId());
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const continuedRef = useRef<string | null>(null);

  const { data: run, isLoading, isError } = useGetAgentRun(open ? runId ?? undefined : undefined);
  const sendMessage = useSendAgentMessage();
  const confirmRun = useConfirmAgentRun();
  const denyRun = useDenyAgentRun();
  const stopRun = useStopAgentRun();
  const continueRun = useContinueAgentRun();

  useEffect(() => {
    setRunId(readStoredRunId());
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open || !runId || isLoading) return;
    if (isError || !run) persistRunId(null);
    if (isError) setRunId(null);
  }, [open, runId, isLoading, isError, run]);

  useEffect(() => {
    if (!run) return;
    if (continuedRef.current === run.id) return;
    continuedRef.current = run.id;
    if (run.status === "running") continueRun.mutate({ runId: run.id });
  }, [run, continueRun]);

  useEffect(() => {
    if (!stickToBottomRef.current) return;
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [run?.messages.length, run?.events.length, run?.status]);

  const setActiveRun = (id: string | null) => {
    setRunId(id);
    persistRunId(id);
    stickToBottomRef.current = true;
  };

  const status = statusCopy(run?.status);
  const running = run?.status === "running";
  const awaiting = run?.status === "awaiting_confirmation";

  if (!open) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={() => setOpen(true)}
              className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg bg-primary text-primary-foreground hover:bg-primary/90 z-50"
              size="icon"
              aria-label="Open fairlx Agent"
            >
              <Bot className="h-6 w-6" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>fairlx Agent</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 z-50 flex flex-col bg-background border border-border rounded-2xl shadow-2xl overflow-hidden",
        expanded ? "w-[600px] h-[80vh]" : "w-[400px] h-[min(640px,80vh)]",
      )}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-border bg-card/70 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="size-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-sm">
            <Bot className="size-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground leading-tight truncate">
              {run?.title || "fairlx Agent"}
            </h3>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  status.tone === "live" && "bg-blue-500 animate-pulse",
                  status.tone === "done" && "bg-green-500",
                  status.tone === "bad" && "bg-destructive",
                  status.tone === "idle" && "bg-muted-foreground/50",
                )}
              />
              <span>{status.label}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {run ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                title="New chat"
                onClick={() => setActiveRun(null)}
              >
                <SquarePen className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                title="Open in Agent"
                asChild
              >
                <Link href={`/agent/workflow?runId=${run.id}`}>
                  <ExternalLink className="size-4" />
                </Link>
              </Button>
            </>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title={expanded ? "Minimize" : "Expand"}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="Close"
            onClick={() => setOpen(false)}
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      <div className="relative flex-1 min-h-0 flex flex-col">
        {runId && isLoading && !run ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-5 animate-spin text-primary" />
            <span>Loading run…</span>
          </div>
        ) : run ? (
          <>
            <div
              ref={scrollerRef}
              className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-3 py-3"
              onScroll={(event) => {
                const target = event.currentTarget;
                const gap = target.scrollHeight - target.scrollTop - target.clientHeight;
                stickToBottomRef.current = gap < 80;
              }}
            >
              <AgentChatThread
                run={run}
                compact
                sending={sendMessage.isPending}
                isAccepting={confirmRun.isPending}
                isDenying={denyRun.isPending}
                onSendEdit={(content) => {
                  stickToBottomRef.current = true;
                  sendMessage.mutate({ param: { runId: run.id }, json: { content } });
                }}
                onPickChoice={(choice) => {
                  stickToBottomRef.current = true;
                  sendMessage.mutate({ param: { runId: run.id }, json: { content: choice } });
                }}
                onConfirm={() => confirmRun.mutate({ runId: run.id })}
                onDeny={() => denyRun.mutate({ runId: run.id })}
              />
            </div>
            <div className="shrink-0 border-t border-border bg-background px-3 py-2.5">
              <AgentCommandInput
                run={run}
                variant="followup"
                compact
                workspaceId={workspaceId}
                projectId={projectId}
                showQuickActions={!awaiting && !running}
                submitting={sendMessage.isPending || awaiting || running}
                placeholder={
                  awaiting
                    ? "Accept or deny the pending action first"
                    : run.kind === "training"
                      ? "Type your own answer, or tap a choice above"
                      : "Plan, Build, / for skills, @ for context"
                }
                onFollowUp={(content) => {
                  stickToBottomRef.current = true;
                  sendMessage.mutate({ param: { runId: run.id }, json: { content } });
                }}
                onStop={() => stopRun.mutate({ runId: run.id })}
                isStopping={stopRun.isPending}
              />
            </div>
          </>
        ) : (
          <>
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-4 py-6">
              <div className="space-y-1.5 mb-5">
                <h2 className="text-lg font-semibold text-foreground tracking-tight">
                  {greetingForNow()}, {firstName(user?.name, user?.email)}
                </h2>
                <p className="text-sm text-muted-foreground">
                  What would you like to build, investigate, or ship today?
                </p>
              </div>
            </div>
            <div className="shrink-0 border-t border-border bg-background px-3 py-2.5">
              <AgentCommandInput
                compact
                workspaceId={workspaceId}
                projectId={projectId}
                showQuickActions
                placeholder="Plan, Build, / for skills, @ for context"
                onCreated={(created) => setActiveRun(created.id)}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

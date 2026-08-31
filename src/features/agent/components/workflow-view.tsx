"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";

import { useGetAgentRun, useSendAgentMessage, useStopAgentRun } from "../api/use-agent-runs";
import { AGENT_TOOL_CATALOG } from "../constants";
import { relativeTime } from "../lib/agent-ui";
import type { AgentChatMessage, AgentRunStatus } from "../types";
import { AgentCommandInput } from "./agent-command-input";

function statusClass(status: AgentRunStatus) {
  if (status === "running") return "text-fairlx-primary";
  if (status === "completed") return "text-green-500";
  if (status === "failed") return "text-red-400";
  return "text-fairlx-text-muted";
}

function MessageBubble({ message }: { message: AgentChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl bg-fairlx-primary/15 border border-fairlx-primary/20 px-4 py-3 text-sm whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    );
  }
  if (message.role === "tool") {
    return (
      <div className="rounded-lg border border-fairlx-border bg-fairlx-surface px-3 py-2 text-xs text-fairlx-text-muted">
        <div className="font-medium text-fairlx-text mb-1">
          <i className="fa-solid fa-wrench mr-2" />
          {message.toolName || "tool"}
        </div>
        <pre className="whitespace-pre-wrap font-sans">{message.content}</pre>
      </div>
    );
  }
  return (
    <div className="max-w-[85%] rounded-2xl bg-fairlx-surface border border-fairlx-border px-4 py-3 text-sm whitespace-pre-wrap">
      {message.content || "…"}
    </div>
  );
}

function WorkflowViewInner() {
  const searchParams = useSearchParams();
  const runId = searchParams.get("runId") ?? undefined;
  const { data: run, isLoading, error } = useGetAgentRun(runId);
  const sendMessage = useSendAgentMessage();
  const stopRun = useStopAgentRun();
  const [draft, setDraft] = useState("");

  if (!runId) {
    return (
      <div className="h-full overflow-y-auto p-8 scrollbar-hide">
        <div className="max-w-3xl mx-auto space-y-4">
          <h1 className="text-2xl font-semibold text-white">Workflow</h1>
          <p className="text-sm text-fairlx-text-muted">
            Start a run to open the Agent harness. Manual mode chats without tools; Agent mode uses enabled tools.
          </p>
          <AgentCommandInput showQuickActions />
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-fairlx-text-muted">
        Loading run…
      </div>
    );
  }

  if (!run) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-sm text-fairlx-text-muted">
        <p>{error?.message || "Run not found."}</p>
        <Link href="/agent/dashboard" className="text-fairlx-primary hover:underline">
          Back to Agent Home
        </Link>
      </div>
    );
  }

  const running = run.status === "running";

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-8 py-4 border-b border-fairlx-border flex items-center gap-3">
        <div className="min-w-0">
          <div className="text-xs text-fairlx-text-muted">
            <Link href="/agent/dashboard" className="hover:text-white">
              Agent
            </Link>
            <span className="mx-2">/</span>
            Workflow
          </div>
          <h1 className="text-lg font-semibold text-white truncate">{run.title}</h1>
        </div>
        <span className={`ml-auto text-xs capitalize ${statusClass(run.status)}`}>{run.status}</span>
        {running ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={stopRun.isPending}
            onClick={() => stopRun.mutate({ runId: run.id })}
          >
            Stop
          </Button>
        ) : null}
      </div>
      <div className="flex-1 min-h-0 grid lg:grid-cols-[1fr_280px]">
        <div className="min-h-0 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {run.messages.length === 0 ? (
            <p className="text-sm text-fairlx-text-muted">No messages yet.</p>
          ) : (
            run.messages.map((message) => <MessageBubble key={message.id} message={message} />)
          )}
          {run.error ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {run.error}
            </div>
          ) : null}
          {running ? <p className="text-xs text-fairlx-primary">Agent is working…</p> : null}
        </div>
        <aside className="hidden lg:block border-l border-fairlx-border overflow-y-auto p-4 custom-scrollbar">
          <h2 className="text-xs uppercase tracking-wide text-fairlx-text-muted mb-3">Harness activity</h2>
          {(run.events ?? []).length === 0 ? (
            <p className="text-xs text-fairlx-text-muted">No tool events yet.</p>
          ) : (
            <div className="space-y-2">
              {run.events.map((event) => (
                <div key={event.id} className="rounded-lg border border-fairlx-border px-3 py-2">
                  <div className="text-xs font-medium text-white">
                    <i
                      className={`${AGENT_TOOL_CATALOG.find((tool) => tool.id === event.type)?.icon ?? "fa-solid fa-circle-nodes"} mr-2 text-fairlx-primary`}
                    />
                    {event.title}
                  </div>
                  {event.detail ? (
                    <p className="mt-1 text-[11px] text-fairlx-text-muted whitespace-pre-wrap">{event.detail}</p>
                  ) : null}
                  <p className="mt-1 text-[10px] text-fairlx-text-muted">{relativeTime(event.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
      <form
        className="border-t border-fairlx-border p-4"
        onSubmit={(event) => {
          event.preventDefault();
          const content = draft.trim();
          if (!content || running || sendMessage.isPending) return;
          sendMessage.mutate(
            { param: { runId: run.id }, json: { content } },
            { onSuccess: () => setDraft("") }
          );
        }}
      >
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            rows={2}
            disabled={running}
            placeholder={running ? "Wait for the Agent to finish this turn…" : "Send a follow-up…"}
            className="flex-1 resize-none rounded-xl border border-fairlx-border bg-fairlx-surface px-3 py-2 text-sm text-fairlx-text placeholder:text-fairlx-text-muted focus:outline-none"
          />
          <Button type="submit" disabled={!draft.trim() || running || sendMessage.isPending}>
            Send
          </Button>
        </div>
      </form>
    </div>
  );
}

export function WorkflowView() {
  return (
    <Suspense
      fallback={
        <div className="h-full flex items-center justify-center text-sm text-fairlx-text-muted">
          Loading workflow…
        </div>
      }
    >
      <WorkflowViewInner />
    </Suspense>
  );
}

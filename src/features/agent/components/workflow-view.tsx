"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

import { useGetAgentAiConfig } from "../api/use-agent-ai-config";
import { useGetAgentContext } from "../api/use-agent-context";
import { useGetAgentHarness, useUpdateAgentHarness } from "../api/use-agent-harness";
import { useGetAgentMcpConfig } from "../api/use-agent-mcp-config";
import {
  useContinueAgentRun,
  useDeleteAgentRun,
  useGetAgentRun,
  usePatchAgentRun,
  useSendAgentMessage,
  useStopAgentRun,
} from "../api/use-agent-runs";
import { useCurrent } from "@/features/auth/api/use-current";
import { selectedModelLabel } from "../lib/client-defaults";
import { clockTime, relativeTime, userInitials } from "../lib/agent-ui";
import { groupTranscript, summarizeToolResult, toolLabel, activitySummary, type TranscriptStep } from "../lib/transcript";
import { displayUserContent } from "../lib/session-context";
import type { AgentChatMessage, AgentRun, AgentToolEvent } from "../types";
import { AgentCommandInput } from "./agent-command-input";
import { useAgentUi } from "./agent-ui-context";
import { ModelPicker } from "./model-picker";

function FloatingComposer({ children }: { children: React.ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 bg-gradient-to-t from-gray-950 via-gray-950/90 to-transparent pt-16">
      <div className="pointer-events-auto mx-auto w-full max-w-[720px] px-4 pb-5">
        {children}
      </div>
    </div>
  );
}

function UserBubble({ message }: { message: AgentChatMessage }) {
  return (
    <div className="flex gap-4 justify-end">
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 max-w-2xl text-gray-300 relative group">
        <div className="text-xs text-gray-500 mb-1">
          You <span className="mx-1">•</span> {clockTime(message.createdAt)}
        </div>
        <p className="leading-relaxed whitespace-pre-wrap">{displayUserContent(message.content)}</p>
      </div>
    </div>
  );
}

function AgentBubble({ message }: { message: AgentChatMessage }) {
  if (!message.content?.trim()) return null;
  return (
    <div className="flex gap-4">
      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium shrink-0 mt-1">
        f
      </div>
      <div className="flex-1 flex flex-col gap-2 min-w-0">
        <div className="text-xs text-gray-500 flex items-center gap-2">
          <span className="font-medium text-gray-300">fairlx Agent</span>
          <span>•</span>
          <span>{clockTime(message.createdAt)}</span>
        </div>
        <p className="text-gray-300 leading-relaxed max-w-3xl whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
}

function StepsCard({
  lead,
  steps,
  running,
}: {
  lead?: AgentChatMessage;
  steps: TranscriptStep[];
  running: boolean;
}) {
  const [open, setOpen] = useState(true);
  const failed = steps.some((step) => !summarizeToolResult(step.call.name, step.result?.content).ok);
  const last = steps[steps.length - 1];
  const inProgress = running && last && !last.result;

  return (
    <div className="flex gap-4">
      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium shrink-0 mt-1">
        f
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-3">
        <div className="text-xs text-gray-500 flex items-center gap-2">
          <span className="font-medium text-gray-300">fairlx Agent</span>
          {lead?.createdAt ? (
            <>
              <span>•</span>
              <span>{clockTime(lead.createdAt)}</span>
            </>
          ) : null}
        </div>
        {lead?.content ? (
          <p className="text-gray-300 leading-relaxed max-w-3xl whitespace-pre-wrap">{lead.content}</p>
        ) : null}
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden max-w-4xl mt-2">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="w-full px-4 py-3 border-b border-gray-800 flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-3">
              {inProgress ? (
                <i className="fa-solid fa-circle-notch fa-spin text-gray-400" />
              ) : failed ? (
                <i className="fa-solid fa-triangle-exclamation text-red-400" />
              ) : (
                <i className="fa-solid fa-check text-green-500" />
              )}
              <span className="font-medium text-gray-200">
                {inProgress ? "Working on it..." : failed ? "Finished with errors" : "Finished"}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span>
                {steps.length} {steps.length === 1 ? "step" : "steps"}
              </span>
              <i className={cn("fa-solid", open ? "fa-chevron-up" : "fa-chevron-down")} />
            </div>
          </button>
          {open ? (
            <div className="flex flex-col">
              {steps.map((step, index) => {
                const summary = summarizeToolResult(step.call.name, step.result?.content);
                const active = inProgress && index === steps.length - 1 && !step.result;
                return (
                  <div
                    key={step.call.id}
                    className={cn(
                      "px-4 py-3 flex items-start gap-4",
                      index < steps.length - 1 && "border-b border-gray-800",
                      active && "bg-gray-850 relative before:absolute before:left-0 before:top-0 before:bottom-0 before:w-0.5 before:bg-blue-500",
                    )}
                  >
                    <div className="mt-0.5 w-4 text-center">
                      {active ? (
                        <span className="font-mono text-blue-500 text-sm">{index + 1}</span>
                      ) : summary.ok ? (
                        <i className="fa-solid fa-check text-green-500" />
                      ) : (
                        <i className="fa-solid fa-xmark text-red-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={cn("font-medium", active ? "text-blue-400" : "text-gray-200")}>
                        {toolLabel(step.call.name)}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 truncate">
                        {step.event?.title || summary.detail}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs shrink-0">
                      {active ? (
                        <span className="text-blue-400 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                          In progress
                        </span>
                      ) : summary.ok ? (
                        <span className="text-green-500">
                          <i className="fa-regular fa-circle-check mr-1" />
                          Completed
                        </span>
                      ) : (
                        <span className="text-red-400">Failed</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ContextRow({
  icon,
  iconClass,
  label,
  value,
  href,
  onClick,
}: {
  icon: string;
  iconClass?: string;
  label: string;
  value: string;
  href?: string;
  onClick?: () => void;
}) {
  const inner = (
    <div className="flex items-center justify-between p-2 rounded-md hover:bg-gray-850 cursor-pointer border border-transparent hover:border-gray-800 group transition-colors">
      <div className="flex items-center gap-2 min-w-0">
        <i className={`${icon} ${iconClass ?? "text-gray-400"}`} />
        <span className="text-gray-300 text-sm group-hover:text-gray-200 truncate">{value}</span>
      </div>
      <i className="fa-solid fa-chevron-right text-gray-600 text-xs group-hover:text-gray-400" />
    </div>
  );
  return (
    <div>
      <div className="text-xs text-gray-500 mb-2">{label}</div>
      {href ? (
        <Link href={href}>{inner}</Link>
      ) : onClick ? (
        <button type="button" className="w-full text-left" onClick={onClick}>
          {inner}
        </button>
      ) : (
        inner
      )}
    </div>
  );
}

function WorkflowSidebar({
  run,
  events,
  tab,
  onTab,
}: {
  run: AgentRun;
  events: AgentToolEvent[];
  tab: "context" | "changes" | "terminal" | "preview";
  onTab: (tab: "context" | "changes" | "terminal" | "preview") => void;
}) {
  const { openMcp } = useAgentUi();
  const { data: context } = useGetAgentContext();
  const { data: harness } = useGetAgentHarness();
  const { data: mcp } = useGetAgentMcpConfig();
  const { data: ai } = useGetAgentAiConfig();
  const workspace = context?.workspaces.find((item) => item.id === run.workspaceId) ?? context?.workspaces[0];
  const project = context?.projects.find((item) => item.id === run.projectId);
  const connected = Object.values(mcp?.mcpServers ?? {}).filter((server) => !server.disabled).length;
  const staging = harness?.gitStaging?.items ?? [];
  const live = events.slice(-12);
  const repo = (context?.githubRepos ?? []).find((item) => item.projectId === project?.id);
  const terminals = events.filter((event) => event.type === "terminal");
  const githubUrl = repo?.githubUrl || (repo?.owner && repo.repositoryName ? `https://github.com/${repo.owner}/${repo.repositoryName}` : "");

  return (
    <aside className="hidden lg:flex w-72 bg-gray-900 border-l border-gray-800 flex-col flex-shrink-0">
      <div className="flex border-b border-gray-800 shrink-0">
        {(
          [
            ["context", "Context"],
            ["changes", "Changes"],
            ["terminal", "Terminal"],
            ["preview", "Preview"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => onTab(id)}
            className={cn(
              "flex-1 py-3 text-sm font-medium transition-colors",
              tab === id
                ? "text-blue-400 border-b-2 border-blue-500 bg-gray-850"
                : "text-gray-500 hover:text-gray-300",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar p-5 flex flex-col gap-6">
        {tab === "context" ? (
          <>
            <div className="flex flex-col gap-4">
              <ContextRow
                icon="fa-solid fa-globe"
                iconClass="text-green-500"
                label="Workspace"
                value={workspace?.name || "No workspace"}
                href={workspace ? `/workspaces/${workspace.id}` : "/agent/workspaces"}
              />
              <ContextRow
                icon="fa-solid fa-code"
                iconClass="text-blue-500"
                label="Project"
                value={project?.name || "No project"}
                href={
                  project
                    ? `/workspaces/${project.workspaceId}/projects/${project.id}`
                    : "/agent/projects"
                }
              />
              <div>
                <div className="text-xs text-gray-500 mb-2">Agent</div>
                <ModelPicker variant="sidebar" />
              </div>
              <button
                type="button"
                onClick={openMcp}
                className="flex items-center justify-between p-2 rounded-md hover:bg-gray-850 cursor-pointer border border-transparent hover:border-gray-800 group transition-colors w-full text-left"
              >
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-server text-gray-400" />
                  <span className="text-gray-300 text-sm group-hover:text-gray-200">MCP Servers</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-green-500">{connected} connected</span>
                  <i className="fa-solid fa-chevron-right text-gray-600 group-hover:text-gray-400" />
                </div>
              </button>
              {project && !repo ? (
                <Link
                  href={`/workspaces/${project.workspaceId}/projects/${project.id}/github`}
                  className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200"
                >
                  No GitHub repo linked. Sign in to GitHub to attach code, open branches, and review commits.
                </Link>
              ) : null}
            </div>
            <hr className="border-gray-800" />
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-300">Live Activity</h3>
                {run.status === "running" ? (
                  <div className="flex items-center gap-1.5 text-xs text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    Live
                  </div>
                ) : (
                  <span className="text-xs text-gray-500 capitalize">{run.status}</span>
                )}
              </div>
              {live.length === 0 ? (
                <p className="text-xs text-gray-500">No activity yet.</p>
              ) : (
                <div className="relative pl-3 border-l border-gray-800 flex flex-col gap-3">
                  {live.map((event, index) => {
                    const latest = index === live.length - 1 && run.status === "running";
                    const failed = event.type === "error" || /fail/i.test(event.title);
                    return (
                      <div key={event.id} className="relative">
                        <div
                          className={cn(
                            "absolute -left-[17px] top-1.5 w-2 h-2 rounded-full",
                            latest
                              ? "bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.5)]"
                              : failed
                                ? "bg-red-400"
                                : "bg-gray-600",
                          )}
                        />
                        <div className="flex items-start text-xs">
                          <span className={cn("w-16 shrink-0", latest ? "text-blue-400" : "text-gray-500")}>
                            {clockTime(event.createdAt, true)}
                          </span>
                          <span
                            className={cn(
                              "flex-1 ml-2",
                              latest ? "text-blue-400 font-medium" : failed ? "text-red-400" : "text-gray-400",
                            )}
                          >
                            {event.title}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <hr className="border-gray-800" />
            <div>
              <h3 className="text-sm font-semibold text-gray-300 mb-4">Run Settings</h3>
              <div className="flex flex-col gap-3 text-xs">
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">Model</span>
                  <span className="text-gray-300 truncate">{selectedModelLabel(ai)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Mode</span>
                  <span className="text-gray-300 capitalize">{run.mode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Steps</span>
                  <span className="text-gray-300">{events.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Started</span>
                  <span className="text-gray-300">{relativeTime(run.createdAt)}</span>
                </div>
              </div>
            </div>
          </>
        ) : null}
        {tab === "changes" ? (
          <div className="space-y-3">
            {staging.length === 0 ? (
              <p className="text-sm text-gray-500">No harness staging yet. Git stays in Fairlx staging — it is never executed on this Mac.</p>
            ) : (
              staging.map((item) => (
                <Link
                  key={item.id}
                  href="/agent/git"
                  className="block rounded-md border border-gray-800 px-3 py-2 hover:bg-gray-850"
                >
                  <p className="text-sm text-gray-200 truncate">{item.path}</p>
                  <p className="text-xs text-gray-500">
                    {item.status}
                    {item.branch ? ` · ${item.branch}` : ""}
                  </p>
                  {item.summary ? <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.summary}</p> : null}
                </Link>
              ))
            )}
            {repo ? (
              <a
                href={githubUrl}
                target="_blank"
                rel="noreferrer"
                className="block text-xs text-blue-400 hover:underline"
              >
                Open {repo.owner}/{repo.repositoryName} on GitHub
              </a>
            ) : null}
          </div>
        ) : null}
        {tab === "terminal" ? (
          <div className="space-y-2">
            {terminals.length === 0 ? (
              <p className="text-sm text-gray-500">
                No recorded commands. The agent logs planned terminal work here — it does not spawn a host shell.
              </p>
            ) : (
              terminals.map((event) => (
                <div key={event.id} className="rounded-md border border-gray-800 bg-black/40 px-3 py-2 font-mono text-[11px] text-zinc-300">
                  <div className="text-zinc-500 mb-1">{clockTime(event.createdAt, true)}</div>
                  <div>{event.title}</div>
                  {event.detail ? <div className="text-zinc-500 mt-1 whitespace-pre-wrap">{event.detail}</div> : null}
                </div>
              ))
            )}
          </div>
        ) : null}
        {tab === "preview" ? (
          <div className="space-y-3">
            {githubUrl ? (
              <>
                <p className="text-xs text-gray-500">
                  Live nginx tunnels are not hosted on Fairlx. Open the linked repo, or use GitHub.dev as a preview.
                </p>
                <a
                  href={githubUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-md border border-gray-800 px-3 py-2 text-sm text-blue-400 hover:bg-gray-850"
                >
                  Open repository
                </a>
                {repo?.owner && repo.repositoryName ? (
                  <a
                    href={`https://github.dev/${repo.owner}/${repo.repositoryName}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-md border border-gray-800 px-3 py-2 text-sm text-gray-200 hover:bg-gray-850"
                  >
                    Open in github.dev
                  </a>
                ) : null}
              </>
            ) : project ? (
              <Link
                href={`/workspaces/${project.workspaceId}/projects/${project.id}/github`}
                className="block rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200"
              >
                Connect GitHub to preview this project&apos;s code.
              </Link>
            ) : (
              <p className="text-sm text-gray-500">Select a project to preview linked code.</p>
            )}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function WorkflowViewInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const runId = searchParams.get("runId") ?? undefined;
  const { data: run, isLoading, error } = useGetAgentRun(runId);
  const { data: context } = useGetAgentContext();
  const { data: user } = useCurrent();
  const sendMessage = useSendAgentMessage();
  const stopRun = useStopAgentRun();
  const continueRun = useContinueAgentRun();
  const deleteRun = useDeleteAgentRun();
  const patchRun = usePatchAgentRun();
  const { data: harness } = useGetAgentHarness();
  const updateHarness = useUpdateAgentHarness();
  const continuedRef = useRef<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState("");
  const [tab, setTab] = useState<"context" | "changes" | "terminal" | "preview">("context");
  const [notesOpen, setNotesOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (run?.title) setTitle(run.title);
  }, [run?.title]);

  useEffect(() => {
    if (!run || run.status !== "running") return;
    if (continuedRef.current === run.id) return;
    continuedRef.current = run.id;
    continueRun.mutate({ runId: run.id });
  }, [run, continueRun]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [run?.messages.length, run?.events.length, run?.status]);

  const blocks = useMemo(
    () => groupTranscript(run?.messages ?? [], run?.events ?? []),
    [run?.messages, run?.events],
  );

  if (!runId) {
    return (
      <div className="relative h-full min-h-0 overflow-hidden bg-gray-950">
        <div className="absolute inset-0 overflow-y-auto custom-scrollbar px-8 pt-10 pb-40">
          <div className="max-w-3xl mx-auto space-y-3">
            <h1 className="text-2xl font-semibold text-white">Start a run</h1>
            <p className="text-sm text-zinc-500">
              Ask the Agent to inspect Fairlx work, search, or ship a change.
            </p>
          </div>
        </div>
        <FloatingComposer>
          <AgentCommandInput showQuickActions placeholder="Ask anything, @ to mention, / for actions" />
        </FloatingComposer>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="relative h-full min-h-0 bg-gray-950">
        <div className="h-full flex items-center justify-center text-sm text-zinc-500 pb-32">
          Loading run…
        </div>
        <FloatingComposer>
          <AgentCommandInput
            variant="followup"
            showQuickActions={false}
            disabled
            placeholder="Ask anything, @ to mention, / for actions"
          />
        </FloatingComposer>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="relative h-full min-h-0 bg-gray-950">
        <div className="h-full flex flex-col items-center justify-center gap-3 text-sm text-zinc-500 pb-32">
          <p>{error?.message || "Run not found."}</p>
          <Link href="/agent/dashboard" className="text-blue-400 hover:underline">
            Back to Agent Home
          </Link>
        </div>
        <FloatingComposer>
          <AgentCommandInput showQuickActions={false} placeholder="Ask anything, @ to mention, / for actions" />
        </FloatingComposer>
      </div>
    );
  }

  const running = run.status === "running";
  const pinned = (harness?.chatMeta?.pinnedRunIds ?? []).includes(run.id);
  const workspace = context?.workspaces.find((item) => item.id === run.workspaceId);
  const project = context?.projects.find((item) => item.id === run.projectId);
  const linkedRepo = (context?.githubRepos ?? []).find((item) => item.projectId === project?.id);
  const unread = (context?.notifications ?? []).filter((item) => !item.isRead).length;
  const initials = userInitials(user?.name, user?.email);

  const saveTitle = () => {
    if (title.trim() && title.trim() !== run.title) {
      patchRun.mutate({ param: { runId: run.id }, json: { title: title.trim() } });
    }
    setRenaming(false);
  };

  return (
    <div className="h-full min-h-0 flex overflow-hidden bg-gray-950">
      <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden bg-gray-950">
        <header className="h-14 border-b border-gray-800 flex items-center justify-between px-6 shrink-0 bg-gray-950">
          <div className="flex items-center gap-2 text-sm text-gray-400 min-w-0">
            <Link href="/agent/dashboard" className="hover:text-gray-200 shrink-0">
              {workspace?.name || "Agent"}
            </Link>
            <span className="text-gray-600">/</span>
            <span className="text-gray-200 truncate">{run.title}</span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-gray-700 hover:bg-gray-800 text-gray-300 transition-colors text-xs font-medium"
              onClick={async () => {
                await navigator.clipboard.writeText(window.location.href);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1600);
              }}
            >
              <i className="fa-solid fa-arrow-up-right-from-square" /> {copied ? "Copied" : "Share"}
            </button>
            <button
              type="button"
              className="text-xs text-gray-400 hover:text-gray-200 px-2 py-1"
              onClick={() => {
                const current = harness?.chatMeta?.pinnedRunIds ?? [];
                updateHarness.mutate({
                  json: {
                    chatMeta: {
                      pinnedRunIds: pinned ? current.filter((id) => id !== run.id) : [...current, run.id],
                      archivedRunIds: harness?.chatMeta?.archivedRunIds ?? [],
                    },
                  },
                });
              }}
            >
              <i className={cn("mr-1", pinned ? "fa-solid fa-thumbtack text-blue-400" : "fa-regular fa-bookmark")} />
              {pinned ? "Pinned" : "Pin"}
            </button>
            <button
              type="button"
              className="text-xs text-red-400 hover:text-red-300 px-2 py-1"
              disabled={deleteRun.isPending}
              onClick={() => deleteRun.mutate({ runId: run.id }, { onSuccess: () => router.push("/agent/chats") })}
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setNotesOpen((open) => !open)}
              className="text-gray-400 hover:text-gray-200 relative"
              title="Notifications"
            >
              <i className="fa-regular fa-bell text-lg" />
              {unread > 0 ? (
                <span className="absolute top-0 right-0 w-2 h-2 bg-blue-500 rounded-full border border-gray-950" />
              ) : null}
            </button>
            <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-gray-300 font-medium border border-gray-600">
              {initials[0] || "U"}
            </div>
          </div>
        </header>
        {notesOpen ? (
          <div className="absolute right-8 top-16 z-20 w-80 rounded-xl border border-gray-800 bg-gray-900 shadow-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-white">Notifications</p>
              <button type="button" className="text-xs text-gray-500" onClick={() => setNotesOpen(false)}>
                Close
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto space-y-2 custom-scrollbar">
              {(context?.notifications ?? []).length === 0 ? (
                <p className="text-sm text-gray-500 py-6 text-center">No notifications.</p>
              ) : (
                (context?.notifications ?? []).slice(0, 12).map((item) => (
                  <div key={item.id} className="rounded-lg border border-gray-800 px-3 py-2">
                    <p className="text-sm text-white">{item.title || "Notification"}</p>
                    {item.message ? <p className="text-xs text-gray-500 mt-1">{item.message}</p> : null}
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}

        <div className="relative flex-1 min-h-0">
          <div ref={scrollerRef} className="absolute inset-0 overflow-y-auto custom-scrollbar px-6 py-6 pb-40">
            <div className="max-w-3xl mx-auto flex flex-col gap-8">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  {renaming ? (
                    <input
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      onBlur={saveTitle}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") event.currentTarget.blur();
                      }}
                      className="text-2xl font-semibold text-gray-100 bg-transparent outline-none border-b border-gray-800 w-full"
                      autoFocus
                    />
                  ) : (
                    <>
                      <h1 className="text-2xl font-semibold text-gray-100 truncate">{run.title}</h1>
                      <button type="button" className="text-gray-500 hover:text-gray-300" onClick={() => setRenaming(true)}>
                        <i className="fa-solid fa-pen text-sm" />
                      </button>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <span
                    className={cn(
                      "w-2 h-2 rounded-full",
                      running ? "bg-blue-500" : run.status === "completed" ? "bg-green-500" : "bg-red-400",
                    )}
                  />
                  <span
                    className={cn(
                      "font-medium",
                      running ? "text-blue-400" : run.status === "completed" ? "text-green-500" : "text-red-400",
                    )}
                  >
                    {running ? "Agent is running" : run.status === "completed" ? "Completed" : run.status}
                  </span>
                  <span>•</span>
                  <span>Started {relativeTime(run.createdAt)}</span>
                  {project ? (
                    <>
                      <span>•</span>
                      <span>{project.name}</span>
                    </>
                  ) : null}
                </div>
                {activitySummary(run.events ?? []).parts.length ? (
                  <p className="text-xs text-zinc-500 mt-2">
                    {activitySummary(run.events ?? []).parts.join(" · ")}
                  </p>
                ) : null}
              </div>
              {running ? (
                <button
                  type="button"
                  disabled={stopRun.isPending}
                  onClick={() => stopRun.mutate({ runId: run.id })}
                  className="flex items-center gap-2 px-4 py-2 rounded-md border border-gray-700 hover:bg-gray-800 text-gray-300 transition-colors text-sm font-medium bg-gray-900 shrink-0"
                >
                  <i className="fa-solid fa-stop" /> Stop
                </button>
              ) : run.status === "failed" || run.status === "stopped" ? (
                <button
                  type="button"
                  disabled={continueRun.isPending}
                  onClick={() => continueRun.mutate({ runId: run.id })}
                  className="flex items-center gap-2 px-4 py-2 rounded-md border border-gray-700 hover:bg-gray-800 text-gray-300 transition-colors text-sm font-medium bg-gray-900 shrink-0"
                >
                  Retry
                </button>
              ) : null}
            </div>

            {project && !linkedRepo ? (
              <Link
                href={`/workspaces/${project.workspaceId}/projects/${project.id}/github`}
                className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
              >
                This project has no GitHub access. Sign in and link a repo so the agent can inspect code, plan branches, and record commits.
              </Link>
            ) : null}

            {blocks.map((block, index) => {
              if (block.kind === "user") return <UserBubble key={block.message.id} message={block.message} />;
              if (block.kind === "assistant") return <AgentBubble key={block.message.id} message={block.message} />;
              return (
                <StepsCard
                  key={block.lead?.id ?? `steps-${index}`}
                  lead={block.lead}
                  steps={block.steps}
                  running={running}
                />
              );
            })}

            {run.error ? (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {run.error}
              </div>
            ) : null}
          </div>
          </div>

          <FloatingComposer>
            <AgentCommandInput
              variant="followup"
              showQuickActions={false}
              submitting={sendMessage.isPending}
              placeholder="Ask anything, @ to mention, / for actions"
              onFollowUp={(content) => {
                sendMessage.mutate({ param: { runId: run.id }, json: { content } });
              }}
            />
          </FloatingComposer>
        </div>
      </div>
      <WorkflowSidebar run={run} events={run.events ?? []} tab={tab} onTab={setTab} />
    </div>
  );
}

export function WorkflowView() {
  return (
    <div className="h-full min-h-0">
      <Suspense
        fallback={
          <div className="h-full flex items-center justify-center text-sm text-zinc-500">Loading workflow…</div>
        }
      >
        <WorkflowViewInner />
      </Suspense>
    </div>
  );
}

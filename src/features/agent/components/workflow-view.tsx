"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bot,
  CheckCircle2,
  AlertTriangle,
  FolderKanban,
  Loader2,
  XCircle,
  Pin,
  Trash2,
  RotateCcw,
  Pencil,
  Server,
  GitBranch,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Check,
  Copy,
  ArrowUpRight,
} from "lucide-react";
import { RiAddCircleFill } from "react-icons/ri";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/hooks/use-confirm";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProjectAvatar } from "@/features/projects/components/project-avatar";
import { useCreateProjectModal } from "@/features/projects/hooks/use-create-project-modal";

import { useGetAgentAiConfig } from "../api/use-agent-ai-config";
import { useGetAgentContext } from "../api/use-agent-context";
import { useGetAgentHarness, useUpdateAgentHarness } from "../api/use-agent-harness";
import { useGetAgentMcpConfig } from "../api/use-agent-mcp-config";
import { AGENT_CONTEXT_QUERY_KEY, isInternalMcpServer } from "../constants";
import {
  useConfirmAgentRun,
  useContinueAgentRun,
  useDenyAgentRun,
  useDeleteAgentRun,
  useGetAgentRun,
  usePatchAgentRun,
  useSendAgentMessage,
  useStopAgentRun,
} from "../api/use-agent-runs";
import { selectedModelLabel } from "../lib/client-defaults";
import { clockTime, relativeTime } from "../lib/agent-ui";
import { extractBoardProject, kanbanCtasForBlocks, projectKanbanHref, withWorkspaceFallback } from "../lib/project-launch";
import { groupTranscript, summarizeToolResult, toolLabel, activitySummary, isRepeatedToolResult, workItemListRows, collectWorkItemLookup, workspaceMemberRows, collectMemberLookup, type TranscriptStep } from "../lib/transcript";
import { displayUserContent } from "../lib/session-context";
import { splitAssistantChoices } from "../lib/assistant-choices";
import { isPersistedTruncatedAssistant, sanitizeAssistantVisible } from "../lib/visible-content";
import { findPendingConfirmation } from "../lib/write-guard";
import { findPendingPlugin } from "../plugins/catalog";
import { PluginConnectCard } from "./plugin-connect-card";
import type { AgentChatMessage, AgentRun, AgentToolEvent } from "../types";
import { AgentCommandInput } from "./agent-command-input";
import { AgentWorkItemTable } from "./agent-work-item-table";
import { AgentMemberTable } from "./agent-member-table";
import { useAgentUi } from "./agent-ui-context";
import { PendingConfirmationCard } from "./pending-confirmation-card";
import { ModelPicker } from "./model-picker";
import { splitMarkdownWorkItemTable, type AgentWorkItem } from "../lib/work-item-table";
import { splitMarkdownMemberTable, type AgentMember } from "../lib/member-table";

function ProjectKanbanCta({
  workspaceId,
  projectId,
  name,
}: {
  workspaceId: string;
  projectId: string;
  name?: string;
}) {
  const href = projectKanbanHref({ workspaceId, projectId, name });
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative inline-flex w-full max-w-sm sm:max-w-md items-center gap-3 overflow-hidden rounded-xl border border-border/80 bg-card/90 p-2.5 pr-3 text-left shadow-2xs transition-all duration-200 hover:border-primary/40 hover:bg-card hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* Subtle top shimmer accent on hover */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />

      {/* Icon badge */}
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary transition-all duration-200 group-hover:border-primary/40 group-hover:bg-primary/15 group-hover:scale-105">
        <FolderKanban className="size-4" />
      </div>

      {/* Title & subtitle */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-xs font-semibold text-foreground tracking-tight transition-colors group-hover:text-primary">
            Open Kanban board
          </span>
        </div>
        <p className="truncate text-[11px] text-muted-foreground">
          {name ? (
            <>
              <span className="font-medium text-foreground/80">{name}</span>
              <span className="mx-1 opacity-50">·</span>
            </>
          ) : null}
          <span>View board in new tab</span>
        </p>
      </div>

      {/* Action button */}
      <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border/60 bg-muted/60 px-2 py-1 text-[11px] font-medium text-muted-foreground shadow-2xs transition-all duration-200 group-hover:border-primary/30 group-hover:bg-primary group-hover:text-primary-foreground">
        <span>Open</span>
        <ArrowUpRight className="size-3 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </span>
    </a>
  );
}

function FloatingComposer({ children }: { children: React.ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40">
      <div className="bg-gradient-to-t from-background via-background to-transparent pt-12">
        <div className="pointer-events-auto mx-auto w-full max-w-[760px] px-4 pb-5 bg-background">
          {children}
        </div>
      </div>
    </div>
  );
}

function UserBubble({
  message,
  canEdit,
  onSendEdit,
}: {
  message: AgentChatMessage;
  canEdit?: boolean;
  onSendEdit?: (content: string) => void;
}) {
  const visible = displayUserContent(message.content);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(visible);

  const startEdit = () => {
    setDraft(visible);
    setEditing(true);
  };

  const cancelEdit = () => {
    setDraft(visible);
    setEditing(false);
  };

  const submitEdit = () => {
    const next = draft.trim();
    if (!next || !onSendEdit) return;
    if (next === visible.trim()) {
      setEditing(false);
      return;
    }
    onSendEdit(next);
    setEditing(false);
  };

  return (
    <div className="flex gap-4 justify-end">
      <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 max-w-2xl text-foreground relative group shadow-sm">
        <div className="text-xs text-muted-foreground mb-1 font-medium flex items-center justify-between gap-3">
          <span>
            You <span className="mx-1">•</span> {clockTime(message.createdAt)}
          </span>
          {canEdit && !editing ? (
            <button
              type="button"
              onClick={startEdit}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-foreground transition-opacity"
              title="Edit and send as a new question"
            >
              <Pencil className="size-3" />
              Edit
            </button>
          ) : null}
        </div>
        {editing ? (
          <div className="space-y-2">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  cancelEdit();
                }
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submitEdit();
                }
              }}
              rows={Math.min(8, Math.max(2, draft.split("\n").length))}
              className="w-full resize-none rounded-lg border border-primary/30 bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
              autoFocus
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-md px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitEdit}
                disabled={!draft.trim()}
                className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground disabled:opacity-50"
              >
                Send as new question
              </button>
            </div>
          </div>
        ) : (
          <p className="leading-relaxed whitespace-pre-wrap text-sm">{visible}</p>
        )}
      </div>
    </div>
  );
}

function CodeBlock({
  className,
  children,
  ...props
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || "");
  const codeString = String(children).replace(/\n$/, "");

  const handleCopy = async () => {
    await navigator.clipboard.writeText(codeString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (match) {
    return (
      <div className="relative group my-3 rounded-lg overflow-hidden border border-border bg-[#1e1e1e]">
        <div className="flex items-center justify-between px-3 py-1.5 bg-muted/60 border-b border-border text-[11px] text-muted-foreground font-mono">
          <span>{match[1]}</span>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            {copied ? <Check className="size-3 text-green-500" /> : <Copy className="size-3" />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>
        <SyntaxHighlighter
          style={vscDarkPlus}
          language={match[1]}
          PreTag="div"
          customStyle={{ margin: 0, padding: "12px", fontSize: "12px", background: "transparent" }}
        >
          {codeString}
        </SyntaxHighlighter>
      </div>
    );
  }

  return (
    <code className={cn("bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground", className)} {...props}>
      {children}
    </code>
  );
}

function MarkdownRich({ content }: { content: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none text-foreground leading-relaxed text-sm">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code: CodeBlock,
          p({ children }) {
            return <p className="mb-2.5 last:mb-0 leading-relaxed text-sm text-foreground">{children}</p>;
          },
          strong({ children }) {
            return <strong className="font-semibold text-foreground">{children}</strong>;
          },
          ul({ children }) {
            return <ul className="list-disc pl-5 my-2 space-y-1 text-sm text-foreground">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal pl-5 my-2 space-y-1 text-sm text-foreground">{children}</ol>;
          },
          li({ children }) {
            return <li className="leading-relaxed">{children}</li>;
          },
          h1({ children }) {
            return <h1 className="text-base font-bold my-2 text-foreground">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="text-sm font-bold my-2 text-foreground">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="text-sm font-semibold my-1.5 text-foreground">{children}</h3>;
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-2 border-primary/60 pl-3 italic text-muted-foreground my-2">
                {children}
              </blockquote>
            );
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium"
              >
                {children}
              </a>
            );
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto my-3 rounded-lg border border-border">
                <table className="min-w-full divide-y divide-border text-xs">{children}</table>
              </div>
            );
          },
          th({ children }) {
            return <th className="bg-muted/50 px-3 py-2 text-left font-semibold text-foreground">{children}</th>;
          },
          td({ children }) {
            return <td className="px-3 py-2 border-t border-border">{children}</td>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function MarkdownContent({
  content,
  workItems,
  members,
  workspaceId,
  projectId,
}: {
  content: string;
  workItems?: Map<string, AgentWorkItem>;
  members?: Map<string, AgentMember>;
  workspaceId?: string;
  projectId?: string;
}) {
  const workParsed = splitMarkdownWorkItemTable(content);
  if (workParsed) {
    return (
      <div>
        {workParsed.before ? (
          <MarkdownContent
            content={workParsed.before}
            workItems={workItems}
            members={members}
            workspaceId={workspaceId}
            projectId={projectId}
          />
        ) : null}
        <AgentWorkItemTable
          rows={workParsed.rows}
          lookup={workItems}
          workspaceId={workspaceId}
          projectId={projectId}
        />
        {workParsed.after ? (
          <MarkdownContent
            content={workParsed.after}
            workItems={workItems}
            members={members}
            workspaceId={workspaceId}
            projectId={projectId}
          />
        ) : null}
      </div>
    );
  }

  const memberParsed = splitMarkdownMemberTable(content);
  if (memberParsed) {
    return (
      <div>
        {memberParsed.before ? (
          <MarkdownContent
            content={memberParsed.before}
            workItems={workItems}
            members={members}
            workspaceId={workspaceId}
            projectId={projectId}
          />
        ) : null}
        <AgentMemberTable
          rows={memberParsed.rows}
          lookup={members}
          workspaceId={workspaceId}
        />
        {memberParsed.after ? (
          <MarkdownContent
            content={memberParsed.after}
            workItems={workItems}
            members={members}
            workspaceId={workspaceId}
            projectId={projectId}
          />
        ) : null}
      </div>
    );
  }

  return <MarkdownRich content={content} />;
}

function TruncationNote({ content }: { content?: string | null }) {
  if (!isPersistedTruncatedAssistant(content)) return null;
  return (
    <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
      This answer was cut off while saving. Ask the agent to continue from here.
    </p>
  );
}

function AgentBubble({
  message,
  workItems,
  members,
  workspaceId,
  projectId,
  choicesEnabled = false,
  onPickChoice,
}: {
  message: AgentChatMessage;
  workItems?: Map<string, AgentWorkItem>;
  members?: Map<string, AgentMember>;
  workspaceId?: string;
  projectId?: string;
  choicesEnabled?: boolean;
  onPickChoice?: (choice: string) => void;
}) {
  const visible = sanitizeAssistantVisible(message.content);
  if (!visible) return null;
  const { text, choices } = splitAssistantChoices(visible);
  return (
    <div className="flex gap-3.5">
      <div className="size-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 shadow-sm">
        <Bot className="size-4" />
      </div>
      <div className="flex-1 flex flex-col gap-2 min-w-0">
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <span className="font-semibold text-foreground">fairlx Agent</span>
          <span>•</span>
          <span>{clockTime(message.createdAt)}</span>
        </div>
        <div className="max-w-4xl">
          {text ? (
            <MarkdownContent
              content={text}
              workItems={workItems}
              members={members}
              workspaceId={workspaceId}
              projectId={projectId}
            />
          ) : null}
          {choices.length ? (
            <div className="flex flex-wrap gap-2 mt-3">
              {choices.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  disabled={!choicesEnabled}
                  onClick={() => onPickChoice?.(choice)}
                  className={cn(
                    "inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium transition-colors shadow-sm",
                    choicesEnabled
                      ? "border-violet-200 dark:border-violet-800 bg-violet-50/90 dark:bg-violet-950/50 text-foreground hover:bg-violet-100 dark:hover:bg-violet-900/60"
                      : "border-border bg-muted/40 text-muted-foreground cursor-default",
                  )}
                >
                  {choice}
                </button>
              ))}
            </div>
          ) : null}
          <TruncationNote content={message.content} />
        </div>
      </div>
    </div>
  );
}

function StepRow({
  step,
  index,
  active,
  awaiting,
  workItems,
  members,
  workspaceId,
  projectId,
}: {
  step: TranscriptStep;
  index: number;
  active?: boolean;
  awaiting?: boolean;
  workItems?: Map<string, AgentWorkItem>;
  members?: Map<string, AgentMember>;
  workspaceId?: string;
  projectId?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copiedQuery, setCopiedQuery] = useState(false);
  const [copiedResult, setCopiedResult] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const summary = summarizeToolResult(step.call.name, step.result?.content);
  const listRows = workItemListRows(step.result?.content);
  const memberRows = workspaceMemberRows(step.result?.content);
  const isList = step.call.name === "fairlx_work_item_list" || step.call.name === "list_work_items";
  const isMemberList =
    step.call.name === "fairlx_workspace_members_list" || step.call.name === "list_workspace_members";
  const hasRichTable = (isList && listRows.length > 0) || (isMemberList && memberRows.length > 0);

  // Parse arguments
  let parsedArgs: Record<string, unknown> | null = null;
  if (typeof step.call.arguments === "string" && step.call.arguments.trim()) {
    try {
      parsedArgs = JSON.parse(step.call.arguments);
    } catch {
      // Keep as string
    }
  } else if (step.call.arguments && typeof step.call.arguments === "object") {
    parsedArgs = step.call.arguments as Record<string, unknown>;
  }

  // Parse result
  let parsedResult: unknown = null;
  if (step.result?.content) {
    try {
      parsedResult = JSON.parse(step.result.content);
    } catch {
      parsedResult = step.result.content;
    }
  }

  const effectiveArgs =
    parsedArgs ||
    (step.event?.payload && typeof step.event.payload === "object"
      ? (step.event.payload as Record<string, unknown>).args || step.event.payload
      : null);

  const formattedArgsString = effectiveArgs
    ? JSON.stringify(effectiveArgs, null, 2)
    : step.call.arguments || "";

  const formattedResultString = parsedResult
    ? JSON.stringify(parsedResult, null, 2)
    : step.result?.content || (step.event?.payload ? JSON.stringify(step.event.payload, null, 2) : "");

  const hasDetails = Boolean(formattedArgsString.trim() || formattedResultString.trim());

  // Extract work item metadata if applicable
  const workItemMeta = useMemo(() => {
    if (!effectiveArgs || typeof effectiveArgs !== "object") return null;
    const obj = effectiveArgs as Record<string, unknown>;
    const isWorkItem = /work_item_(create|update)/i.test(step.call.name);
    const title = String(obj.title || obj.name || "").trim();
    if (!isWorkItem && !title) return null;
    const type = typeof obj.type === "string" ? obj.type.toUpperCase() : undefined;
    const priority = typeof obj.priority === "string" ? obj.priority.toUpperCase() : undefined;
    const labels = Array.isArray(obj.labels) ? obj.labels.map(String).filter(Boolean) : [];
    return { title, type, priority, labels };
  }, [effectiveArgs, step.call.name]);

  // Extract a readable summary hint from arguments
  let argHint = "";
  if (effectiveArgs && typeof effectiveArgs === "object") {
    const obj = effectiveArgs as Record<string, unknown>;
    const directQuery =
      obj.title ||
      obj.query ||
      obj.q ||
      obj.search ||
      obj.prompt ||
      obj.task ||
      obj.command ||
      obj.name;
    const isCreateWorkItem = step.call.name === "fairlx_work_item_create";
    const targetId =
      obj.workItemId ||
      obj.key ||
      obj.sprintId ||
      obj.docId ||
      (isCreateWorkItem ? undefined : obj.projectId || obj.workspaceId);
    if (obj.unassigned === true) {
      argHint = "Unassigned";
    } else if (typeof directQuery === "string" && directQuery) {
      argHint = `"${directQuery.slice(0, 45)}${directQuery.length > 45 ? "…" : ""}"`;
    } else if (typeof targetId === "string" && targetId) {
      argHint = `ID: ${targetId}`;
    }
  }

  const handleCopy = (text: string, type: "query" | "result") => {
    navigator.clipboard.writeText(text);
    if (type === "query") {
      setCopiedQuery(true);
      setTimeout(() => setCopiedQuery(false), 1500);
    } else {
      setCopiedResult(true);
      setTimeout(() => setCopiedResult(false), 1500);
    }
  };

  const isCompleted = Boolean(step.result && summary.ok);
  const isFailed = Boolean(step.result && !summary.ok);
  const isAwaiting = awaiting && !step.result;
  const isRunning = active && !step.result;

  return (
    <div
      className={cn(
        "px-4 py-3 flex flex-col transition-colors",
        (isRunning || isAwaiting) &&
          "bg-primary/5 relative before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-primary"
      )}
    >
      <div className="flex items-start gap-3.5 w-full">
        <div className="mt-0.5 size-4 text-center shrink-0">
          {isRunning ? (
            <span className="font-mono text-primary text-xs font-bold">{index + 1}</span>
          ) : isAwaiting ? (
            <span className="font-mono text-amber-600 dark:text-amber-400 text-xs font-bold">{index + 1}</span>
          ) : isCompleted ? (
            <Check className="size-4 text-green-500" />
          ) : isFailed ? (
            <XCircle className="size-4 text-destructive" />
          ) : (
            <span className="font-mono text-muted-foreground text-xs">{index + 1}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("text-xs font-semibold", isRunning ? "text-primary" : "text-foreground")}>
              {toolLabel(step.call.name)}
            </span>
            {workItemMeta?.type ? (
              <span
                className={cn(
                  "text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border tracking-wide",
                  workItemMeta.type === "BUG"
                    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                    : workItemMeta.type === "STORY"
                      ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
                      : workItemMeta.type === "EPIC"
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                        : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                )}
              >
                {workItemMeta.type}
              </span>
            ) : null}
            {workItemMeta?.priority ? (
              <span
                className={cn(
                  "text-[10px] font-medium uppercase px-1.5 py-0.5 rounded border",
                  workItemMeta.priority === "URGENT" || workItemMeta.priority === "HIGH"
                    ? "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20"
                    : "bg-muted text-muted-foreground border-border"
                )}
              >
                {workItemMeta.priority}
              </span>
            ) : null}
            {argHint ? (
              <span className="text-[11px] font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded max-w-[260px] truncate">
                {argHint}
              </span>
            ) : null}
            {hasDetails ? (
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="text-[11px] font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/60 hover:bg-muted transition-colors cursor-pointer"
                title="View parameters and result"
              >
                <span>{expanded ? "Hide details" : "View details"}</span>
                <ChevronRight className={cn("size-3 transition-transform", expanded && "rotate-90")} />
              </button>
            ) : null}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 break-words">
            {isAwaiting
              ? "Needs your approval"
              : sanitizeAssistantVisible(step.event?.title || summary.detail)}
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs shrink-0">
          {isRunning ? (
            <span className="text-primary font-medium flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-primary animate-pulse" />
              In progress
            </span>
          ) : isAwaiting ? (
            <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
              Pending
            </span>
          ) : isCompleted ? (
            <span className="text-green-500 font-medium">Completed</span>
          ) : isFailed ? (
            <span className="text-destructive font-medium">Failed</span>
          ) : (
            <span className="text-muted-foreground font-medium">Queued</span>
          )}
        </div>
      </div>

      {expanded && hasDetails ? (
        <div className="mt-3 ml-7 flex flex-col gap-2.5 p-3 bg-muted/30 border border-border/70 rounded-lg text-xs">
          {formattedArgsString.trim() ? (
            <div>
              <div className="text-[10px] font-semibold text-muted-foreground mb-1 uppercase tracking-wider flex items-center justify-between">
                <span>Parameters</span>
                <button
                  type="button"
                  onClick={() => handleCopy(formattedArgsString, "query")}
                  className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted/80 transition-colors"
                >
                  <Copy className="size-3" />
                  <span>{copiedQuery ? "Copied" : "Copy"}</span>
                </button>
              </div>
              <pre className="p-2.5 bg-background/90 border border-border rounded text-[11px] overflow-x-auto text-foreground whitespace-pre-wrap break-all max-h-56 font-mono">
                {formattedArgsString}
              </pre>
            </div>
          ) : null}

          {formattedResultString.trim() ? (
            <div>
              <div className="text-[10px] font-semibold text-muted-foreground mb-1 uppercase tracking-wider flex items-center justify-between">
                <span>Result</span>
                <div className="flex items-center gap-1">
                  {hasRichTable ? (
                    <button
                      type="button"
                      onClick={() => setShowRaw((value) => !value)}
                      className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted/80 transition-colors"
                    >
                      {showRaw ? "Table" : "Raw"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => handleCopy(formattedResultString, "result")}
                    className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted/80 transition-colors"
                  >
                    <Copy className="size-3" />
                    <span>{copiedResult ? "Copied" : "Copy"}</span>
                  </button>
                </div>
              </div>
              {isList && listRows.length > 0 && !showRaw ? (
                <AgentWorkItemTable
                  rows={listRows}
                  lookup={workItems}
                  workspaceId={workspaceId}
                  projectId={projectId}
                />
              ) : isMemberList && memberRows.length > 0 && !showRaw ? (
                <AgentMemberTable
                  rows={memberRows}
                  lookup={members}
                  workspaceId={workspaceId}
                />
              ) : (
                <pre
                  className={cn(
                    "p-2.5 bg-background/90 border border-border rounded text-[11px] overflow-x-auto whitespace-pre-wrap break-all max-h-56 font-mono",
                    summary.ok ? "text-foreground" : "text-destructive border-destructive/30 bg-destructive/5"
                  )}
                >
                  {formattedResultString}
                </pre>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function StepsCard({
  lead,
  steps,
  running,
  awaiting,
  workItems,
  members,
  workspaceId,
  projectId,
}: {
  lead?: AgentChatMessage;
  steps: TranscriptStep[];
  running: boolean;
  awaiting?: boolean;
  workItems?: Map<string, AgentWorkItem>;
  members?: Map<string, AgentMember>;
  workspaceId?: string;
  projectId?: string;
}) {
  const [open, setOpen] = useState(Boolean(running || awaiting));
  const failed = steps.some((step) => step.result && !summarizeToolResult(step.call.name, step.result?.content).ok);
  const last = steps[steps.length - 1];
  const inProgress = (running || awaiting) && last && !last.result;
  const answering = running && Boolean(last?.result) && !awaiting;
  const leadVisible = sanitizeAssistantVisible(lead?.content ?? "");
  const visibleSteps = steps.filter((step) => !isRepeatedToolResult(step.result?.content));
  const skipped = steps.length - visibleSteps.length;

  useEffect(() => {
    if (running || awaiting) setOpen(true);
  }, [running, awaiting]);

  return (
    <div className="flex gap-3.5">
      <div className="size-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 shadow-sm">
        <Bot className="size-4" />
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-2.5">
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <span className="font-semibold text-foreground">fairlx Agent</span>
            <TruncationNote content={lead?.content} />
          {lead?.createdAt ? (
            <>
              <span>•</span>
              <span>{clockTime(lead.createdAt)}</span>
            </>
          ) : null}
        </div>
        {leadVisible ? (
          <div className="max-w-4xl">
            <MarkdownContent
              content={leadVisible}
              workItems={workItems}
              members={members}
              workspaceId={workspaceId}
              projectId={projectId}
            />
          </div>
        ) : null}
        <div className="bg-card border border-border rounded-xl overflow-hidden max-w-4xl shadow-sm mt-1">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="w-full px-4 py-3 border-b border-border flex items-center justify-between text-left hover:bg-muted/40 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              {inProgress || answering ? (
                <Loader2 className="size-4 animate-spin text-primary" />
              ) : failed ? (
                <AlertTriangle className="size-4 text-destructive" />
              ) : (
                <CheckCircle2 className="size-4 text-green-500" />
              )}
              <span className="font-medium text-foreground text-sm">
                {awaiting
                  ? "Waiting for approval"
                  : inProgress
                    ? "Working…"
                    : answering
                      ? "Answering…"
                      : failed
                        ? "Finished with errors"
                        : "Finished"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>
                {visibleSteps.length} {visibleSteps.length === 1 ? "step" : "steps"}
                {skipped ? ` · ${skipped} skipped` : ""}
              </span>
              {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </div>
          </button>
          {open ? (
            <div className="flex flex-col divide-y divide-border">
              {visibleSteps.map((step, index) => {
                const active = inProgress && index === visibleSteps.length - 1 && !step.result;
                return (
                  <StepRow
                    key={step.call.id || `${step.call.name}-${index}`}
                    step={step}
                    index={index}
                    active={active}
                    awaiting={awaiting}
                    workItems={workItems}
                    members={members}
                    workspaceId={workspaceId}
                    projectId={projectId}
                  />
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ProjectSelectorRow({
  run,
  projects,
  selectedProject,
}: {
  run: AgentRun;
  projects: Array<{ id: string; name: string; workspaceId: string; imageUrl?: string; key?: string; status?: string }>;
  selectedProject?: { id: string; name: string; workspaceId: string; imageUrl?: string };
  workspaceId?: string;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const patchRun = usePatchAgentRun();
  const updateHarness = useUpdateAgentHarness();
  const { open: openCreateProject } = useCreateProjectModal();

  const handleSelect = (projId: string | null) => {
    const nextProject = projects.find((p) => p.id === projId);
    patchRun.mutate({
      param: { runId: run.id },
      json: {
        projectId: projId || "",
        ...(nextProject ? { workspaceId: nextProject.workspaceId } : {}),
      },
    });
    updateHarness.mutate({
      json: {
        settings: {
          defaultProjectId: projId || undefined,
          ...(nextProject ? { defaultWorkspaceId: nextProject.workspaceId } : {}),
        },
      },
    });
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-1.5 px-1">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 text-[11px] tracking-wider uppercase font-semibold text-sidebar-foreground/50 hover:text-sidebar-foreground/70 transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="size-3" />
          ) : (
            <ChevronRight className="size-3" />
          )}
          Projects
        </button>
        <RiAddCircleFill
          onClick={() => openCreateProject()}
          className="size-5 text-sidebar-foreground/70 cursor-pointer hover:opacity-75 transition"
        />
      </div>

      <div
        className={`transition-all duration-300 overflow-hidden ${
          isExpanded ? "max-h-96" : "max-h-0"
        }`}
      >
        <Select
          onValueChange={(val) => handleSelect(val === "none" ? null : val)}
          value={selectedProject?.id || "none"}
        >
          <SelectTrigger className="w-full p-2 font-medium text-xs bg-sidebar-accent/50 border-sidebar-border text-sidebar-foreground/90 h-9">
            <SelectValue placeholder="No project selected." />
          </SelectTrigger>

          <SelectContent className="bg-popover border-border max-h-72">
            <SelectItem value="none">
              <div className="flex items-center gap-3 font-medium">
                <div className="size-6 rounded-md bg-muted flex items-center justify-center text-muted-foreground text-xs font-semibold">
                  —
                </div>
                <span className="truncate text-xs text-muted-foreground">No project selected.</span>
              </div>
            </SelectItem>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                <div className="flex items-center gap-3 font-medium">
                  <ProjectAvatar
                    name={project.name}
                    image={project.imageUrl}
                    className="size-6 text-[10px]"
                  />
                  <span className="truncate text-xs">{project.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
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
  const workspaceId = run.workspaceId || harness?.settings.defaultWorkspaceId || workspace?.id;
  const workspaceProjects = useMemo(
    () => (context?.projects ?? []).filter((item) => !workspaceId || item.workspaceId === workspaceId),
    [context?.projects, workspaceId]
  );
  const launch = useMemo(
    () => withWorkspaceFallback(extractBoardProject(run.messages), run.workspaceId || workspaceId),
    [run.messages, run.workspaceId, workspaceId],
  );
  const effectiveProjectId = run.projectId || launch?.projectId || harness?.settings.defaultProjectId;
  const project = useMemo(() => {
    const fromContext = context?.projects.find((item) => item.id === effectiveProjectId);
    if (fromContext) return fromContext;
    if (launch && launch.projectId === effectiveProjectId) {
      return { id: launch.projectId, name: launch.name || "Project", workspaceId: launch.workspaceId };
    }
    return undefined;
  }, [context?.projects, effectiveProjectId, launch]);
  const projectsForSelect = useMemo(() => {
    const list = [...workspaceProjects];
    if (project && !list.some((item) => item.id === project.id)) {
      list.unshift(project);
    }
    return list;
  }, [workspaceProjects, project]);
  const connected = Object.entries(mcp?.mcpServers ?? {}).filter(
    ([name, server]) => !isInternalMcpServer(name, server) && !server.disabled
  ).length;
  const staging = harness?.gitStaging?.items ?? [];
  const live = events.slice(-12);
  const repo = (context?.githubRepos ?? []).find((item) => item.projectId === project?.id);
  const terminals = events.filter((event) => event.type === "terminal");
  const githubUrl = repo?.githubUrl || (repo?.owner && repo.repositoryName ? `https://github.com/${repo.owner}/${repo.repositoryName}` : "");
  const prLinks = events
    .filter((event) => event.type === "github_open_pr" || event.type === "github_write_file")
    .map((event) => {
      const payload = event.payload && typeof event.payload === "object" ? (event.payload as { html_url?: string; title?: string; path?: string }) : {};
      return {
        id: event.id,
        url: typeof payload.html_url === "string" ? payload.html_url : "",
        label: payload.title || payload.path || event.title,
      };
    })
    .filter((item) => item.url);

  return (
    <aside className="hidden lg:flex w-80 bg-sidebar border-l border-sidebar-border flex-col flex-shrink-0 h-full">
      {/* Tabs Header at top of Right Sidebar */}
      <div className="flex border-b border-sidebar-border bg-sidebar shrink-0">
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
              "flex-1 py-3 text-xs font-semibold transition-colors border-b-2",
              tab === id
                ? "text-primary border-primary bg-sidebar-accent/50"
                : "text-muted-foreground border-transparent hover:text-foreground hover:bg-sidebar-accent/30"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tabs Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-5">
        {tab === "context" ? (
          <>
            <div className="flex flex-col gap-3">
              <ProjectSelectorRow
                run={run}
                projects={projectsForSelect}
                selectedProject={project}
                workspaceId={workspace?.id}
              />
              <div>
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-1">Agent</div>
                <ModelPicker variant="sidebar" />
              </div>
              <button
                type="button"
                onClick={openMcp}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-sidebar-accent cursor-pointer border border-transparent hover:border-sidebar-border group transition-colors w-full text-left"
              >
                <div className="flex items-center gap-2.5">
                  <Server className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="text-foreground text-xs font-medium group-hover:text-primary transition-colors">MCP Servers</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className={cn("font-medium text-[11px]", connected > 0 ? "text-green-500" : "text-muted-foreground")}>
                    {connected} connected
                  </span>
                  <ChevronRight className="size-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              </button>
              {project && !repo ? (
                <Link
                  href={`/workspaces/${project.workspaceId}/projects/${project.id}/github`}
                  className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-300 font-medium"
                >
                  No GitHub repo linked. Link GitHub to attach code and inspect commits.
                </Link>
              ) : null}
            </div>

            <hr className="border-sidebar-border" />

            <div>
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Live Activity</h3>
                {run.status === "running" ? (
                  <div className="flex items-center gap-1.5 text-xs text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full font-medium">
                    <span className="size-1.5 rounded-full bg-green-500 animate-pulse" />
                    Live
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground capitalize font-medium">{run.status}</span>
                )}
              </div>
              {live.length === 0 ? (
                <p className="text-xs text-muted-foreground px-1">No activity yet.</p>
              ) : (
                <div className="relative pl-3 border-l-2 border-sidebar-border flex flex-col gap-3 ml-2">
                  {live.map((event, index) => {
                    const latest = index === live.length - 1 && run.status === "running";
                    const failed = event.type === "error" || /fail/i.test(event.title);
                    return (
                      <div key={event.id} className="relative">
                        <div
                          className={cn(
                            "absolute -left-[18px] top-1.5 size-2 rounded-full",
                            latest
                              ? "bg-primary shadow-[0_0_6px_rgba(59,130,246,0.8)]"
                              : failed
                                ? "bg-destructive"
                                : "bg-muted-foreground/50"
                          )}
                        />
                        <div className="flex items-start text-xs">
                          <span className={cn("w-14 shrink-0 text-[11px]", latest ? "text-primary font-medium" : "text-muted-foreground")}>
                            {clockTime(event.createdAt, true)}
                          </span>
                          <span
                            className={cn(
                              "flex-1 ml-1.5 truncate",
                              latest ? "text-primary font-medium" : failed ? "text-destructive font-medium" : "text-foreground"
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

            <hr className="border-sidebar-border" />

            <div>
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3 px-1">Run Settings</h3>
              <div className="flex flex-col gap-2.5 text-xs bg-sidebar-accent/40 border border-sidebar-border rounded-lg p-3">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Model</span>
                  <span className="text-foreground font-medium truncate">{selectedModelLabel(ai)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mode</span>
                  <span className="text-foreground font-medium capitalize">{run.mode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Steps</span>
                  <span className="text-foreground font-medium">{events.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Started</span>
                  <span className="text-foreground font-medium">{relativeTime(run.createdAt)}</span>
                </div>
              </div>
            </div>
          </>
        ) : null}

        {tab === "changes" ? (
          <div className="space-y-3">
            {prLinks.length ? (
              <div className="space-y-2">
                {prLinks.map((item) => (
                  <a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-3 hover:bg-sidebar-accent transition-colors"
                  >
                    <p className="text-xs font-medium text-primary truncate">{item.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{item.url}</p>
                  </a>
                ))}
              </div>
            ) : null}
            {staging.length === 0 && !prLinks.length ? (
              <p className="text-xs text-muted-foreground px-1">
                {repo
                  ? "No pull requests yet. Accept a GitHub write to open a real PR."
                  : "Link a GitHub repo or connect a PAT to edit code."}
              </p>
            ) : (
              staging.map((item) => (
                <Link
                  key={item.id}
                  href="/agent/git"
                  className="block rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-3 hover:bg-sidebar-accent transition-colors"
                >
                  <p className="text-xs font-medium text-foreground truncate">{item.path}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {item.status}
                    {item.branch ? ` · ${item.branch}` : ""}
                  </p>
                  {item.summary ? <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{item.summary}</p> : null}
                </Link>
              ))
            )}
            {repo ? (
              <a
                href={githubUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium px-1"
              >
                <GitBranch className="size-3.5" /> Open {repo.owner}/{repo.repositoryName} on GitHub
              </a>
            ) : null}
          </div>
        ) : null}

        {tab === "terminal" ? (
          <div className="space-y-2">
            {terminals.length === 0 ? (
              <p className="text-xs text-muted-foreground px-1">
                No recorded commands. The agent logs planned terminal commands here.
              </p>
            ) : (
              terminals.map((event) => (
                <div key={event.id} className="rounded-lg border border-sidebar-border bg-card p-3 font-mono text-[11px] text-foreground">
                  <div className="text-muted-foreground text-[10px] mb-1">{clockTime(event.createdAt, true)}</div>
                  <div className="font-semibold">{event.title}</div>
                  {event.detail ? <div className="text-muted-foreground mt-1 whitespace-pre-wrap">{event.detail}</div> : null}
                </div>
              ))
            )}
          </div>
        ) : null}

        {tab === "preview" ? (
          <div className="space-y-3">
            {githubUrl ? (
              <>
                <p className="text-xs text-muted-foreground px-1">
                  Preview code directly via GitHub repository links.
                </p>
                <a
                  href={githubUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-3 text-xs font-medium text-primary hover:bg-sidebar-accent transition-colors"
                >
                  <span>Open Repository</span>
                  <ExternalLink className="size-3.5" />
                </a>
                {repo?.owner && repo.repositoryName ? (
                  <a
                    href={`https://github.dev/${repo.owner}/${repo.repositoryName}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-3 text-xs font-medium text-foreground hover:bg-sidebar-accent transition-colors"
                  >
                    <span>Open in GitHub.dev</span>
                    <ExternalLink className="size-3.5" />
                  </a>
                ) : null}
              </>
            ) : project ? (
              <Link
                href={`/workspaces/${project.workspaceId}/projects/${project.id}/github`}
                className="block rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-300 font-medium"
              >
                Connect GitHub to preview this project&apos;s code.
              </Link>
            ) : (
              <p className="text-xs text-muted-foreground px-1">Select a project to preview linked code.</p>
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
  const sendMessage = useSendAgentMessage();
  const stopRun = useStopAgentRun();
  const continueRun = useContinueAgentRun();
  const confirmRun = useConfirmAgentRun();
  const denyRun = useDenyAgentRun();
  const deleteRun = useDeleteAgentRun();
  const patchRun = usePatchAgentRun();
  const { data: harness } = useGetAgentHarness();
  const updateHarness = useUpdateAgentHarness();
  const queryClient = useQueryClient();
  const stickToBottomRef = useRef(true);
  const continuedRef = useRef<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState("");
  const [tab, setTab] = useState<"context" | "changes" | "terminal" | "preview">("context");
  const [DeleteDialog, confirmDelete] = useConfirm(
    "Delete Run",
    "Are you sure you want to delete this chat run? This action cannot be undone.",
    "destructive"
  );

  useEffect(() => {
    if (run?.title) setTitle(run.title);
  }, [run?.title]);

  useEffect(() => {
    if (!run) return;
    if (continuedRef.current === run.id) return;
    continuedRef.current = run.id;
    // Recover a refresh mid-turn. Accept/Deny starts its own turn — do not
    // continue when this chat loaded already waiting for approval.
    if (run.status === "running") continueRun.mutate({ runId: run.id });
  }, [run, continueRun]);

  useEffect(() => {
    if (!stickToBottomRef.current) return;
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [run?.messages.length, run?.events.length, run?.status]);

  const blocks = useMemo(
    () => groupTranscript(run?.messages ?? [], run?.events ?? []),
    [run?.messages, run?.events],
  );
  const workItems = useMemo(
    () => collectWorkItemLookup(run?.messages ?? []),
    [run?.messages],
  );
  const members = useMemo(
    () => collectMemberLookup(run?.messages ?? []),
    [run?.messages],
  );
  const boardProject = useMemo(
    () => withWorkspaceFallback(extractBoardProject(run?.messages ?? []), run?.workspaceId),
    [run?.messages, run?.workspaceId],
  );
  const kanbanCtas = useMemo(
    () => kanbanCtasForBlocks(blocks, run?.workspaceId, boardProject),
    [blocks, run?.workspaceId, boardProject],
  );
  const syncedScopeRef = useRef<{ bound?: string; context?: string }>({});

  useEffect(() => {
    if (!run?.id || !boardProject) return;
    const scopeKey = `${run.id}:${boardProject.projectId}:${boardProject.workspaceId}`;
    const known = (context?.projects ?? []).some((item) => item.id === boardProject.projectId);
    if (!known && syncedScopeRef.current.context !== scopeKey) {
      syncedScopeRef.current.context = scopeKey;
      queryClient.invalidateQueries({ queryKey: AGENT_CONTEXT_QUERY_KEY });
    }
    const alreadyBound =
      run.projectId === boardProject.projectId && run.workspaceId === boardProject.workspaceId;
    if (alreadyBound) {
      syncedScopeRef.current.bound = scopeKey;
      return;
    }
    if (syncedScopeRef.current.bound === scopeKey) return;
    syncedScopeRef.current.bound = scopeKey;
    patchRun.mutate({
      param: { runId: run.id },
      json: {
        projectId: boardProject.projectId,
        workspaceId: boardProject.workspaceId,
      },
    });
    updateHarness.mutate({
      json: {
        settings: {
          defaultProjectId: boardProject.projectId,
          defaultWorkspaceId: boardProject.workspaceId,
        },
      },
    });
  }, [
    boardProject,
    context?.projects,
    patchRun,
    queryClient,
    run?.id,
    run?.projectId,
    run?.workspaceId,
    updateHarness,
  ]);

  if (!runId) {
    return (
      <div className="relative h-full min-h-0 overflow-hidden bg-background">
        <div className="absolute inset-0 overflow-y-auto custom-scrollbar px-8 pt-12 pb-56">
          <div className="max-w-3xl mx-auto space-y-3">
            <h1 className="text-3xl font-bold text-foreground">Start an Agent Run</h1>
            <p className="text-sm text-muted-foreground">
              Ask the Agent to inspect Fairlx work, search repositories, plan sprints, or ship code changes.
            </p>
          </div>
        </div>
        <FloatingComposer>
          <AgentCommandInput showQuickActions placeholder="Plan, Build, / for skills, @ for context" />
        </FloatingComposer>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="relative h-full min-h-0 bg-background flex flex-col items-center justify-center text-sm text-muted-foreground pb-32">
        <Loader2 className="size-6 animate-spin text-primary mb-2" />
        <span>Loading workflow…</span>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="relative h-full min-h-0 bg-background flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground pb-32">
        <p>{error?.message || "Run not found."}</p>
        <Link href="/agent/dashboard">
          <Button variant="outline" size="sm">Back to Agent Home</Button>
        </Link>
      </div>
    );
  }

  const running = run.status === "running";
  const awaiting = run.status === "awaiting_confirmation";
  const awaitingPlugin = run.status === "awaiting_plugin";
  const lastBlock = blocks[blocks.length - 1];
  const lastAssistantId = [...blocks].reverse().find((block) => block.kind === "assistant")?.message.id;
  const showThinking = running && !awaiting && !awaitingPlugin && lastBlock?.kind !== "steps";
  const thinkingLabel = !lastBlock || lastBlock.kind === "user" ? "Thinking…" : "Answering…";
  const pending = findPendingConfirmation(run.events ?? []);
  const pendingPlugin = findPendingPlugin(run.events ?? []);
  const pinned = (harness?.chatMeta?.pinnedRunIds ?? []).includes(run.id);
  const effectiveProjectId = run.projectId || harness?.settings.defaultProjectId;
  const project = context?.projects.find((item) => item.id === effectiveProjectId);
  const linkedRepo = (context?.githubRepos ?? []).find((item) => item.projectId === project?.id);

  const saveTitle = () => {
    if (title.trim() && title.trim() !== run.title) {
      patchRun.mutate({ param: { runId: run.id }, json: { title: title.trim() } });
    }
    setRenaming(false);
  };

  return (
    <div className="h-full min-h-0 flex overflow-hidden bg-background">
      <DeleteDialog />
      {/* Center Chat & Stream View */}
      <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden bg-background">
        {/* Top Run Toolbar */}
        <div className="h-14 border-b border-border flex items-center justify-between px-6 shrink-0 bg-card/60 backdrop-blur-sm">
          <div className="flex items-center gap-3 min-w-0">
            {renaming ? (
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                onBlur={saveTitle}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                }}
                className="text-base font-semibold text-foreground bg-transparent outline-none border-b border-primary px-1"
                autoFocus
              />
            ) : (
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="text-base font-semibold text-foreground truncate max-w-[320px]">{run.title}</h2>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground transition-colors p-1"
                  onClick={() => setRenaming(true)}
                  title="Rename"
                >
                  <Pencil className="size-3.5" />
                </button>
              </div>
            )}
            <div className="hidden sm:flex items-center gap-2 text-xs">
              <span
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium text-[11px]",
                  running || awaiting || awaitingPlugin
                    ? "bg-blue-500/10 text-blue-500"
                    : run.status === "completed"
                      ? "bg-green-500/10 text-green-500"
                      : "bg-destructive/10 text-destructive"
                )}
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    running || awaiting || awaitingPlugin ? "bg-blue-500 animate-pulse" : run.status === "completed" ? "bg-green-500" : "bg-destructive"
                  )}
                />
                <span className="capitalize">{running ? "Running" : awaiting ? "Needs approval" : awaitingPlugin ? "Needs plugin" : run.status}</span>
              </span>
              <span className="text-muted-foreground">• Started {relativeTime(run.createdAt)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {run.status === "failed" || run.status === "stopped" ? (
              <Button
                variant="outline"
                size="sm"
                disabled={continueRun.isPending}
                onClick={() => continueRun.mutate({ runId: run.id })}
                className="h-8 text-xs font-medium gap-1.5"
              >
                <RotateCcw className="size-3.5" /> Retry
              </Button>
            ) : null}

            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
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
              title={pinned ? "Unpin" : "Pin"}
            >
              <Pin className={cn("size-4", pinned && "fill-primary text-primary")} />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs font-medium text-muted-foreground hover:text-destructive"
              disabled={deleteRun.isPending}
              onClick={async () => {
                const ok = await confirmDelete();
                if (!ok) return;
                deleteRun.mutate(
                  { runId: run.id },
                  {
                    onSuccess: () => {
                      router.push("/agent/chats");
                    },
                  }
                );
              }}
              title="Delete run"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>

        {/* Messages Stream Scroll Area */}
        <div className="relative flex-1 min-h-0">
          <div
            ref={scrollerRef}
            className="absolute inset-0 overflow-y-auto custom-scrollbar px-6 py-6 pb-8"
            onScroll={(event) => {
              const target = event.currentTarget;
              const gap = target.scrollHeight - target.scrollTop - target.clientHeight;
              stickToBottomRef.current = gap < 80;
            }}
          >
            <div className="max-w-4xl mx-auto flex flex-col gap-6">
              {project && !linkedRepo ? (
                <Link
                  href={`/workspaces/${project.workspaceId}/projects/${project.id}/github`}
                  className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-700 dark:text-amber-300 font-medium"
                >
                  This project has no GitHub access linked. Link a repository so the agent can inspect code, suggest branches, and plan commits.
                </Link>
              ) : null}

              {activitySummary(run.events ?? []).parts.length ? (
                <div className="text-xs text-muted-foreground bg-muted/40 border border-border rounded-lg px-3 py-2">
                  {activitySummary(run.events ?? []).parts.join(" · ")}
                </div>
              ) : null}

              {blocks.map((block, index) => {
                const kanban = kanbanCtas.get(index);
                const cta = kanban ? (
                  <div className="pl-11 max-w-4xl">
                    <ProjectKanbanCta
                      workspaceId={kanban.workspaceId}
                      projectId={kanban.projectId}
                      name={kanban.name}
                    />
                  </div>
                ) : null;
                if (block.kind === "user") {
                  return (
                    <div key={block.message.id} className="flex flex-col gap-3">
                      <UserBubble
                        message={block.message}
                        canEdit={!running && !awaiting && !sendMessage.isPending}
                        onSendEdit={(content) => {
                          stickToBottomRef.current = true;
                          sendMessage.mutate({ param: { runId: run.id }, json: { content } });
                        }}
                      />
                      {cta}
                    </div>
                  );
                }
                if (block.kind === "assistant") {
                  return (
                    <div key={block.message.id} className="flex flex-col gap-3">
                      <AgentBubble
                        message={block.message}
                        workItems={workItems}
                        members={members}
                        workspaceId={run.workspaceId}
                        projectId={run.projectId}
                        choicesEnabled={!running && !awaiting && !awaitingPlugin && block.message.id === lastAssistantId}
                        onPickChoice={(choice) => {
                          stickToBottomRef.current = true;
                          sendMessage.mutate({ param: { runId: run.id }, json: { content: choice } });
                        }}
                      />
                      {cta}
                    </div>
                  );
                }
                return (
                  <div key={block.lead?.id ?? `steps-${index}`} className="flex flex-col gap-3">
                    <StepsCard
                      lead={block.lead}
                      steps={block.steps}
                      running={running}
                      awaiting={awaiting}
                      workItems={workItems}
                      members={members}
                      workspaceId={run.workspaceId}
                      projectId={run.projectId}
                    />
                    {cta}
                  </div>
                );
              })}

              {showThinking ? (
                <div className="flex gap-3.5">
                  <div className="size-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 shadow-sm">
                    <Bot className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0 flex items-center gap-2 text-sm text-muted-foreground pt-1.5">
                    <Loader2 className="size-4 animate-spin text-primary" />
                    <span>{thinkingLabel}</span>
                  </div>
                </div>
              ) : null}

              {awaitingPlugin && pendingPlugin ? (
                <PluginConnectCard pending={pendingPlugin} runId={run.id} />
              ) : null}

              {awaiting && pending ? (
                <PendingConfirmationCard
                  pending={pending}
                  workspaceId={run.workspaceId}
                  projectId={run.projectId}
                  onAccept={() => confirmRun.mutate({ runId: run.id })}
                  onDeny={() => denyRun.mutate({ runId: run.id })}
                  isAccepting={confirmRun.isPending}
                  isDenying={denyRun.isPending}
                />
              ) : null}

              {run.error ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive font-medium">
                  {run.error}
                </div>
              ) : null}

              <div aria-hidden className="h-56 shrink-0" />
            </div>
          </div>

          <FloatingComposer>
            <AgentCommandInput
              run={run}
              variant="followup"
              showQuickActions={!awaiting && !awaitingPlugin && !running}
              submitting={sendMessage.isPending || awaiting || awaitingPlugin || running}
              placeholder={
                awaiting
                  ? "Accept or deny the pending action first"
                  : awaitingPlugin
                    ? "Connect a plugin to continue"
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
          </FloatingComposer>
        </div>
      </div>

      {/* Right Sidebar: Context, Changes, Terminal, Preview (Positioned below navbar on the right side) */}
      <WorkflowSidebar run={run} events={run.events ?? []} tab={tab} onTab={setTab} />
    </div>
  );
}

export function WorkflowView() {
  return (
    <div className="h-full min-h-0">
      <Suspense
        fallback={
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Loading workflow…</div>
        }
      >
        <WorkflowViewInner />
      </Suspense>
    </div>
  );
}

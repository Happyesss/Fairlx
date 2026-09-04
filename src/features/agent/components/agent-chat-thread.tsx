"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  FolderKanban,
  Loader2,
  Pencil,
  XCircle,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

import { cn } from "@/lib/utils";

import { useGetAgentContext } from "../api/use-agent-context";
import { useGetAgentHarness } from "../api/use-agent-harness";
import { clockTime } from "../lib/agent-ui";
import { splitAssistantChoices } from "../lib/assistant-choices";
import { splitMarkdownMemberTable, type AgentMember } from "../lib/member-table";
import {
  extractBoardProject,
  kanbanCtasForBlocks,
  projectKanbanHref,
  withWorkspaceFallback,
} from "../lib/project-launch";
import { displayUserContent } from "../lib/session-context";
import {
  activitySummary,
  collectMemberLookup,
  collectWorkItemLookup,
  groupTranscript,
  isRepeatedToolResult,
  summarizeToolResult,
  toolLabel,
  workItemListRows,
  workspaceMemberRows,
  type TranscriptStep,
} from "../lib/transcript";
import { isPersistedTruncatedAssistant, sanitizeAssistantVisible } from "../lib/visible-content";
import { splitMarkdownWorkItemTable, type AgentWorkItem } from "../lib/work-item-table";
import { findPendingConfirmation } from "../lib/write-guard";
import type { AgentChatMessage, AgentRun } from "../types";
import { AgentMemberTable } from "./agent-member-table";
import { AgentWorkItemTable } from "./agent-work-item-table";
import { PendingConfirmationCard } from "./pending-confirmation-card";

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
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary transition-all duration-200 group-hover:border-primary/40 group-hover:bg-primary/15 group-hover:scale-105">
        <FolderKanban className="size-4" />
      </div>
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
      <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border/60 bg-muted/60 px-2 py-1 text-[11px] font-medium text-muted-foreground shadow-2xs transition-all duration-200 group-hover:border-primary/30 group-hover:bg-primary group-hover:text-primary-foreground">
        <span>Open</span>
        <ArrowUpRight className="size-3 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </span>
    </a>
  );
}

function UserBubble({
  message,
  canEdit,
  onSendEdit,
  compact,
}: {
  message: AgentChatMessage;
  canEdit?: boolean;
  onSendEdit?: (content: string) => void;
  compact?: boolean;
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
      <div
        className={cn(
          "bg-primary/10 border border-primary/20 rounded-2xl max-w-2xl text-foreground relative group shadow-sm",
          compact ? "p-3" : "p-4",
        )}
      >
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
  children?: ReactNode;
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

function AgentAvatar({ compact }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 shadow-sm",
        compact ? "size-7" : "size-8",
      )}
    >
      <Bot className="size-4" />
    </div>
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
  compact,
}: {
  message: AgentChatMessage;
  workItems?: Map<string, AgentWorkItem>;
  members?: Map<string, AgentMember>;
  workspaceId?: string;
  projectId?: string;
  choicesEnabled?: boolean;
  onPickChoice?: (choice: string) => void;
  compact?: boolean;
}) {
  const visible = sanitizeAssistantVisible(message.content);
  if (!visible) return null;
  const { text, choices } = splitAssistantChoices(visible);
  return (
    <div className="flex gap-3.5">
      <AgentAvatar compact={compact} />
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
  compact,
}: {
  lead?: AgentChatMessage;
  steps: TranscriptStep[];
  running: boolean;
  awaiting?: boolean;
  workItems?: Map<string, AgentWorkItem>;
  members?: Map<string, AgentMember>;
  workspaceId?: string;
  projectId?: string;
  compact?: boolean;
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
      <AgentAvatar compact={compact} />
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

export function AgentChatThread({
  run,
  compact,
  sending,
  isAccepting,
  isDenying,
  onSendEdit,
  onPickChoice,
  onConfirm,
  onDeny,
}: {
  run: AgentRun;
  compact?: boolean;
  sending?: boolean;
  isAccepting?: boolean;
  isDenying?: boolean;
  onSendEdit: (content: string) => void;
  onPickChoice: (choice: string) => void;
  onConfirm: () => void;
  onDeny: () => void;
}) {
  const { data: context } = useGetAgentContext();
  const { data: harness } = useGetAgentHarness();
  const messages = useMemo(() => run.messages ?? [], [run.messages]);
  const events = useMemo(() => run.events ?? [], [run.events]);
  const running = run.status === "running";
  const awaiting = run.status === "awaiting_confirmation";
  const blocks = useMemo(() => groupTranscript(messages, events), [messages, events]);
  const workItems = useMemo(() => collectWorkItemLookup(messages), [messages]);
  const members = useMemo(() => collectMemberLookup(messages), [messages]);
  const boardProject = useMemo(
    () => withWorkspaceFallback(extractBoardProject(messages), run.workspaceId),
    [messages, run.workspaceId],
  );
  const kanbanCtas = useMemo(
    () => kanbanCtasForBlocks(blocks, run.workspaceId, boardProject),
    [blocks, run.workspaceId, boardProject],
  );
  const lastBlock = blocks[blocks.length - 1];
  const lastAssistantId = [...blocks].reverse().find((block) => block.kind === "assistant")?.message.id;
  const showThinking = running && !awaiting && lastBlock?.kind !== "steps";
  const thinkingLabel = !lastBlock || lastBlock.kind === "user" ? "Thinking…" : "Answering…";
  const pending = findPendingConfirmation(events);
  const effectiveProjectId = run.projectId || harness?.settings.defaultProjectId;
  const project = context?.projects.find((item) => item.id === effectiveProjectId);
  const linkedRepo = (context?.githubRepos ?? []).find((item) => item.projectId === project?.id);
  const summary = activitySummary(events);

  return (
    <div className={cn("max-w-4xl mx-auto flex flex-col", compact ? "gap-4" : "gap-6")}>
      {project && !linkedRepo ? (
        <Link
          href={`/workspaces/${project.workspaceId}/projects/${project.id}/github`}
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-700 dark:text-amber-300 font-medium"
        >
          This project has no GitHub access linked. Link a repository so the agent can inspect code, suggest branches, and plan commits.
        </Link>
      ) : null}

      {summary.parts.length ? (
        <div className="text-xs text-muted-foreground bg-muted/40 border border-border rounded-lg px-3 py-2">
          {summary.parts.join(" · ")}
        </div>
      ) : null}

      {blocks.map((block, index) => {
        const kanban = kanbanCtas.get(index);
        const cta = kanban ? (
          <div className={cn("max-w-4xl", compact ? "pl-9" : "pl-11")}>
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
                canEdit={!running && !awaiting && !sending}
                onSendEdit={onSendEdit}
                compact={compact}
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
                choicesEnabled={!running && !awaiting && block.message.id === lastAssistantId}
                onPickChoice={onPickChoice}
                compact={compact}
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
              compact={compact}
            />
            {cta}
          </div>
        );
      })}

      {showThinking ? (
        <div className="flex gap-3.5">
          <AgentAvatar compact={compact} />
          <div className="flex-1 min-w-0 flex items-center gap-2 text-sm text-muted-foreground pt-1.5">
            <Loader2 className="size-4 animate-spin text-primary" />
            <span>{thinkingLabel}</span>
          </div>
        </div>
      ) : null}

      {awaiting && pending ? (
        <PendingConfirmationCard
          pending={pending}
          workspaceId={run.workspaceId}
          projectId={run.projectId}
          onAccept={onConfirm}
          onDeny={onDeny}
          isAccepting={Boolean(isAccepting)}
          isDenying={Boolean(isDenying)}
        />
      ) : null}

      {run.error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive font-medium">
          {run.error}
        </div>
      ) : null}

      <div aria-hidden className={cn("shrink-0", compact ? "h-2" : "h-56")} />
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Lightbulb,
  Bug,
  Code,
  FlaskConical,
  FileText,
  ArrowUp,
  Loader2,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { useGetAgentContext } from "../api/use-agent-context";
import { useGetAgentHarness } from "../api/use-agent-harness";
import { useCreateAgentRun } from "../api/use-agent-runs";
import { chipKey, composeUserPrompt } from "../lib/session-context";
import type { AgentContextChip } from "../types";
import { AgentPlusMenu, ContextChips } from "./agent-plus-menu";
import { AgentScopeBar } from "./agent-scope-bar";
import { ModelPicker } from "./model-picker";

const QUICK_ACTIONS = [
  {
    icon: Lightbulb,
    label: "Plan new feature",
    prompt: "Plan a new feature for the current Fairlx workspace.",
  },
  {
    icon: Bug,
    label: "Fix a bug",
    prompt: "Help me investigate and fix a bug in the current Fairlx project.",
  },
  {
    icon: Code,
    label: "Refactor code",
    prompt: "Propose a focused refactor for the current Fairlx project.",
  },
  {
    icon: FlaskConical,
    label: "Write tests",
    prompt: "Write tests for the current Fairlx work.",
  },
  {
    icon: FileText,
    label: "Add docs",
    prompt: "Draft documentation for the current Fairlx work.",
  },
] as const;

function autosize(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${Math.min(Math.max(el.scrollHeight, 44), 160)}px`;
}

export function AgentCommandInput({
  showQuickActions = true,
  placeholder = "Ask anything, @ to mention, / for actions",
  variant = "create",
  disabled = false,
  submitting = false,
  onFollowUp,
}: {
  showQuickActions?: boolean;
  placeholder?: string;
  variant?: "create" | "followup";
  disabled?: boolean;
  submitting?: boolean;
  onFollowUp?: (content: string) => void;
}) {
  const router = useRouter();
  const { data: harness } = useGetAgentHarness();
  const { data: context } = useGetAgentContext();
  const createRun = useCreateAgentRun();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [prompt, setPrompt] = useState("");
  const [chips, setChips] = useState<AgentContextChip[]>([]);

  const busy = submitting || createRun.isPending;
  const canSend = Boolean(prompt.trim()) && !busy && !disabled;
  const sessionMode = harness?.settings.sessionMode || "agent";

  const submit = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || busy || disabled) return;
    const content = composeUserPrompt(trimmed, chips, sessionMode);
    if (variant === "followup") {
      onFollowUp?.(content);
      setPrompt("");
      setChips([]);
      if (textareaRef.current) textareaRef.current.style.height = "44px";
      return;
    }
    createRun.mutate(
      {
        json: {
          prompt: content,
          workspaceId: harness?.settings.defaultWorkspaceId || context?.workspaces[0]?.id,
          projectId: harness?.settings.defaultProjectId,
        },
      },
      {
        onSuccess: (result) => {
          setPrompt("");
          setChips([]);
          if (textareaRef.current) textareaRef.current.style.height = "44px";
          router.push(`/agent/workflow?runId=${result.data.id}`);
        },
      },
    );
  };

  return (
    <div className={cn(showQuickActions && variant === "create" ? "space-y-3" : "w-full")}>
      <AgentScopeBar />
      <form
        className="rounded-[22px] border border-border bg-card shadow-lg flex flex-col transition-all focus-within:ring-1 focus-within:ring-primary/40 focus-within:border-primary/50"
        onSubmit={(event) => {
          event.preventDefault();
          submit(prompt);
        }}
      >
        <ContextChips
          chips={chips}
          onRemove={(chip) => setChips((current) => current.filter((item) => chipKey(item) !== chipKey(chip)))}
        />
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(event) => {
            setPrompt(event.target.value);
            autosize(event.currentTarget);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit(prompt);
            }
          }}
          placeholder={placeholder}
          rows={1}
          disabled={busy}
          className="w-full bg-transparent text-[14px] sm:text-[15px] text-foreground leading-6 px-4 pt-3.5 pb-1.5 resize-none focus:outline-none placeholder:text-muted-foreground min-h-[44px] max-h-40"
        />
        <div className="flex items-center gap-1.5 px-3 pb-2.5 pt-1">
          <AgentPlusMenu
            chips={chips}
            onAdd={(chip) => setChips((current) => [...current.filter((item) => chipKey(item) !== chipKey(chip)), chip])}
          />
          <ModelPicker variant="chip" />
          {sessionMode !== "agent" ? (
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground px-1 font-semibold">{sessionMode}</span>
          ) : null}
          <div className="ml-auto flex items-center gap-1">
            <button
              type="submit"
              disabled={!canSend}
              className={cn(
                "size-7 rounded-full flex items-center justify-center transition-colors shadow-sm",
                canSend
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground cursor-default",
              )}
              title="Send"
            >
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ArrowUp className="size-3.5" />
              )}
            </button>
          </div>
        </div>
      </form>
      {showQuickActions && variant === "create" ? (
        <div className="flex flex-wrap gap-2 px-1">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                type="button"
                disabled={busy}
                onClick={() => submit(action.prompt)}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card hover:bg-muted/70 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors shadow-sm font-medium"
              >
                <Icon className="size-3.5 text-primary" />
                <span>{action.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

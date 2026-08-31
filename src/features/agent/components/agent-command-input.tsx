"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

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
    icon: "fa-solid fa-lightbulb",
    label: "Plan new feature",
    prompt: "Plan a new feature for the current Fairlx workspace.",
  },
  {
    icon: "fa-solid fa-bug",
    label: "Fix a bug",
    prompt: "Help me investigate and fix a bug in the current Fairlx project.",
  },
  {
    icon: "fa-solid fa-code",
    label: "Refactor code",
    prompt: "Propose a focused refactor for the current Fairlx project.",
  },
  {
    icon: "fa-solid fa-vial",
    label: "Write tests",
    prompt: "Write tests for the current Fairlx work.",
  },
  {
    icon: "fa-regular fa-file-lines",
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
        className="rounded-[22px] border border-white/10 bg-[#1a1b1e] shadow-[0_12px_40px_rgba(0,0,0,0.55)] flex flex-col"
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
          className="w-full bg-transparent text-[15px] text-zinc-100 leading-6 px-4 pt-3.5 pb-1.5 resize-none focus:outline-none placeholder:text-zinc-500 min-h-[44px] max-h-40"
        />
        <div className="flex items-center gap-1 px-2 pb-2 pt-1">
          <AgentPlusMenu
            chips={chips}
            onAdd={(chip) => setChips((current) => [...current.filter((item) => chipKey(item) !== chipKey(chip)), chip])}
          />
          <ModelPicker variant="chip" />
          {sessionMode !== "agent" ? (
            <span className="text-[10px] uppercase tracking-wide text-zinc-500 px-1">{sessionMode}</span>
          ) : null}
          <div className="ml-auto flex items-center gap-0.5">
            <button
              type="submit"
              disabled={!canSend}
              className={cn(
                "h-7 w-7 rounded-full flex items-center justify-center transition-colors",
                canSend
                  ? "bg-white text-zinc-900 hover:bg-zinc-200"
                  : "bg-zinc-700/80 text-zinc-400 cursor-default",
              )}
              title="Send"
            >
              {busy ? (
                <i className="fa-solid fa-circle-notch fa-spin text-[10px]" />
              ) : (
                <i className="fa-solid fa-arrow-up text-[11px]" />
              )}
            </button>
          </div>
        </div>
      </form>
      {showQuickActions && variant === "create" ? (
        <div className="flex flex-wrap gap-2 px-1">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              type="button"
              disabled={busy}
              onClick={() => submit(action.prompt)}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]"
            >
              <i className={action.icon} />
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

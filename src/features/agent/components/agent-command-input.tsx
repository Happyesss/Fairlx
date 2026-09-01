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
  Mic,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { useGetAgentContext } from "../api/use-agent-context";
import { useGetAgentHarness } from "../api/use-agent-harness";
import { useCreateAgentRun } from "../api/use-agent-runs";
import { chipKey, composeUserPrompt } from "../lib/session-context";
import type { AgentContextChip, AgentRun, AgentSessionMode } from "../types";
import { AgentPlusMenu, ContextChips } from "./agent-plus-menu";
import { AgentScopeBar } from "./agent-scope-bar";
import { AgentModeSelector } from "./agent-mode-selector";
import { ModelPicker } from "./model-picker";

const QUICK_ACTIONS = [
  {
    icon: Lightbulb,
    label: "Plan new feature",
    prompt:
      "Propose one new feature for this Fairlx project. Glance at open work items only to avoid duplicates, then return: feature name, why it matters, user stories, work items to create (type, title, acceptance criteria), and sprint fit. Do not list members or recap project settings.",
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
  el.style.height = `${Math.min(Math.max(el.scrollHeight, 56), 180)}px`;
}

export function AgentCommandInput({
  run,
  showQuickActions = true,
  placeholder = "Plan, Build, / for skills, @ for context",
  variant = "create",
  disabled = false,
  submitting = false,
  onFollowUp,
}: {
  run?: AgentRun;
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
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  const busy = submitting || createRun.isPending;
  const canSend = Boolean(prompt.trim()) && !busy && !disabled;
  const sessionMode = (harness?.settings.sessionMode as AgentSessionMode) || "agent";

  const toggleVoiceInput = () => {
    if (typeof window === "undefined") return;

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    const windowWithSpeech = window as unknown as {
      SpeechRecognition?: new () => {
        continuous: boolean;
        interimResults: boolean;
        lang: string;
        onstart: () => void;
        onend: () => void;
        onerror: () => void;
        onresult: (event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void;
        start: () => void;
        stop: () => void;
      };
      webkitSpeechRecognition?: new () => {
        continuous: boolean;
        interimResults: boolean;
        lang: string;
        onstart: () => void;
        onend: () => void;
        onerror: () => void;
        onresult: (event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void;
        start: () => void;
        stop: () => void;
      };
    };

    const SpeechRecognition =
      windowWithSpeech.SpeechRecognition || windowWithSpeech.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);

      recognition.onresult = (event) => {
        let transcript = "";
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) {
          setPrompt((prev) => (prev ? `${prev} ${transcript}` : transcript));
          if (textareaRef.current) {
            autosize(textareaRef.current);
          }
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  const submit = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || busy || disabled) return;
    const content = composeUserPrompt(trimmed, chips, sessionMode);
    if (variant === "followup") {
      onFollowUp?.(content);
      setPrompt("");
      setChips([]);
      if (textareaRef.current) textareaRef.current.style.height = "56px";
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
          if (textareaRef.current) textareaRef.current.style.height = "56px";
          router.push(`/agent/workflow?runId=${result.data.id}`);
        },
      },
    );
  };

  return (
    <div className={cn(showQuickActions && variant === "create" ? "space-y-3" : "w-full")}>
      <AgentScopeBar run={run} />
      <form
        className="rounded-2xl border border-border/80 bg-card/70 dark:bg-zinc-900/70 backdrop-blur-sm shadow-xs flex flex-col transition-all focus-within:ring-1 focus-within:ring-border focus-within:border-foreground/30"
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
          className="w-full bg-transparent text-[14px] sm:text-[15px] text-foreground leading-relaxed px-4 pt-3.5 pb-2 resize-none focus:outline-none placeholder:text-muted-foreground/60 min-h-[58px] max-h-44 custom-scrollbar"
        />
        <div className="flex items-center justify-between px-3 pb-2.5 pt-0.5 select-none">
          <div className="flex items-center gap-2">
            <AgentModeSelector />
            <ModelPicker variant="subtle" />
          </div>

          <div className="flex items-center gap-1.5">
            <AgentPlusMenu
              chips={chips}
              onAdd={(chip) =>
                setChips((current) => [...current.filter((item) => chipKey(item) !== chipKey(chip)), chip])
              }
              triggerVariant="paperclip"
              align="end"
            />
            <button
              type="button"
              onClick={toggleVoiceInput}
              disabled={busy}
              className={cn(
                "size-7 rounded-full flex items-center justify-center transition-all cursor-pointer",
                isListening
                  ? "bg-red-500 text-white animate-pulse"
                  : "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900 hover:opacity-90 shadow-2xs"
              )}
              title={isListening ? "Listening... click to stop" : "Voice input"}
            >
              <Mic className="size-3.5" />
            </button>
            {canSend || busy ? (
              <button
                type="submit"
                disabled={!canSend}
                className={cn(
                  "size-7 rounded-full flex items-center justify-center transition-colors shadow-2xs cursor-pointer",
                  canSend
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted text-muted-foreground cursor-default"
                )}
                title="Send"
              >
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : <ArrowUp className="size-3.5" />}
              </button>
            ) : null}
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

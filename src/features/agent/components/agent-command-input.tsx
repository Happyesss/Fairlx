"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUp,
  Loader2,
  Mic,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { useGetAgentContext } from "../api/use-agent-context";
import { useGetAgentHarness } from "../api/use-agent-harness";
import { useGetPersonalAgent } from "../api/use-personal-agent";
import { useCreateAgentRun, useStopAgentRun } from "../api/use-agent-runs";
import { chipKey, composeUserPrompt, isPersonalSessionMode } from "../lib/session-context";
import { profileIsTrained } from "../lib/personal-agent-status";
import { countWorkspaceProjects, getQuickActions } from "../lib/quick-actions";
import type { AgentContextChip, AgentRun, AgentSessionMode } from "../types";
import { AgentPlusMenu, ContextChips } from "./agent-plus-menu";
import { AgentScopeBar } from "./agent-scope-bar";
import { AgentModeSelector } from "./agent-mode-selector";
import { AgentPermissionPicker } from "./agent-permission-picker";
import { ModelPicker } from "./model-picker";
import { PersonalAgentSetup } from "./personal-agent-setup";

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
  onStop,
  isStopping = false,
}: {
  run?: AgentRun;
  showQuickActions?: boolean;
  placeholder?: string;
  variant?: "create" | "followup";
  disabled?: boolean;
  submitting?: boolean;
  onFollowUp?: (content: string) => void;
  onStop?: () => void;
  isStopping?: boolean;
}) {
  const router = useRouter();
  const { data: harness } = useGetAgentHarness();
  const { data: context } = useGetAgentContext();
  const { data: personal } = useGetPersonalAgent();
  const createRun = useCreateAgentRun();
  const stopRunMutation = useStopAgentRun();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [prompt, setPrompt] = useState("");
  const [chips, setChips] = useState<AgentContextChip[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  const isRunning = run?.status === "running";
  const stopping = isStopping || stopRunMutation.isPending;
  const showStop = isRunning || run?.status === "awaiting_confirmation" || stopping;
  const busy = submitting || createRun.isPending;
  const canSend = Boolean(prompt.trim()) && !busy && !disabled;
  const sessionMode = (harness?.settings.sessionMode as AgentSessionMode) || "agent";
  const personalUntrained =
    isPersonalSessionMode(sessionMode) &&
    !profileIsTrained(personal?.profile) &&
    run?.kind !== "training";
  const inputPlaceholder = run?.kind === "training"
    ? "Type your own answer, or tap a choice above"
    : isPersonalSessionMode(sessionMode)
      ? "Command your Personal Agent — plan, build, test, review"
      : placeholder;

  const workspaces = useMemo(() => context?.workspaces ?? [], [context?.workspaces]);
  const activeWorkspaceId =
    selectedWorkspaceId ||
    run?.workspaceId ||
    harness?.settings.defaultWorkspaceId ||
    workspaces[0]?.id;

  const projectCount = useMemo(
    () => countWorkspaceProjects(context?.projects, activeWorkspaceId),
    [context?.projects, activeWorkspaceId]
  );
  const hasProjects = context ? projectCount > 0 : true;

  const quickActions = useMemo(
    () => getQuickActions(hasProjects),
    [hasProjects]
  );

  const handleStop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (stopping) return;
    if (onStop) {
      onStop();
    } else if (run?.id) {
      stopRunMutation.mutate({ runId: run.id });
    }
  };

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
    if (!trimmed || busy || disabled || personalUntrained) return;
    const content = composeUserPrompt(trimmed, chips, sessionMode);
    if (variant === "followup") {
      onFollowUp?.(content);
      setPrompt("");
      setChips([]);
      if (textareaRef.current) textareaRef.current.style.height = "56px";
      return;
    }
    const targetWorkspaceId =
      activeWorkspaceId || harness?.settings.defaultWorkspaceId || context?.workspaces[0]?.id;
    const targetProjectId = hasProjects ? harness?.settings.defaultProjectId : undefined;

    createRun.mutate(
      {
        json: {
          prompt: content,
          workspaceId: targetWorkspaceId,
          projectId: targetProjectId,
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
      <AgentScopeBar
        run={run}
        onScopeChange={(wsId) => setSelectedWorkspaceId(wsId)}
      />
      <form
        className="rounded-2xl border border-border/80 bg-card/70 dark:bg-zinc-900/70 backdrop-blur-sm shadow-xs flex flex-col transition-all focus-within:ring-1 focus-within:ring-border focus-within:border-foreground/30"
        onSubmit={(event) => {
          event.preventDefault();
          if (!personalUntrained) submit(prompt);
        }}
      >
        {personalUntrained ? (
          <div className="px-4 pt-4 pb-3">
            <PersonalAgentSetup compact />
          </div>
        ) : (
          <ContextChips
            chips={chips}
            onRemove={(chip) => setChips((current) => current.filter((item) => chipKey(item) !== chipKey(chip)))}
          />
        )}
        {personalUntrained ? null : (
          <>
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
              placeholder={inputPlaceholder}
              rows={1}
              disabled={busy}
              className="w-full bg-transparent text-[14px] sm:text-[15px] text-foreground leading-relaxed px-4 pt-3.5 pb-2 resize-none focus:outline-none placeholder:text-muted-foreground/60 min-h-[58px] max-h-44 custom-scrollbar"
            />
            <div className="flex items-center justify-between px-3 pb-2.5 pt-0.5 select-none">
              <div className="flex items-center gap-2">
                <AgentModeSelector />
                <AgentPermissionPicker />
                <ModelPicker variant="subtle" runModelId={run?.modelId} />
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
                {showStop ? (
                  <button
                    type="button"
                    onClick={handleStop}
                    disabled={stopping}
                    className={cn(
                      "relative size-8 rounded-full flex items-center justify-center transition-all shadow-2xs group cursor-pointer",
                      "bg-destructive text-destructive-foreground hover:bg-destructive/90 border border-destructive",
                      stopping && "opacity-60 cursor-not-allowed"
                    )}
                    title={stopping ? "Stopping..." : "Stop all agents"}
                  >
                    <svg
                      className="absolute inset-0 size-full animate-spin text-destructive-foreground/70"
                      viewBox="0 0 28 28"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="14"
                        cy="14"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                      <circle
                        className="opacity-85"
                        cx="14"
                        cy="14"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeDasharray="62.83"
                        strokeDashoffset="44"
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="relative z-10 size-2.5 rounded-[1.5px] bg-destructive-foreground transition-transform group-hover:scale-90" />
                  </button>
                ) : canSend || busy ? (
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
          </>
        )}
        {personalUntrained ? (
          <div className="flex items-center px-3 pb-2.5">
            <AgentModeSelector />
          </div>
        ) : null}
      </form>
      {showQuickActions && !personalUntrained ? (
        <div className="flex flex-wrap gap-2 px-1">
          {quickActions.map((action) => {
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

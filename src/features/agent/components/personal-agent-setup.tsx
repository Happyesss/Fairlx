"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Eye, Loader2, MessagesSquare, Sparkles, Wand2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import {
  useGetPersonalAgent,
  useSelfTrainPersonalAgent,
  useStartPersonalTraining,
} from "../api/use-personal-agent";
import { profileIsTrained } from "../lib/personal-agent-status";

function WhatIsPersonalAgent() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="size-8 rounded-full border border-border/80 bg-background/80 text-muted-foreground hover:text-foreground hover:border-foreground/20 hover:bg-muted/70 transition-colors flex items-center justify-center shrink-0"
          aria-label="What is a Personal Agent?"
        >
          <Eye className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-4">
        <p className="text-xs font-semibold tracking-tight text-foreground">What is a Personal Agent?</p>
        <p className="text-xs text-muted-foreground leading-relaxed mt-2">
          A trained Chief of Staff inside Fairlx. It learns your role, priorities, and quality bar, then briefs you and
          acts the way you would. Until it is trained, it will not take work from chat.
        </p>
      </PopoverContent>
    </Popover>
  );
}

function SetupOption({
  icon,
  title,
  description,
  pending,
  disabled,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  pending?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "group w-full rounded-xl border border-border/80 bg-background/70 text-left p-3.5 transition-all",
        "hover:border-foreground/20 hover:bg-muted/50 hover:shadow-sm",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        "disabled:opacity-60 disabled:pointer-events-none",
      )}
    >
      <span className="flex items-start gap-3">
        <span className="size-9 rounded-lg border border-border/70 bg-muted/60 text-foreground flex items-center justify-center shrink-0 group-hover:bg-background transition-colors">
          {pending ? <Loader2 className="size-4 animate-spin" /> : icon}
        </span>
        <span className="min-w-0 pt-0.5">
          <span className="block text-sm font-semibold text-foreground leading-none">{title}</span>
          {description ? (
            <span className="block text-[11px] text-muted-foreground leading-relaxed mt-1.5">{description}</span>
          ) : null}
        </span>
      </span>
    </button>
  );
}

export function PersonalAgentSetup({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const { data: personal } = useGetPersonalAgent();
  const start = useStartPersonalTraining();
  const selfTrain = useSelfTrainPersonalAgent();
  const [streamPercent, setStreamPercent] = useState(0);
  const [stage, setStage] = useState("Reading your workspace");
  const [finished, setFinished] = useState(false);

  const progress = personal?.progress ?? { answered: 0, inferred: 0, total: 13, percent: 0 };
  const trained = profileIsTrained(personal?.profile);
  const inProgress = !trained && progress.answered > 0;
  const pending = selfTrain.isPending;
  const busy = start.isPending || pending;
  const livePercent = finished ? 100 : Math.min(streamPercent, 99);
  const barPercent = pending ? Math.max(livePercent, 4) : Math.min(progress.percent, trained ? 100 : 99);

  const openTraining = () => {
    if (personal?.activeTrainingRunId) {
      router.push(`/agent/workflow?runId=${personal.activeTrainingRunId}`);
      return;
    }
    start.mutate(undefined, {
      onSuccess: (result) => router.push(`/agent/workflow?runId=${result.data.id}`),
    });
  };

  const runSelfTrain = () => {
    setFinished(false);
    setStreamPercent(4);
    setStage("Reading your workspace");
    selfTrain.mutate({
      onProgress: (event) => {
        if (typeof event.percent === "number") {
          setStreamPercent(event.done ? 100 : Math.min(event.percent, 99));
        }
        if (event.stage) setStage(event.stage);
        if (event.done) setFinished(true);
      },
    });
  };

  return (
    <div className={cn("space-y-4", compact && "space-y-3.5")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn("font-semibold tracking-tight text-foreground", compact ? "text-[15px]" : "text-base")}>
            I&apos;m here to help you.
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed mt-1.5">
            {compact
              ? "I am not trained yet. Train me on how you work, or let me learn from this workspace."
              : "Your private Chief of Staff. I brief you, prioritize assigned work, and act the way you would — after you train me."}
          </p>
        </div>
        <WhatIsPersonalAgent />
      </div>

      {pending || inProgress ? (
        <div className="rounded-xl border border-border/70 bg-muted/30 px-3.5 py-3 space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[11px] text-muted-foreground truncate">
              {pending ? stage : `${progress.answered} of ${progress.total} topics covered`}
            </p>
            <span className="text-[11px] tabular-nums font-semibold text-foreground">{Math.min(barPercent, 100)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-background/80 overflow-hidden">
            <div
              className="h-full rounded-full bg-foreground/80 transition-[width] duration-300 ease-out"
              style={{ width: `${Math.min(100, Math.max(barPercent, 3))}%` }}
            />
          </div>
          {progress.inferred > 0 && !pending ? (
            <p className="text-[11px] text-muted-foreground">{progress.inferred} assumed from workspace</p>
          ) : null}
        </div>
      ) : null}

      <div className={cn("grid gap-2.5", compact ? "grid-cols-2" : "grid-cols-1")}>
        <SetupOption
          icon={<MessagesSquare className="size-4" />}
          title={inProgress ? "Continue" : "Train"}
          description={compact ? "I'll ask how you work" : "I'll ask how you work, then save a standing prompt."}
          pending={start.isPending}
          disabled={busy}
          onClick={openTraining}
        />
        <SetupOption
          icon={<Wand2 className="size-4" />}
          title="Self-train"
          description={compact ? "I'll learn from this workspace" : "I'll learn from your role, projects, and assigned work."}
          pending={pending}
          disabled={busy}
          onClick={runSelfTrain}
        />
      </div>
      {!compact ? (
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Sparkles className="size-3 shrink-0" />
          You can stop a training chat anytime and pick up the percentage here.
        </p>
      ) : null}
    </div>
  );
}

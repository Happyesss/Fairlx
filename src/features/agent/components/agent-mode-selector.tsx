"use client";

import {
  Infinity,
  SlidersHorizontal,
  Bug,
  MessageSquare,
  UserRound,
  ChevronDown,
  Check,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useGetAgentHarness, useUpdateAgentHarness } from "../api/use-agent-harness";
import { AGENT_SESSION_MODES, runModeForSession } from "../lib/session-context";
import type { AgentSessionMode } from "../types";

type ModeConfig = {
  icon: LucideIcon;
  pillClass: string;
  iconClass: string;
  itemIconColor: string;
};

const MODE_CONFIGS: Record<AgentSessionMode, ModeConfig> = {
  agent: {
    icon: Infinity,
    pillClass:
      "bg-zinc-100 text-zinc-800 border-zinc-300/80 hover:bg-zinc-200/80 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700",
    iconClass: "text-zinc-700 dark:text-zinc-300",
    itemIconColor: "text-zinc-700 dark:text-zinc-300",
  },
  personal: {
    icon: UserRound,
    pillClass:
      "bg-violet-100 text-violet-900 border-violet-200 hover:bg-violet-200/70 dark:bg-violet-950/60 dark:text-violet-200 dark:border-violet-800/60",
    iconClass: "text-violet-700 dark:text-violet-300",
    itemIconColor: "text-violet-700 dark:text-violet-300",
  },
  plan: {
    icon: SlidersHorizontal,
    pillClass:
      "bg-[#f4e8d3] text-[#8c5216] border-[#e7d2b0] hover:bg-[#efe0c7] dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60",
    iconClass: "text-[#8c5216] dark:text-amber-400",
    itemIconColor: "text-[#8c5216] dark:text-amber-400",
  },
  debug: {
    icon: Bug,
    pillClass:
      "bg-rose-100 text-rose-800 border-rose-200 hover:bg-rose-200/70 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/60",
    iconClass: "text-rose-600 dark:text-rose-400",
    itemIconColor: "text-rose-600 dark:text-rose-400",
  },
  ask: {
    icon: MessageSquare,
    pillClass:
      "bg-sky-100 text-sky-800 border-sky-200 hover:bg-sky-200/70 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800/60",
    iconClass: "text-sky-600 dark:text-sky-400",
    itemIconColor: "text-sky-600 dark:text-sky-400",
  },
  multitask: {
    icon: Infinity,
    pillClass:
      "bg-zinc-100 text-zinc-800 border-zinc-300/80 hover:bg-zinc-200/80 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700",
    iconClass: "text-zinc-700 dark:text-zinc-300",
    itemIconColor: "text-zinc-700 dark:text-zinc-300",
  },
};

export function AgentModeSelector({ className }: { className?: string }) {
  const { data: harness } = useGetAgentHarness();
  const updateHarness = useUpdateAgentHarness();

  const currentMode = (harness?.settings.sessionMode as AgentSessionMode) || "agent";
  const currentModeObj =
    AGENT_SESSION_MODES.find((m) => m.id === currentMode) || AGENT_SESSION_MODES[0];
  const activeConfig = MODE_CONFIGS[currentMode] || MODE_CONFIGS.agent;
  const ActiveIcon = activeConfig.icon;

  const handleSelect = (modeId: AgentSessionMode) => {
    updateHarness.mutate({
      json: {
        settings: {
          sessionMode: modeId,
          mode: runModeForSession(modeId),
        },
      },
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-medium transition-colors border cursor-pointer shadow-2xs select-none shrink-0",
            activeConfig.pillClass,
            className
          )}
        >
          <ActiveIcon className={cn("size-3.5 shrink-0", activeConfig.iconClass)} />
          <span>{currentModeObj.label}</span>
          <ChevronDown className="size-3 opacity-60 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="top"
        className="w-64 bg-popover border-border text-popover-foreground shadow-xl rounded-xl p-1"
      >
        {AGENT_SESSION_MODES.map((mode) => {
          const config = MODE_CONFIGS[mode.id] || MODE_CONFIGS.agent;
          const Icon = config.icon;
          return (
            <DropdownMenuItem
              key={mode.id}
              onClick={() => handleSelect(mode.id)}
              title={mode.hint}
              className="flex items-start justify-between text-xs font-medium cursor-pointer rounded-lg px-2.5 py-2 hover:bg-muted transition-colors group"
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <Icon className={cn("size-3.5 shrink-0 mt-0.5", config.itemIconColor)} />
                <div className="min-w-0">
                  <div className="text-foreground font-medium">{mode.label}</div>
                  <div className="text-[10px] text-muted-foreground leading-snug mt-0.5 font-normal">
                    {mode.hint}
                  </div>
                </div>
              </div>
              {currentMode === mode.id && <Check className="size-3.5 text-foreground shrink-0 mt-0.5" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

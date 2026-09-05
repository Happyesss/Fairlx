"use client";

import { useEffect, useState } from "react";
import { Zap, Sliders, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useGetAgentAiConfig } from "../api/use-agent-ai-config";
import { useSelectAgentModel } from "../api/use-select-agent-model";
import { enabledModels, resolvedModelDisplayName, selectedModelLabel } from "../lib/client-defaults";
import { useAgentUi } from "./agent-ui-context";

type ModelPickerProps = {
  variant: "chip" | "sidebar" | "subtle";
  className?: string;
  runModelId?: string;
};

export function ModelPicker({ variant, className, runModelId }: ModelPickerProps) {
  const { openModels } = useAgentUi();
  const { data, isLoading } = useGetAgentAiConfig();
  const { mutate, isPending } = useSelectAgentModel();
  const [autoRevealed, setAutoRevealed] = useState(false);
  const models = enabledModels(data);
  const selectedId = data?.mode === "auto" ? "auto" : data?.selectedModelId;
  const runModelName = runModelId
    ? models.find((model) => model.id === runModelId)?.displayName || data?.resolvedModelName
    : undefined;
  const autoName = runModelName || resolvedModelDisplayName(data) || "Auto";

  useEffect(() => {
    if (data?.mode !== "auto") {
      setAutoRevealed(true);
      return;
    }
    setAutoRevealed(false);
    const timer = window.setTimeout(() => setAutoRevealed(true), 1000);
    return () => window.clearTimeout(timer);
  }, [data?.mode, data?.resolvedModelId, runModelId]);

  const label = isLoading
    ? "…"
    : data?.mode === "auto"
      ? autoRevealed
        ? autoName
        : "Selecting…"
      : selectedModelLabel(data);

  const trigger =
    variant === "subtle" ? (
      <button
        type="button"
        disabled={isPending}
        className={cn(
          "flex items-center gap-1 h-7 px-1.5 text-xs font-medium text-foreground/80 hover:text-foreground hover:bg-muted/60 rounded-md transition-colors cursor-pointer shrink-0 select-none",
          className
        )}
      >
        <span className="max-w-[170px] truncate">{label}</span>
        <ChevronDown className="size-3 opacity-60 shrink-0" />
      </button>
    ) : variant === "chip" ? (
      <button
        type="button"
        disabled={isPending}
        className={cn(
          "flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border border-border/50 shadow-sm",
          className
        )}
      >
        <Zap className="size-3 text-amber-500 fill-amber-500" />
        <span className="max-w-[150px] truncate">{label}</span>
        <ChevronDown className="size-3 opacity-60" />
      </button>
    ) : (
      <button
        type="button"
        disabled={isPending}
        className={cn(
          "w-full flex items-center justify-between p-2 rounded-lg hover:bg-sidebar-accent cursor-pointer border border-transparent hover:border-sidebar-border group transition-colors text-left",
          className
        )}
      >
        <div className="flex items-center gap-2.5">
          <Zap className="size-4 text-amber-500 fill-amber-500" />
          <span className="text-foreground text-xs font-medium group-hover:text-primary transition-colors">{label}</span>
        </div>
        <ChevronDown className="size-3 text-muted-foreground group-hover:text-foreground transition-colors" />
      </button>
    );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-64 bg-popover border-border text-popover-foreground shadow-xl rounded-xl"
      >
        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Models
        </DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() => mutate({ json: { mode: "auto" } })}
          className="flex items-center justify-between text-xs font-medium cursor-pointer"
        >
          <span>Auto{data?.resolvedModelName ? ` · ${data.resolvedModelName}` : ""}</span>
          {selectedId === "auto" && <Check className="size-3.5 text-primary" />}
        </DropdownMenuItem>
        {models.map((model) => (
          <DropdownMenuItem
            key={model.id}
            onClick={() => mutate({ json: { mode: "manual", selectedModelId: model.id } })}
            className="flex items-center justify-between text-xs font-medium cursor-pointer"
          >
            <span>{model.displayName}</span>
            {selectedId === model.id && <Check className="size-3.5 text-primary" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator className="bg-border" />
        <DropdownMenuItem onClick={openModels} className="text-xs font-medium cursor-pointer gap-2">
          <Sliders className="size-3.5" />
          <span>Manage Models</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

"use client";

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
import { enabledModels, selectedModelLabel } from "../lib/client-defaults";
import { useAgentUi } from "./agent-ui-context";

type ModelPickerProps = {
  variant: "chip" | "sidebar";
  className?: string;
};

export function ModelPicker({ variant, className }: ModelPickerProps) {
  const { openModels } = useAgentUi();
  const { data, isLoading } = useGetAgentAiConfig();
  const { mutate, isPending } = useSelectAgentModel();
  const label = isLoading ? "…" : selectedModelLabel(data);
  const models = enabledModels(data);
  const selectedId = data?.mode === "auto" ? "auto" : data?.selectedModelId;

  const trigger =
    variant === "chip" ? (
      <button
        type="button"
        disabled={isPending}
        className={cn(
          "flex items-center gap-1.5 h-7 px-2 rounded-full text-xs text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-colors",
          className
        )}
      >
        <i className="fa-solid fa-bolt text-[10px]" />
        <span className="max-w-[160px] truncate">{label}</span>
        <i className="fa-solid fa-chevron-down text-[9px] opacity-70" />
      </button>
    ) : (
      <button
        type="button"
        disabled={isPending}
        className={cn(
          "w-full flex items-center justify-between p-2 rounded-md hover:bg-fairlx-surface-hover cursor-pointer border border-transparent hover:border-fairlx-border group transition-colors text-left",
          className
        )}
      >
        <div className="flex items-center gap-2">
          <i className="fa-solid fa-bolt text-yellow-500" />
          <span className="text-fairlx-text text-sm group-hover:text-white">{label}</span>
        </div>
        <i className="fa-solid fa-chevron-down text-fairlx-text-muted text-xs group-hover:text-fairlx-text" />
      </button>
    );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="dark bg-fairlx-surface text-fairlx-text border-fairlx-border w-64"
      >
        <DropdownMenuLabel>Models</DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() => mutate({ json: { mode: "auto" } })}
          className="flex items-center justify-between"
        >
          <span>Auto</span>
          {selectedId === "auto" && <i className="fa-solid fa-check text-xs text-fairlx-primary" />}
        </DropdownMenuItem>
        {models.map((model) => (
          <DropdownMenuItem
            key={model.id}
            onClick={() => mutate({ json: { mode: "manual", selectedModelId: model.id } })}
            className="flex items-center justify-between"
          >
            <span>{model.displayName}</span>
            {selectedId === model.id && <i className="fa-solid fa-check text-xs text-fairlx-primary" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator className="bg-fairlx-border" />
        <DropdownMenuItem onClick={openModels}>
          <i className="fa-solid fa-sliders" />
          Manage Models
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

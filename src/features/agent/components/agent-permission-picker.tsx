"use client";

import { Shield, ShieldCheck, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useGetAgentHarness, useUpdateAgentHarness } from "../api/use-agent-harness";
import type { AgentPermissionType } from "../types";

const OPTIONS: Array<{ id: AgentPermissionType; label: string; hint: string }> = [
  {
    id: "staged",
    label: "Staged",
    hint: "Ask for mail, GitHub PRs, deletes, and invites",
  },
  {
    id: "all_access",
    label: "All access",
    hint: "Autonomous. Fairlx roles still apply",
  },
];

export function AgentPermissionPicker({ className }: { className?: string }) {
  const { data: harness } = useGetAgentHarness();
  const updateHarness = useUpdateAgentHarness();
  const current: AgentPermissionType = harness?.settings.permissionType === "all_access" ? "all_access" : "staged";
  const selected = OPTIONS.find((item) => item.id === current) ?? OPTIONS[0]!;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-1 h-7 px-1.5 text-xs font-medium text-foreground/80 hover:text-foreground hover:bg-muted/60 rounded-md transition-colors cursor-pointer shrink-0 select-none",
            className,
          )}
          title={selected.hint}
        >
          {current === "all_access" ? <ShieldCheck className="size-3.5" /> : <Shield className="size-3.5" />}
          <span className="max-w-[110px] truncate">{selected.label}</span>
          <ChevronDown className="size-3 opacity-60 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 bg-popover border-border shadow-xl rounded-xl">
        {OPTIONS.map((item) => (
          <DropdownMenuItem
            key={item.id}
            onClick={() => updateHarness.mutate({ json: { settings: { permissionType: item.id } } })}
            className="flex items-start justify-between gap-2 text-xs cursor-pointer py-2"
          >
            <span>
              <span className="font-medium block">{item.label}</span>
              <span className="text-muted-foreground">{item.hint}</span>
            </span>
            {current === item.id ? <Check className="size-3.5 text-primary mt-0.5 shrink-0" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

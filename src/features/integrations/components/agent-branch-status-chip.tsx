"use client";

import { GitBranch, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useGetTaskGitHubEvents } from "@/features/github-integration/api/use-github";
import { matchAgentBranch, suggestedBranchName } from "../lib/branch";

interface AgentBranchStatusChipProps {
  taskKey?: string | null;
  taskTitle?: string | null;
  className?: string;
}

const STATUS_LABEL: Record<string, string> = {
  none: "Suggested branch",
  branch: "Agent branch",
  pr_open: "PR open",
  pr_merged: "PR merged",
  pr_closed: "PR closed",
};

export function AgentBranchStatusChip({
  taskKey,
  taskTitle,
  className,
}: AgentBranchStatusChipProps) {
  const key = taskKey || "";
  const { data: events } = useGetTaskGitHubEvents(key, !!key);
  const match = matchAgentBranch(key, taskTitle || "work-item", events);
  const suggested = key
    ? suggestedBranchName(key, taskTitle || "work-item")
    : "";

  if (!key) return null;

  const label = STATUS_LABEL[match.status] || "Branch";
  const branch = match.branchName || suggested;

  const tone =
    match.status === "pr_merged"
      ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20"
      : match.status === "pr_open" || match.status === "branch"
        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
        : match.status === "pr_closed"
          ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20"
          : "bg-muted text-muted-foreground border-border";

  return (
    <div className={className}>
      <Badge
        variant="outline"
        className={`gap-1.5 max-w-full font-normal ${tone}`}
        title={`${label}: ${branch}`}
      >
        <GitBranch className="size-3 shrink-0" />
        <span className="truncate text-[10px]">
          {label}: <code className="font-mono">{branch}</code>
        </span>
        {match.prUrl && (
          <a
            href={match.prUrl}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 hover:text-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="size-3" />
          </a>
        )}
      </Badge>
    </div>
  );
}

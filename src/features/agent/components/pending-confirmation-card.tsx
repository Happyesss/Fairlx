"use client";

import { useMemo } from "react";
import {
  ClipboardList,
  XCircle,
  Loader2,
  Check,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusDisplay } from "@/features/custom-columns/components/status-display";
import { useGetProject } from "@/features/projects/api/use-get-project";
import { LabelBadge } from "@/features/tasks/components/LabelBadge";
import { PriorityBadge } from "@/features/tasks/components/priority-selector";
import { WorkItemIcon } from "@/features/timeline/components/work-item-icon";
import {
  parseConfirmationCall,
  type ParsedConfirmationCall,
  type ParsedWorkItemCall,
} from "../lib/write-guard";
import type { AgentPendingConfirmation } from "../types";

type PendingConfirmationCardProps = {
  pending: AgentPendingConfirmation;
  workspaceId?: string;
  projectId?: string;
  onAccept: () => void;
  onDeny: () => void;
  isAccepting?: boolean;
  isDenying?: boolean;
};

export function PendingConfirmationCard({
  pending,
  workspaceId,
  projectId,
  onAccept,
  onDeny,
  isAccepting = false,
  isDenying = false,
}: PendingConfirmationCardProps) {
  const { data: project } = useGetProject({
    projectId,
    enabled: Boolean(projectId),
  });

  const parsedCalls: ParsedConfirmationCall[] = useMemo(() => {
    return (pending.calls || []).map(parseConfirmationCall);
  }, [pending.calls]);

  const workItemCalls: ParsedWorkItemCall[] = useMemo(() => {
    return parsedCalls
      .map((c) => c.workItem)
      .filter((w): w is ParsedWorkItemCall => Boolean(w));
  }, [parsedCalls]);

  const hasWorkItems = workItemCalls.length > 0;
  const isBusy = isAccepting || isDenying;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden flex flex-col transition-all">
      {/* Header bar */}
      <div className="px-4 py-3 bg-muted/40 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            {hasWorkItems ? <ClipboardList className="size-4" /> : <Sparkles className="size-4" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground tracking-tight">
                {hasWorkItems
                  ? `Create ${workItemCalls.length} Work ${workItemCalls.length === 1 ? "Item" : "Items"}`
                  : "Approval Required"}
              </h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                Needs your approval
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {hasWorkItems
                ? `Review the proposed work items for ${project?.name || "the project"} before creating them.`
                : "The agent wants to perform the following actions in this workspace."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <Button
            size="sm"
            variant="outline"
            disabled={isBusy}
            onClick={onDeny}
            className="h-8 text-xs font-medium hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
          >
            {isDenying ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <XCircle className="size-3.5 mr-1.5" />}
            Deny
          </Button>
          <Button
            size="sm"
            disabled={isBusy}
            onClick={onAccept}
            className="h-8 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
          >
            {isAccepting ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <Check className="size-3.5 mr-1.5" />}
            {hasWorkItems ? `Accept All (${workItemCalls.length})` : "Accept"}
          </Button>
        </div>
      </div>

      {/* Content Section: Exactly matching Fairlx AgentWorkItemTable */}
      {hasWorkItems ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2.5 font-medium">Key</th>
                <th className="px-3 py-2.5 font-medium">Title</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium">Priority</th>
                <th className="px-3 py-2.5 font-medium">Assignee</th>
              </tr>
            </thead>
            <tbody>
              {workItemCalls.map((item, index) => {
                const customPriority = project?.customPriorities?.find(
                  (cp) => cp.key === item.priority
                );
                return (
                  <tr
                    key={item.id || `${item.title}-${index}`}
                    className="border-t border-border/70 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <WorkItemIcon
                          type={item.type}
                          className="size-4 shrink-0"
                          project={project}
                        />
                        <span className="font-semibold tabular-nums text-foreground">
                          #{index + 1}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 max-w-[320px]">
                      <span className="line-clamp-2 font-medium text-foreground" title={item.title}>
                        {item.title}
                      </span>
                      {item.description ? (
                        <span
                          className="block text-xs text-muted-foreground line-clamp-1 mt-0.5"
                          title={item.description}
                        >
                          {item.description}
                        </span>
                      ) : null}
                      {item.labels && item.labels.length > 0 ? (
                        <div className="flex flex-wrap gap-1 mt-1.5 items-center">
                          {item.labels.map((label, lIdx) => {
                            const customLabels = project?.customLabels || [];
                            const customLabel = customLabels.find(
                              (l) => l.name.toLowerCase() === label.toLowerCase()
                            );
                            return (
                              <LabelBadge
                                key={`${label}-${lIdx}`}
                                label={label}
                                color={customLabel?.color}
                              />
                            );
                          })}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <StatusDisplay
                        status="TODO"
                        projectId={projectId}
                        workspaceId={workspaceId}
                      />
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <PriorityBadge
                        className="px-1"
                        priority={item.priority}
                        color={customPriority?.color}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs text-muted-foreground">Unassigned</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-4 flex flex-col gap-2">
          {parsedCalls.map((call, index) => (
            <div
              key={call.id || index}
              className="flex items-center gap-2.5 p-2 rounded-lg bg-muted/40 border border-border/60 text-xs"
            >
              <div className="size-2 rounded-full bg-primary" />
              <span className="font-semibold text-foreground capitalize">
                {call.action}:
              </span>
              <span className="text-foreground flex-1 truncate">{call.summary}</span>
            </div>
          ))}
        </div>
      )}

      {/* Bottom bar if 3 or more work items */}
      {hasWorkItems && workItemCalls.length >= 3 ? (
        <div className="px-4 py-2.5 bg-muted/20 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {workItemCalls.length} items will be created with status <strong className="font-semibold text-foreground">TODO</strong>.
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              disabled={isBusy}
              onClick={onDeny}
              className="h-7 text-xs font-medium hover:text-destructive"
            >
              Deny
            </Button>
            <Button
              size="sm"
              disabled={isBusy}
              onClick={onAccept}
              className="h-7 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isAccepting ? <Loader2 className="size-3 animate-spin mr-1" /> : <Check className="size-3 mr-1" />}
              Accept All
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

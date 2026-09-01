"use client";

import { useMemo } from "react";

import { StatusDisplay } from "@/features/custom-columns/components/status-display";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { useGetProject } from "@/features/projects/api/use-get-project";
import { AssigneeAvatarGroup } from "@/features/tasks/components/assignee-avatar-group";
import { PriorityBadge } from "@/features/tasks/components/priority-selector";
import { WorkItemIcon } from "@/features/timeline/components/work-item-icon";

import {
  mergeWorkItem,
  normalizeAssignees,
  type AgentWorkItem,
  type AgentWorkItemAssignee,
} from "../lib/work-item-table";

export function AgentWorkItemTable({
  rows,
  lookup,
  workspaceId,
  projectId,
}: {
  rows: AgentWorkItem[];
  lookup?: Map<string, AgentWorkItem>;
  workspaceId?: string;
  projectId?: string;
}) {
  const { data: project } = useGetProject({ projectId, enabled: Boolean(projectId) });
  const { data: members } = useGetMembers({
    workspaceId: workspaceId ?? "",
    enabled: Boolean(workspaceId),
  });

  const memberByName = useMemo(() => {
    const map = new Map<string, { id: string; name: string; imageUrl?: string | null }>();
    for (const member of members?.documents ?? []) {
      const name = String(member.name ?? "").trim();
      const email = String(member.email ?? "").trim();
      const entry = {
        id: String(member.$id ?? ""),
        name: name || email,
        imageUrl: member.profileImageUrl ?? null,
      };
      if (name) map.set(name.toLowerCase(), entry);
      if (email) map.set(email.toLowerCase(), entry);
    }
    return map;
  }, [members?.documents]);

  const merged = rows.map((row) => {
    const key = String(row.key ?? "").toUpperCase();
    const item = mergeWorkItem(row, key ? lookup?.get(key) : undefined);
    const assignees = normalizeAssignees(item.assignees).map((person) => {
      const match = memberByName.get(person.name.toLowerCase());
      return {
        ...person,
        id: person.id || match?.id,
        imageUrl: person.imageUrl || match?.imageUrl || null,
      } satisfies AgentWorkItemAssignee;
    });
    return { ...item, assignees };
  });

  return (
    <div className="my-3 overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
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
          {merged.map((row, index) => {
            const assignees = row.assignees ?? [];
            const unassigned = row.unassigned || assignees.length === 0;
            const customPriority = project?.customPriorities?.find((item) => item.key === row.priority);
            return (
              <tr key={`${row.key ?? row.title ?? index}`} className="border-t border-border/70 hover:bg-muted/30">
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    {row.type ? (
                      <WorkItemIcon type={row.type} className="size-4 shrink-0" project={project} />
                    ) : null}
                    <span className="font-semibold tabular-nums text-foreground">{row.key || "—"}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 max-w-[320px]">
                  <span className="line-clamp-2 font-medium text-foreground" title={row.title}>
                    {row.title || "—"}
                  </span>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {row.status ? (
                    <StatusDisplay status={row.status} projectId={projectId} workspaceId={workspaceId} />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {row.priority ? (
                    <PriorityBadge
                      className="px-1"
                      priority={row.priority}
                      color={customPriority?.color}
                    />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  {unassigned ? (
                    <span className="text-xs text-muted-foreground">Unassigned</span>
                  ) : (
                    <div className="flex items-center gap-2 min-w-0">
                      <AssigneeAvatarGroup
                        assignees={assignees.map((person, personIndex) => ({
                          $id: person.id || `${row.key ?? index}-${person.name}-${personIndex}`,
                          name: person.name,
                          profileImageUrl: person.imageUrl,
                        }))}
                        visibleCount={3}
                        avatarClassName="size-6 border-2 border-background"
                        fallbackClassName="text-[10px]"
                        extraCountClassName="size-6 rounded-full bg-muted text-[10px] font-medium flex items-center justify-center border-2 border-background"
                        popoverAlign="end"
                        ariaLabel={`View ${assignees.length} assignees`}
                      />
                      <span className="truncate text-xs font-medium text-foreground">
                        {assignees.length === 1
                          ? assignees[0]?.name
                          : `${assignees.length} assignees`}
                      </span>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

"use client";

import { useMemo } from "react";
import { Crown, Shield } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { MemberAvatar } from "@/features/members/components/member-avatar";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { useCurrentMember } from "@/features/members/hooks/use-current-member";
import { MemberRole, WorkspaceMemberRole } from "@/features/members/types";

import { mergeMember, memberLookupKey, normalizeRole, type AgentMember } from "../lib/member-table";

function isAdminRole(role?: string) {
  return role === MemberRole.ADMIN || role === WorkspaceMemberRole.WS_ADMIN;
}

function isPlainMemberRole(role?: string) {
  return !role || role === MemberRole.MEMBER || role === WorkspaceMemberRole.WS_EDITOR;
}

export function AgentMemberTable({
  rows,
  lookup,
  workspaceId,
}: {
  rows: AgentMember[];
  lookup?: Map<string, AgentMember>;
  workspaceId?: string;
}) {
  const { data: members } = useGetMembers({
    workspaceId: workspaceId ?? "",
    enabled: Boolean(workspaceId),
  });
  const { member: currentMember } = useCurrentMember({ workspaceId: workspaceId ?? "" });

  const memberByKey = useMemo(() => {
    const map = new Map<string, AgentMember>();
    for (const member of members?.documents ?? []) {
      const entry: AgentMember = {
        id: String(member.$id ?? ""),
        name: String(member.name ?? "").trim() || String(member.email ?? "").trim(),
        email: String(member.email ?? "").trim(),
        role: String(member.role ?? ""),
        imageUrl: member.profileImageUrl ?? null,
      };
      const emailKey = memberLookupKey(entry);
      if (emailKey) map.set(emailKey, entry);
      const name = String(member.name ?? "").trim().toLowerCase();
      if (name) map.set(`name:${name}`, entry);
    }
    return map;
  }, [members?.documents]);

  const merged = rows.map((row) => {
    const emailKey = memberLookupKey(row);
    const nameKey = row.name ? `name:${String(row.name).trim().toLowerCase()}` : "";
    const extra = (emailKey ? lookup?.get(emailKey) : undefined) || (nameKey ? lookup?.get(nameKey) : undefined);
    const live = (emailKey ? memberByKey.get(emailKey) : undefined) || (nameKey ? memberByKey.get(nameKey) : undefined);
    return mergeMember(mergeMember(row, extra), live);
  });

  return (
    <div className="my-3 space-y-2">
      {merged.map((row, index) => {
        const displayName = row.name?.trim() || row.email || "Unknown member";
        const displayEmail = row.email || "Unknown email";
        const role = normalizeRole(row.role);
        const isAdmin = isAdminRole(role);
        const isCurrentUser =
          Boolean(currentMember) &&
          (currentMember?.$id === row.id ||
            (currentMember?.email && row.email && currentMember.email.toLowerCase() === row.email.toLowerCase()) ||
            (currentMember?.name && row.name && currentMember.name.toLowerCase() === row.name.toLowerCase()));

        return (
          <div
            key={`${row.email || row.name || index}`}
            className="p-3 rounded-lg border bg-card hover:border-primary/30 hover:bg-accent/30 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <MemberAvatar
                  className="size-9"
                  fallbackClassName="text-sm"
                  name={displayName}
                  imageUrl={row.imageUrl}
                  tooltipText={displayName}
                />
                {isAdmin ? (
                  <div className="absolute -bottom-0.5 -right-0.5 bg-amber-500 rounded-full p-0.5 border-2 border-background">
                    <Crown className="size-2.5 text-white" />
                  </div>
                ) : null}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <p className="text-sm font-medium truncate">{displayName}</p>
                  {isAdmin ? (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/20 text-xs px-1.5 py-0 rounded-full">
                      <Crown className="size-2.5 mr-1" />
                      Admin
                    </Badge>
                  ) : null}
                  {!isAdmin && !isPlainMemberRole(role) ? (
                    <Badge variant="outline" className="bg-purple-500/10 text-purple-700 border-purple-500/20 text-xs px-1.5 py-0 rounded-full">
                      <Shield className="size-2.5 mr-1" />
                      {role}
                    </Badge>
                  ) : null}
                  {isCurrentUser ? (
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-500/20 text-xs px-1.5 py-0 rounded-full">
                      You
                    </Badge>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground truncate">{displayEmail}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

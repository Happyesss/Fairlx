"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateWorkspace } from "@/features/workspaces/api/use-create-workspace";

import { useGetAgentContext } from "../api/use-agent-context";
import { useGetAgentRuns } from "../api/use-agent-runs";
import { AGENT_FIELD_CLASS } from "../constants";
import { relativeTime } from "../lib/agent-ui";

function inviteUrl(workspaceId: string, inviteCode?: string) {
  if (!inviteCode || typeof window === "undefined") return "";
  return `${window.location.origin}/workspaces/${workspaceId}/join/${inviteCode}`;
}

export function InviteMembersDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data } = useGetAgentContext();
  const workspaces = data?.workspaces ?? [];
  const [workspaceId, setWorkspaceId] = useState("");
  const selected = workspaces.find((workspace) => workspace.id === workspaceId) ?? workspaces[0];
  const url = selected ? inviteUrl(selected.id, selected.inviteCode) : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dark bg-fairlx-surface text-fairlx-text border-fairlx-border max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite members</DialogTitle>
          <DialogDescription className="text-fairlx-text-muted">
            Copy a workspace invite link. Recipients join with the existing Fairlx invite flow.
          </DialogDescription>
        </DialogHeader>
        {workspaces.length === 0 ? (
          <p className="text-sm text-fairlx-text-muted">Create a workspace first to invite members.</p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="invite-workspace">Workspace</Label>
              <select
                id="invite-workspace"
                value={selected?.id ?? ""}
                onChange={(event) => setWorkspaceId(event.target.value)}
                className={`h-10 w-full rounded-md border px-3 text-sm ${AGENT_FIELD_CLASS}`}
              >
                {workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-url">Invite link</Label>
              <Input
                id="invite-url"
                readOnly
                value={url || "This workspace has no invite code yet."}
                className={AGENT_FIELD_CLASS}
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button
            type="button"
            disabled={!url}
            onClick={async () => {
              await navigator.clipboard.writeText(url);
              toast.success("Invite link copied.");
            }}
          >
            Copy link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function NewWorkspaceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState("");
  const createWorkspace = useCreateWorkspace();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setName("");
      }}
    >
      <DialogContent className="dark bg-fairlx-surface text-fairlx-text border-fairlx-border max-w-md">
        <DialogHeader>
          <DialogTitle>New workspace</DialogTitle>
          <DialogDescription className="text-fairlx-text-muted">
            Create a Fairlx workspace the Agent can use as context.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = name.trim();
            if (!trimmed) return;
            createWorkspace.mutate(
              { form: { name: trimmed } },
              {
                onSuccess: () => {
                  setName("");
                  onOpenChange(false);
                },
              }
            );
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="workspace-name">Name</Label>
            <Input
              id="workspace-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Acme"
              className={AGENT_FIELD_CLASS}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!name.trim() || createWorkspace.isPending}>
              {createWorkspace.isPending ? "Creating…" : "Create workspace"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const { data: runs } = useGetAgentRuns();
  const { data: context } = useGetAgentContext();
  const needle = query.trim().toLowerCase();

  const results = useMemo(() => {
    const match = (value?: string) => !needle || (value ?? "").toLowerCase().includes(needle);
    const runHits = (runs ?? [])
      .filter((run) => match(run.title) || match(run.prompt))
      .slice(0, 8)
      .map((run) => ({
        id: run.id,
        href: `/agent/workflow?runId=${run.id}`,
        title: run.title,
        meta: `Run · ${relativeTime(run.updatedAt)}`,
      }));
    const workspaceHits = (context?.workspaces ?? [])
      .filter((workspace) => match(workspace.name))
      .slice(0, 6)
      .map((workspace) => ({
        id: workspace.id,
        href: `/workspaces/${workspace.id}`,
        title: workspace.name,
        meta: "Workspace",
      }));
    const projectHits = (context?.projects ?? [])
      .filter((project) => match(project.name) || match(project.key))
      .slice(0, 6)
      .map((project) => ({
        id: project.id,
        href: `/workspaces/${project.workspaceId}/projects/${project.id}`,
        title: project.name,
        meta: project.key ? `Project · ${project.key}` : "Project",
      }));
    const itemHits = (context?.workItems ?? [])
      .filter((item) => match(item.title) || match(item.key))
      .slice(0, 8)
      .map((item) => ({
        id: item.id,
        href: item.workspaceId ? `/workspaces/${item.workspaceId}/tasks/${item.id}` : "/agent/projects",
        title: item.title,
        meta: [item.key, item.status].filter(Boolean).join(" · ") || "Work item",
      }));
    return [...runHits, ...workspaceHits, ...projectHits, ...itemHits];
  }, [context, needle, runs]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setQuery("");
      }}
    >
      <DialogContent className="dark bg-fairlx-surface text-fairlx-text border-fairlx-border max-w-xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Search</DialogTitle>
          <DialogDescription className="text-fairlx-text-muted">
            Find runs, workspaces, projects, and assigned work items.
          </DialogDescription>
        </DialogHeader>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search the Agent harness…"
          className={AGENT_FIELD_CLASS}
          autoFocus
        />
        <div className="max-h-[50vh] overflow-y-auto space-y-1 custom-scrollbar">
          {results.length === 0 ? (
            <p className="text-sm text-fairlx-text-muted px-1 py-6 text-center">No matches.</p>
          ) : (
            results.map((result) => (
              <Link
                key={`${result.meta}-${result.id}`}
                href={result.href}
                onClick={() => onOpenChange(false)}
                className="block rounded-lg px-3 py-2 hover:bg-fairlx-surface-hover"
              >
                <div className="text-sm text-white truncate">{result.title}</div>
                <div className="text-xs text-fairlx-text-muted">{result.meta}</div>
              </Link>
            ))
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              router.push("/agent/dashboard");
            }}
          >
            Agent Home
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

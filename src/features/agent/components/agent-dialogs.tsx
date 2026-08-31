"use client";

import { useMemo, useState } from "react";
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
import { useGetAgentHarness } from "../api/use-agent-harness";
import { useGetAgentRuns } from "../api/use-agent-runs";
import { AGENT_FIELD_CLASS } from "../constants";
import { searchAgentIndex } from "../lib/search";
import { SearchHits } from "./agent-ops-screens";

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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite members</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Copy a workspace invite link. Recipients join with the existing Fairlx invite flow.
          </DialogDescription>
        </DialogHeader>
        {workspaces.length === 0 ? (
          <p className="text-sm text-muted-foreground">Create a workspace first to invite members.</p>
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New workspace</DialogTitle>
          <DialogDescription className="text-muted-foreground">
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
              placeholder="Acme Corp"
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
  const { data: harness } = useGetAgentHarness();

  const results = useMemo(
    () =>
      searchAgentIndex({
        query,
        runs: runs ?? [],
        context,
        harness,
        limit: 24,
      }),
    [context, harness, query, runs],
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setQuery("");
      }}
    >
      <DialogContent className="max-w-xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Search</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Find chats, workspaces, projects, skills, knowledge, automations, and git staging.
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
          <SearchHits hits={results} onPick={() => onOpenChange(false)} />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              router.push("/agent/search");
            }}
          >
            Open full search
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

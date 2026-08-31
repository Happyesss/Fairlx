"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

import { useGetAgentContext } from "../api/use-agent-context";
import { useGetAgentHarness, useUpdateAgentHarness } from "../api/use-agent-harness";
import { useCreateAgentRun } from "../api/use-agent-runs";
import { AGENT_FIELD_CLASS } from "../constants";
import { useAgentUi } from "./agent-ui-context";
import { ModelPicker } from "./model-picker";

const QUICK_ACTIONS = [
  {
    icon: "fa-solid fa-lightbulb",
    label: "Plan new feature",
    prompt: "Plan a new feature for the current Fairlx workspace.",
  },
  {
    icon: "fa-solid fa-bug",
    label: "Fix a bug",
    prompt: "Help me investigate and fix a bug in the current Fairlx project.",
  },
  {
    icon: "fa-solid fa-code",
    label: "Refactor code",
    prompt: "Propose a focused refactor for the current Fairlx project.",
  },
  {
    icon: "fa-solid fa-vial",
    label: "Write tests",
    prompt: "Write tests for the current Fairlx work.",
  },
  {
    icon: "fa-regular fa-file-lines",
    label: "Add docs",
    prompt: "Draft documentation for the current Fairlx work.",
  },
] as const;

export function AgentCommandInput({
  showQuickActions = true,
  placeholder = "Ask the Agent to inspect work, search, or ship a change…",
}: {
  showQuickActions?: boolean;
  placeholder?: string;
}) {
  const router = useRouter();
  const { openNewWorkspace } = useAgentUi();
  const { data: harness } = useGetAgentHarness();
  const { data: context } = useGetAgentContext();
  const createRun = useCreateAgentRun();
  const updateHarness = useUpdateAgentHarness();
  const [prompt, setPrompt] = useState("");
  const [contextOpen, setContextOpen] = useState(false);
  const [workspaceId, setWorkspaceId] = useState("");
  const [projectId, setProjectId] = useState("");

  const workspaces = context?.workspaces ?? [];
  const selectedWorkspaceId =
    workspaceId || harness?.settings.defaultWorkspaceId || workspaces[0]?.id || "";
  const projects = (context?.projects ?? []).filter(
    (project) => !selectedWorkspaceId || project.workspaceId === selectedWorkspaceId
  );

  const startRun = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || createRun.isPending) return;
    createRun.mutate(
      {
        json: {
          prompt: trimmed,
          workspaceId: harness?.settings.defaultWorkspaceId || context?.workspaces[0]?.id,
          projectId: harness?.settings.defaultProjectId,
        },
      },
      {
        onSuccess: (result) => {
          setPrompt("");
          router.push(`/agent/workflow?runId=${result.data.id}`);
        },
      }
    );
  };

  return (
    <div className="space-y-4">
      <form
        className="rounded-2xl border border-fairlx-border bg-fairlx-surface p-3"
        onSubmit={(event) => {
          event.preventDefault();
          startRun(prompt);
        }}
      >
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              startRun(prompt);
            }
          }}
          placeholder={placeholder}
          rows={3}
          className="w-full resize-none bg-transparent text-sm text-fairlx-text placeholder:text-fairlx-text-muted focus:outline-none"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openNewWorkspace}
            className="h-8 w-8 rounded-md border border-fairlx-border text-fairlx-text-muted hover:text-white hover:bg-fairlx-surface-hover"
            title="New workspace"
          >
            <i className="fa-solid fa-plus" />
          </button>
          <button
            type="button"
            onClick={() => {
              setWorkspaceId(harness?.settings.defaultWorkspaceId || workspaces[0]?.id || "");
              setProjectId(harness?.settings.defaultProjectId || "");
              setContextOpen(true);
            }}
            className="h-8 rounded-md border border-fairlx-border px-3 text-xs text-fairlx-text-muted hover:text-white hover:bg-fairlx-surface-hover"
          >
            <i className="fa-solid fa-layer-group mr-2" />
            Context
          </button>
          <button
            type="button"
            onClick={() => router.push("/agent/tools")}
            className="h-8 rounded-md border border-fairlx-border px-3 text-xs text-fairlx-text-muted hover:text-white hover:bg-fairlx-surface-hover"
          >
            <i className="fa-solid fa-wrench mr-2" />
            Tools
          </button>
          <div className="ml-auto flex items-center gap-2">
            <ModelPicker variant="chip" />
            <Button type="submit" size="sm" disabled={!prompt.trim() || createRun.isPending}>
              {createRun.isPending ? (
                "Starting…"
              ) : (
                <i className="fa-solid fa-paper-plane" />
              )}
            </Button>
          </div>
        </div>
      </form>
      {showQuickActions ? (
        <div className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              type="button"
              disabled={createRun.isPending}
              onClick={() => startRun(action.prompt)}
              className="inline-flex items-center gap-2 rounded-full border border-fairlx-border bg-fairlx-surface px-3 py-1.5 text-xs text-fairlx-text-muted hover:text-white hover:bg-fairlx-surface-hover"
            >
              <i className={action.icon} />
              {action.label}
            </button>
          ))}
        </div>
      ) : null}

      <Dialog open={contextOpen} onOpenChange={setContextOpen}>
        <DialogContent className="dark bg-fairlx-surface text-fairlx-text border-fairlx-border max-w-md">
          <DialogHeader>
            <DialogTitle>Run context</DialogTitle>
            <DialogDescription className="text-fairlx-text-muted">
              Default workspace and project for new Agent runs.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="context-workspace">Workspace</Label>
              <select
                id="context-workspace"
                value={selectedWorkspaceId}
                onChange={(event) => {
                  setWorkspaceId(event.target.value);
                  setProjectId("");
                }}
                className={`h-10 w-full rounded-md border px-3 text-sm ${AGENT_FIELD_CLASS}`}
              >
                <option value="">None</option>
                {workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="context-project">Project</Label>
              <select
                id="context-project"
                value={projectId || harness?.settings.defaultProjectId || ""}
                onChange={(event) => setProjectId(event.target.value)}
                className={`h-10 w-full rounded-md border px-3 text-sm ${AGENT_FIELD_CLASS}`}
              >
                <option value="">None</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              disabled={updateHarness.isPending}
              onClick={() => {
                updateHarness.mutate(
                  {
                    json: {
                      settings: {
                        defaultWorkspaceId: selectedWorkspaceId,
                        defaultProjectId: projectId,
                      },
                    },
                  },
                  { onSuccess: () => setContextOpen(false) }
                );
              }}
            >
              Save context
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

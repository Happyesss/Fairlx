"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCreateProject } from "@/features/projects/api/use-create-project";
import { cn } from "@/lib/utils";

import { useGetAgentContext } from "../api/use-agent-context";
import { useGetAgentHarness, useUpdateAgentHarness } from "../api/use-agent-harness";
import { AGENT_CONTEXT_QUERY_KEY } from "../constants";
import { useAgentUi } from "./agent-ui-context";

export function AgentScopeBar() {
  const { data: context } = useGetAgentContext();
  const { data: harness } = useGetAgentHarness();
  const { openNewWorkspace } = useAgentUi();
  const updateHarness = useUpdateAgentHarness();
  const createProject = useCreateProject();
  const queryClient = useQueryClient();
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");

  const workspaces = useMemo(() => context?.workspaces ?? [], [context?.workspaces]);
  const workspaceId = harness?.settings.defaultWorkspaceId || workspaces[0]?.id;
  const workspace = workspaces.find((item) => item.id === workspaceId);
  const projects = useMemo(
    () => (context?.projects ?? []).filter((item) => !workspaceId || item.workspaceId === workspaceId),
    [context?.projects, workspaceId],
  );
  const projectId = harness?.settings.defaultProjectId;
  const project = projects.find((item) => item.id === projectId) ?? context?.projects.find((item) => item.id === projectId);
  const repo = (context?.githubRepos ?? []).find(
    (item) => item.projectId === project?.id || (!project && item.workspaceId === workspaceId),
  );
  const q = search.trim().toLowerCase();
  const filteredWorkspaces = useMemo(
    () => workspaces.filter((item) => !q || item.name.toLowerCase().includes(q)),
    [workspaces, q],
  );
  const filteredProjects = useMemo(
    () => projects.filter((item) => !q || item.name.toLowerCase().includes(q)),
    [projects, q],
  );

  const selectWorkspace = (id: string) => {
    const stillValid = (context?.projects ?? []).some(
      (item) => item.id === projectId && item.workspaceId === id,
    );
    updateHarness.mutate({
      json: {
        settings: {
          defaultWorkspaceId: id,
          defaultProjectId: stillValid ? projectId : undefined,
        },
      },
    });
    setWorkspaceOpen(false);
    setSearch("");
  };

  const selectProject = (id: string, nextWorkspaceId?: string) => {
    updateHarness.mutate({
      json: {
        settings: {
          defaultWorkspaceId: nextWorkspaceId || workspaceId,
          defaultProjectId: id,
        },
      },
    });
    setProjectOpen(false);
    setSearch("");
  };

  return (
    <div className="flex items-center gap-1 text-[11px] text-zinc-500 px-1 pb-1.5">
      <ScopeMenu
        open={workspaceOpen}
        onOpenChange={(next) => {
          setWorkspaceOpen(next);
          setSearch("");
        }}
        label={workspace?.name || "Workspace"}
        icon="fa-solid fa-briefcase"
        searchPlaceholder="Search workspaces..."
        search={search}
        onSearch={setSearch}
      >
        {filteredWorkspaces.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => selectWorkspace(item.id)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-white/5 text-left"
          >
            <i className="fa-solid fa-folder text-zinc-500" />
            <span className="flex-1 truncate text-zinc-200">{item.name}</span>
            {item.id === workspaceId ? <i className="fa-solid fa-check text-[10px] text-blue-400" /> : null}
          </button>
        ))}
        <div className="h-px bg-white/10 my-1" />
        <button
          type="button"
          onClick={() => {
            setWorkspaceOpen(false);
            openNewWorkspace();
          }}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-white/5 text-left text-zinc-300"
        >
          <i className="fa-solid fa-plus" />
          New workspace
        </button>
      </ScopeMenu>
      <span className="text-zinc-700">/</span>
      <ScopeMenu
        open={projectOpen}
        onOpenChange={(next) => {
          setProjectOpen(next);
          setSearch("");
          setNewName("");
        }}
        label={project?.name || "Project"}
        icon="fa-solid fa-code"
        searchPlaceholder="Search folders, projects..."
        search={search}
        onSearch={setSearch}
      >
        {filteredProjects.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => selectProject(item.id, item.workspaceId)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-white/5 text-left"
          >
            <i className="fa-solid fa-folder text-zinc-500" />
            <span className="flex-1 truncate text-zinc-200">{item.name}</span>
            {item.id === projectId ? <i className="fa-solid fa-check text-[10px] text-blue-400" /> : null}
          </button>
        ))}
        <div className="h-px bg-white/10 my-1" />
        <form
          className="px-3 py-2 flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!newName.trim() || !workspaceId) return;
            createProject.mutate(
              { form: { name: newName.trim(), workspaceId } },
              {
                onSuccess: (result) => {
                  queryClient.invalidateQueries({ queryKey: AGENT_CONTEXT_QUERY_KEY });
                  const created = (result as { data?: { $id?: string } }).data;
                  if (created?.$id) selectProject(created.$id, workspaceId);
                  setNewName("");
                },
              },
            );
          }}
        >
          <i className="fa-solid fa-folder-plus text-zinc-500" />
          <input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="New project"
            className="flex-1 bg-transparent text-xs outline-none placeholder:text-zinc-600"
          />
        </form>
      </ScopeMenu>
      {repo ? (
        <>
          <span className="text-zinc-700">/</span>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md hover:bg-white/5">
            <i className="fa-solid fa-code-branch" />
            {repo.branch || "main"}
          </span>
        </>
      ) : null}
    </div>
  );
}

function ScopeMenu({
  open,
  onOpenChange,
  label,
  icon,
  searchPlaceholder,
  search,
  onSearch,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  icon: string;
  searchPlaceholder: string;
  search: string;
  onSearch: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md hover:bg-white/5 hover:text-zinc-200 max-w-[160px]",
          )}
        >
          <i className={`${icon} text-[10px]`} />
          <span className="truncate">{label}</span>
          <i className="fa-solid fa-chevron-down text-[8px]" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="dark w-80 p-0 bg-[#1c1d21] border-white/10 text-zinc-200">
        <div className="px-3 py-2 border-b border-white/10">
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={searchPlaceholder}
            className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-500"
          />
        </div>
        <div className="py-1 max-h-64 overflow-y-auto custom-scrollbar">{children}</div>
      </PopoverContent>
    </Popover>
  );
}

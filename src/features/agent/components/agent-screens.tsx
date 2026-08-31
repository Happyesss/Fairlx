"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  FolderKanban,
  Briefcase,
  Wrench,
  Activity,
  Zap,
  BookOpen,
  Settings,
  Puzzle,
  GitBranch,
  Terminal,
  Code,
  Search,
  Globe,
  Database,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { useGetAgentContext } from "../api/use-agent-context";
import { useGetAgentHarness, useResetAgentHarness, useUpdateAgentHarness } from "../api/use-agent-harness";
import { AGENT_FIELD_CLASS, AGENT_TOOL_CATALOG } from "../constants";
import { relativeTime } from "../lib/agent-ui";
import type {
  AgentAutomation,
  AgentContextProject,
  AgentContextWorkspace,
  AgentKnowledgeItem,
  AgentSkill,
  AgentWorkPattern,
} from "../types";
import { AgentPageFrame } from "./agent-app-shell";
import { AgentNewProjectForm, AutomationRunButton } from "./agent-ops-screens";
import { McpServersCard } from "./mcp-servers-card";
import { useAgentUi } from "./agent-ui-context";

const selectClass = cn("h-10 w-full rounded-md px-3 text-sm outline-none", AGENT_FIELD_CLASS);

function newId() {
  return crypto.randomUUID();
}

function nowIso() {
  return new Date().toISOString();
}

function workspaceName(workspaces: AgentContextWorkspace[], id?: string) {
  if (!id) return "Workspace";
  return workspaces.find((workspace) => workspace.id === id)?.name ?? "Workspace";
}

function ScreenHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        <p className="mt-1 text-xs text-muted-foreground max-w-2xl">{description}</p>
      </div>
      {action}
    </div>
  );
}

function EmptyState({ icon: Icon, title, body }: { icon?: React.ComponentType<{ className?: string }>; title: string; body: string }) {
  const IconComponent = Icon || FolderKanban;
  return (
    <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center shadow-sm">
      <IconComponent className="size-6 text-primary mx-auto mb-2" />
      <p className="mt-2 text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return <p className="text-xs text-muted-foreground py-6 text-center">{label}</p>;
}

function RemoveButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      disabled={disabled}
      onClick={onClick}
      className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
    >
      {label}
    </Button>
  );
}

function ToolCatalogIcon({ id }: { id: string }) {
  if (id === "code_inspect") return <Code className="size-4 text-primary shrink-0" />;
  if (id === "terminal") return <Terminal className="size-4 text-primary shrink-0" />;
  if (id === "file_search") return <Search className="size-4 text-primary shrink-0" />;
  if (id === "web_search") return <Globe className="size-4 text-primary shrink-0" />;
  if (id === "skills") return <Wrench className="size-4 text-primary shrink-0" />;
  if (id.includes("database") || id.includes("list_")) return <Database className="size-4 text-primary shrink-0" />;
  return <Activity className="size-4 text-primary shrink-0" />;
}

export function AgentProjectsScreen() {
  const { data, isLoading } = useGetAgentContext();
  const projects = data?.projects ?? [];
  const workspaces = data?.workspaces ?? [];

  return (
    <AgentPageFrame>
      <div className="max-w-[1400px] mx-auto space-y-6">
        <ScreenHeader
          title="Projects"
          description="Projects from workspaces you belong to. Create one here, or open an existing project in Fairlx."
        />
        <AgentNewProjectForm />
        {isLoading ? (
          <LoadingState label="Loading projects…" />
        ) : projects.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            body="Create a project inside a workspace, then it will show up here for the Agent."
          />
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/workspaces/${project.workspaceId}/projects/${project.id}`}
                className="rounded-xl border border-border bg-card p-4 hover:bg-muted/40 transition-colors shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{project.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground truncate">
                      {workspaceName(workspaces, project.workspaceId)}
                      {project.key ? ` · ${project.key}` : ""}
                    </p>
                  </div>
                  {project.status ? (
                    <span className="text-[11px] text-muted-foreground shrink-0 font-medium">{project.status}</span>
                  ) : null}
                </div>
                {project.description ? (
                  <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{project.description}</p>
                ) : null}
              </Link>
            ))}
          </div>
        )}
      </div>
    </AgentPageFrame>
  );
}

export function AgentWorkspacesScreen() {
  const { data, isLoading } = useGetAgentContext();
  const { openNewWorkspace, openInvite } = useAgentUi();
  const workspaces = data?.workspaces ?? [];
  const projects = data?.projects ?? [];

  return (
    <AgentPageFrame>
      <div className="max-w-[1400px] mx-auto">
        <ScreenHeader
          title="Workspaces"
          description="Fairlx workspaces the Agent can use as context, defaults, and invite targets."
          action={
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={openInvite}>
                Invite members
              </Button>
              <Button type="button" size="sm" onClick={openNewWorkspace}>
                New workspace
              </Button>
            </div>
          }
        />
        {isLoading ? (
          <LoadingState label="Loading workspaces…" />
        ) : workspaces.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No workspaces yet"
            body="Create a workspace to give the Agent a place to plan, inspect, and ship work."
          />
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {workspaces.map((workspace) => {
              const count = projects.filter((project) => project.workspaceId === workspace.id).length;
              return (
                <Link
                  key={workspace.id}
                  href={`/workspaces/${workspace.id}`}
                  className="rounded-xl border border-border bg-card p-4 hover:bg-muted/40 transition-colors shadow-sm"
                >
                  <p className="text-sm font-semibold text-foreground truncate">{workspace.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {count} {count === 1 ? "project" : "projects"}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AgentPageFrame>
  );
}

export function AgentSkillsScreen() {
  const { data: harness, isLoading } = useGetAgentHarness();
  const updateHarness = useUpdateAgentHarness();
  const skills = harness?.skills ?? [];
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");

  const saveSkills = (next: AgentSkill[], message?: string) => {
    updateHarness.mutate(
      { json: { skills: next } },
      {
        onSuccess: () => {
          if (message) toast.success(message);
        },
      }
    );
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    saveSkills(
      [
        ...skills,
        {
          id: newId(),
          name: trimmed,
          description: description.trim(),
          instructions: instructions.trim(),
          enabled: true,
          createdAt: nowIso(),
        },
      ],
      "Skill saved."
    );
    setName("");
    setDescription("");
    setInstructions("");
  };

  return (
    <AgentPageFrame>
      <div className="max-w-4xl mx-auto space-y-6">
        <ScreenHeader
          title="Skills"
          description="Reusable instructions the Agent can apply with the Skills tool. Toggle without noise; save to persist a new skill."
        />
        <form onSubmit={onSubmit} className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="skill-name">Name</Label>
              <Input
                id="skill-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Frontend"
                className={AGENT_FIELD_CLASS}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="skill-description">Description</Label>
              <Input
                id="skill-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="UI, React, and Fairlx tokens"
                className={AGENT_FIELD_CLASS}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="skill-instructions">Instructions</Label>
            <Textarea
              id="skill-instructions"
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              placeholder="How the Agent should apply this skill."
              className={AGENT_FIELD_CLASS}
              rows={4}
            />
          </div>
          <Button type="submit" disabled={!name.trim() || updateHarness.isPending}>
            {updateHarness.isPending ? "Saving…" : "Add skill"}
          </Button>
        </form>
        {isLoading ? (
          <LoadingState label="Loading skills…" />
        ) : skills.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title="No skills yet"
            body="Add a skill or reset the harness to restore Frontend, Backend, and DevOps starters."
          />
        ) : (
          <div className="space-y-3">
            {skills.map((skill) => (
              <div key={skill.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{skill.name}</p>
                    {skill.description ? (
                      <p className="mt-1 text-xs text-muted-foreground">{skill.description}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Switch
                      checked={skill.enabled}
                      disabled={updateHarness.isPending}
                      onCheckedChange={(enabled) =>
                        saveSkills(skills.map((item) => (item.id === skill.id ? { ...item, enabled } : item)))
                      }
                    />
                    <RemoveButton
                      label="Remove"
                      disabled={updateHarness.isPending}
                      onClick={() => saveSkills(skills.filter((item) => item.id !== skill.id), "Skill removed.")}
                    />
                  </div>
                </div>
                {skill.instructions ? (
                  <p className="mt-3 text-xs text-muted-foreground whitespace-pre-wrap">{skill.instructions}</p>
                ) : null}
                <p className="mt-2 text-[11px] text-muted-foreground">{relativeTime(skill.createdAt)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </AgentPageFrame>
  );
}

export function AgentToolsScreen() {
  const { data: harness, isLoading } = useGetAgentHarness();
  const updateHarness = useUpdateAgentHarness();
  const enabled = new Set(harness?.settings.enabledTools ?? []);

  const toggle = (id: string, next: boolean) => {
    const current = new Set(harness?.settings.enabledTools ?? []);
    if (next) current.add(id);
    else current.delete(id);
    updateHarness.mutate({ json: { settings: { enabledTools: Array.from(current) } } });
  };

  return (
    <AgentPageFrame>
      <div className="max-w-4xl mx-auto space-y-6">
        <ScreenHeader
          title="Tools"
          description="Agent mode can call enabled tools. An empty list means none. Manual mode never uses tools."
        />
        {isLoading ? (
          <LoadingState label="Loading tools…" />
        ) : (
          <div className="space-y-3">
            {AGENT_TOOL_CATALOG.map((tool) => (
              <div
                key={tool.id}
                className="rounded-xl border border-border bg-card p-4 flex items-start justify-between gap-4 shadow-sm"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <ToolCatalogIcon id={tool.id} />
                    <p className="text-sm font-semibold text-foreground">{tool.name}</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{tool.description}</p>
                </div>
                <Switch
                  checked={enabled.has(tool.id)}
                  disabled={!harness || updateHarness.isPending}
                  onCheckedChange={(checked) => toggle(tool.id, checked)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </AgentPageFrame>
  );
}

export function AgentMcpScreen() {
  const { openMcp } = useAgentUi();

  return (
    <AgentPageFrame>
      <div className="max-w-4xl mx-auto space-y-6">
        <ScreenHeader
          title="MCP servers"
          description="Connect external MCP servers (GitHub, PostgreSQL, Linear, etc.) to extend the Agent's tool capabilities. Platform and personal tools run automatically in the background."
          action={
            <Button type="button" size="sm" onClick={openMcp}>
              Manage MCP servers
            </Button>
          }
        />
        <McpServersCard />
      </div>
    </AgentPageFrame>
  );
}

export function AgentAutomationsScreen() {
  const { data: harness, isLoading } = useGetAgentHarness();
  const updateHarness = useUpdateAgentHarness();
  const automations = harness?.automations ?? [];
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [trigger, setTrigger] = useState("");
  const [action, setAction] = useState("");

  const save = (next: AgentAutomation[], message?: string) => {
    updateHarness.mutate(
      { json: { automations: next } },
      {
        onSuccess: () => {
          if (message) toast.success(message);
        },
      }
    );
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    save(
      [
        ...automations,
        {
          id: newId(),
          name: trimmed,
          description: description.trim(),
          trigger: trigger.trim(),
          action: action.trim(),
          enabled: true,
          createdAt: nowIso(),
        },
      ],
      "Automation saved."
    );
    setName("");
    setDescription("");
    setTrigger("");
    setAction("");
  };

  return (
    <AgentPageFrame>
      <div className="max-w-4xl mx-auto space-y-6">
        <ScreenHeader
          title="Automations"
          description="Named trigger/action recipes stored on your harness. The Agent can follow them while planning work."
        />
        <form onSubmit={onSubmit} className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="auto-name">Name</Label>
              <Input
                id="auto-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Triage new bugs"
                className={AGENT_FIELD_CLASS}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="auto-description">Description</Label>
              <Input
                id="auto-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="When a bug is assigned, summarize it"
                className={AGENT_FIELD_CLASS}
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="auto-trigger">Trigger</Label>
              <Input
                id="auto-trigger"
                value={trigger}
                onChange={(event) => setTrigger(event.target.value)}
                placeholder="New high-priority bug assigned to me"
                className={AGENT_FIELD_CLASS}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="auto-action">Action</Label>
              <Input
                id="auto-action"
                value={action}
                onChange={(event) => setAction(event.target.value)}
                placeholder="Inspect the item and draft a fix plan"
                className={AGENT_FIELD_CLASS}
              />
            </div>
          </div>
          <Button type="submit" disabled={!name.trim() || updateHarness.isPending}>
            {updateHarness.isPending ? "Saving…" : "Add automation"}
          </Button>
        </form>
        {isLoading ? (
          <LoadingState label="Loading automations…" />
        ) : automations.length === 0 ? (
          <EmptyState
            icon={Zap}
            title="No automations yet"
            body="Save a trigger and action the Agent should remember across runs."
          />
        ) : (
          <div className="space-y-3">
            {automations.map((item) => (
              <div key={item.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{item.name}</p>
                    {item.description ? (
                      <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <AutomationRunButton automationId={item.id} />
                    <Switch
                      checked={item.enabled}
                      disabled={updateHarness.isPending}
                      onCheckedChange={(enabled) =>
                        save(automations.map((row) => (row.id === item.id ? { ...row, enabled } : row)))
                      }
                    />
                    <RemoveButton
                      label="Remove"
                      disabled={updateHarness.isPending}
                      onClick={() => save(automations.filter((row) => row.id !== item.id), "Automation removed.")}
                    />
                  </div>
                </div>
                {item.trigger ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">Trigger:</span> {item.trigger}
                  </p>
                ) : null}
                {item.action ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">Action:</span> {item.action}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </AgentPageFrame>
  );
}

export function AgentIntegrationsScreen() {
  const { data, isLoading } = useGetAgentContext();
  const integrations = data?.integrations ?? [];
  const repos = data?.githubRepos ?? [];

  return (
    <AgentPageFrame>
      <div className="max-w-[1400px] mx-auto space-y-8">
        <ScreenHeader
          title="Integrations"
          description="Connected Fairlx integrations and GitHub repositories from your workspaces."
        />
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Connected services</h2>
          {isLoading ? (
            <LoadingState label="Loading integrations…" />
          ) : integrations.length === 0 ? (
            <EmptyState
              icon={Puzzle}
              title="No integrations yet"
              body="Connect a provider on a project and it will appear here for the Agent."
            />
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {integrations.map((item) => (
                <div key={item.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <p className="text-sm font-semibold text-foreground truncate">{item.name || item.provider || "Integration"}</p>
                  <p className="mt-1 text-xs text-muted-foreground truncate">
                    {[item.provider, item.workspaceId ? `workspace ${item.workspaceId.slice(0, 8)}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">GitHub repositories</h2>
          {isLoading ? (
            <LoadingState label="Loading repositories…" />
          ) : repos.length === 0 ? (
            <EmptyState
              icon={GitBranch}
              title="No repositories linked"
              body="Link a GitHub repo to a Fairlx project to inspect it from Agent runs."
            />
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {repos.map((repo) => {
                const label =
                  repo.repositoryName ||
                  (repo.owner && repo.repositoryName ? `${repo.owner}/${repo.repositoryName}` : repo.githubUrl) ||
                  "Repository";
                const inner = (
                  <div className="rounded-xl border border-border bg-card p-4 hover:bg-muted/40 transition-colors shadow-sm">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {repo.owner && repo.repositoryName ? `${repo.owner}/${repo.repositoryName}` : label}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground truncate">
                      {repo.branch ? `Branch ${repo.branch}` : "GitHub"}
                    </p>
                  </div>
                );
                return repo.githubUrl ? (
                  <a key={repo.id} href={repo.githubUrl} target="_blank" rel="noreferrer">
                    {inner}
                  </a>
                ) : (
                  <div key={repo.id}>{inner}</div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AgentPageFrame>
  );
}

export function AgentKnowledgeScreen() {
  const { data: harness, isLoading } = useGetAgentHarness();
  const { data: context } = useGetAgentContext();
  const updateHarness = useUpdateAgentHarness();
  const knowledge = harness?.knowledge ?? [];
  const docs = context?.docs ?? [];
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [source, setSource] = useState("");

  const save = (next: AgentKnowledgeItem[], message?: string) => {
    updateHarness.mutate(
      { json: { knowledge: next } },
      {
        onSuccess: () => {
          if (message) toast.success(message);
        },
      }
    );
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || !content.trim()) return;
    save(
      [
        ...knowledge,
        {
          id: newId(),
          title: trimmed,
          content: content.trim(),
          source: source.trim() || undefined,
          createdAt: nowIso(),
        },
      ],
      "Knowledge saved."
    );
    setTitle("");
    setContent("");
    setSource("");
  };

  return (
    <AgentPageFrame>
      <div className="max-w-4xl mx-auto space-y-6">
        <ScreenHeader
          title="Knowledge base"
          description="Notes the Agent should remember, plus Fairlx docs from your workspaces."
        />
        <form onSubmit={onSubmit} className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="kb-title">Title</Label>
              <Input
                id="kb-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Release checklist"
                className={AGENT_FIELD_CLASS}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kb-source">Source</Label>
              <Input
                id="kb-source"
                value={source}
                onChange={(event) => setSource(event.target.value)}
                placeholder="Optional URL or note"
                className={AGENT_FIELD_CLASS}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="kb-content">Content</Label>
            <Textarea
              id="kb-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Facts, constraints, or playbooks the Agent should use."
              className={AGENT_FIELD_CLASS}
              rows={5}
            />
          </div>
          <Button type="submit" disabled={!title.trim() || !content.trim() || updateHarness.isPending}>
            {updateHarness.isPending ? "Saving…" : "Add knowledge"}
          </Button>
        </form>
        {isLoading ? (
          <LoadingState label="Loading knowledge…" />
        ) : knowledge.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No saved knowledge"
            body="Add notes the Agent should keep across runs."
          />
        ) : (
          <div className="space-y-3">
            {knowledge.map((item) => (
              <div key={item.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{item.title}</p>
                    {item.source ? <p className="mt-1 text-xs text-muted-foreground truncate">{item.source}</p> : null}
                  </div>
                  <RemoveButton
                    label="Remove"
                    disabled={updateHarness.isPending}
                    onClick={() => save(knowledge.filter((row) => row.id !== item.id), "Knowledge removed.")}
                  />
                </div>
                <p className="mt-3 text-xs text-muted-foreground whitespace-pre-wrap">{item.content}</p>
                <p className="mt-2 text-[11px] text-muted-foreground">{relativeTime(item.createdAt)}</p>
              </div>
            ))}
          </div>
        )}
        {docs.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Fairlx docs</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {docs.slice(0, 12).map((doc) => (
                <div key={doc.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <p className="text-sm font-semibold text-foreground truncate">{doc.title || doc.name || "Doc"}</p>
                  {doc.description ? (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{doc.description}</p>
                  ) : null}
                  {doc.category ? <p className="mt-2 text-[11px] text-muted-foreground">{doc.category}</p> : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </AgentPageFrame>
  );
}

function WorkPatternsEditor() {
  const { data: harness, isLoading } = useGetAgentHarness();
  const updateHarness = useUpdateAgentHarness();
  const patterns = harness?.workPatterns ?? [];
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");

  const save = (next: AgentWorkPattern[], message?: string) => {
    updateHarness.mutate(
      { json: { workPatterns: next } },
      {
        onSuccess: () => {
          if (message) toast.success(message);
        },
      }
    );
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    save(
      [
        ...patterns,
        {
          id: newId(),
          name: trimmed,
          instructions: instructions.trim(),
          enabled: true,
          createdAt: nowIso(),
        },
      ],
      "Work pattern saved."
    );
    setName("");
    setInstructions("");
  };

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
        <div className="space-y-1.5">
          <Label htmlFor="pattern-name">Name</Label>
          <Input
            id="pattern-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ship small PRs"
            className={AGENT_FIELD_CLASS}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pattern-instructions">Instructions</Label>
          <Textarea
            id="pattern-instructions"
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            placeholder="How the Agent should work by default."
            className={AGENT_FIELD_CLASS}
            rows={4}
          />
        </div>
        <Button type="submit" disabled={!name.trim() || updateHarness.isPending}>
          {updateHarness.isPending ? "Saving…" : "Add work pattern"}
        </Button>
      </form>
      {isLoading ? (
        <LoadingState label="Loading work patterns…" />
      ) : patterns.length === 0 ? (
        <EmptyState
          icon={Settings}
          title="No work patterns"
          body="Add a pattern or reset the harness to restore the starter set."
        />
      ) : (
        <div className="space-y-3">
          {patterns.map((pattern) => (
            <div key={pattern.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">{pattern.name}</p>
                <div className="flex items-center gap-3 shrink-0">
                  <Switch
                    checked={pattern.enabled}
                    disabled={updateHarness.isPending}
                    onCheckedChange={(enabled) =>
                      save(patterns.map((item) => (item.id === pattern.id ? { ...item, enabled } : item)))
                    }
                  />
                  <RemoveButton
                    label="Remove"
                    disabled={updateHarness.isPending}
                    onClick={() => save(patterns.filter((item) => item.id !== pattern.id), "Work pattern removed.")}
                  />
                </div>
              </div>
              {pattern.instructions ? (
                <p className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap">{pattern.instructions}</p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AgentSettingsScreen() {
  const { data: harness, isLoading } = useGetAgentHarness();
  const { data: context } = useGetAgentContext();
  const updateHarness = useUpdateAgentHarness();
  const resetHarness = useResetAgentHarness();
  const workspaces = useMemo(() => context?.workspaces ?? [], [context?.workspaces]);
  const projects = useMemo(() => context?.projects ?? [], [context?.projects]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [projectId, setProjectId] = useState("");

  useEffect(() => {
    setWorkspaceId(harness?.settings.defaultWorkspaceId ?? "");
    setProjectId(harness?.settings.defaultProjectId ?? "");
  }, [harness?.settings.defaultWorkspaceId, harness?.settings.defaultProjectId]);

  useEffect(() => {
    const scroll = () => {
      const id = window.location.hash.replace("#", "");
      if (!id) return;
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    scroll();
    window.addEventListener("hashchange", scroll);
    return () => window.removeEventListener("hashchange", scroll);
  }, []);

  const workspaceProjects = useMemo(
    () => projects.filter((project: AgentContextProject) => !workspaceId || project.workspaceId === workspaceId),
    [projects, workspaceId]
  );

  const onWorkspaceChange = (next: string) => {
    setWorkspaceId(next);
    const stillValid = projects.some((project) => project.id === projectId && project.workspaceId === next);
    if (!stillValid) setProjectId("");
  };

  const saveDefaults = (event: FormEvent) => {
    event.preventDefault();
    updateHarness.mutate(
      {
        json: {
          settings: {
            defaultWorkspaceId: workspaceId || undefined,
            defaultProjectId: projectId || undefined,
          },
        },
      },
      {
        onSuccess: () => toast.success("Defaults saved."),
      }
    );
  };

  return (
    <AgentPageFrame>
      <div className="max-w-4xl mx-auto space-y-10">
        <ScreenHeader
          title="Settings"
          description="Harness defaults, work patterns, and a full reset of Agent data for this account."
        />

        <section className="space-y-4">
          <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Default context</h2>
          {isLoading ? (
            <LoadingState label="Loading settings…" />
          ) : (
            <form onSubmit={saveDefaults} className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="default-workspace">Default workspace</Label>
                  <select
                    id="default-workspace"
                    value={workspaceId}
                    onChange={(event) => onWorkspaceChange(event.target.value)}
                    className={selectClass}
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
                  <Label htmlFor="default-project">Default project</Label>
                  <select
                    id="default-project"
                    value={projectId}
                    onChange={(event) => setProjectId(event.target.value)}
                    className={selectClass}
                    disabled={!workspaceId}
                  >
                    <option value="">None</option>
                    {workspaceProjects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <Button type="submit" disabled={updateHarness.isPending}>
                {updateHarness.isPending ? "Saving…" : "Save defaults"}
              </Button>
            </form>
          )}
        </section>

        <section id="work-patterns" className="scroll-mt-6 space-y-4">
          <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Work patterns</h2>
          <p className="text-xs text-muted-foreground">
            Standing instructions injected into every Agent run. Toggle quietly; save a new pattern to persist it.
          </p>
          <WorkPatternsEditor />
        </section>

        <section id="reset" className="scroll-mt-6 space-y-4">
          <h2 className="text-xs font-semibold text-destructive uppercase tracking-wider">Danger Zone</h2>
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-5 space-y-3 shadow-sm">
            <p className="text-xs text-muted-foreground">
              Delete this account’s Agent runs and restore skills, automations, knowledge, and work patterns to the
              starter harness. MCP and model configs are not removed.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" size="sm" disabled={resetHarness.isPending}>
                  {resetHarness.isPending ? "Resetting…" : "Reset harness"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset the Agent harness?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This deletes your Agent runs and restores starter skills and work patterns. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => resetHarness.mutate()}>Reset</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </section>
      </div>
    </AgentPageFrame>
  );
}

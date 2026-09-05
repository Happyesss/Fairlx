"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  MessageSquare,
  Briefcase,
  FolderKanban,
  Wrench,
  BookOpen,
  Zap,
  GitBranch,
  Server,
  Search,
  Pin,
  GitMerge,
} from "lucide-react";

import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateProject } from "@/features/projects/api/use-create-project";
import { useConfirm } from "@/hooks/use-confirm";
import { cn } from "@/lib/utils";

import { useGetAgentContext } from "../api/use-agent-context";
import { useGetAgentHarness, useUpdateAgentHarness } from "../api/use-agent-harness";
import {
  useDeleteAgentRun,
  useGetAgentRuns,
  usePatchAgentRun,
} from "../api/use-agent-runs";
import { useRunAgentAutomation, useSearchAgent } from "../api/use-agent-search";
import { AGENT_CONTEXT_QUERY_KEY, AGENT_FIELD_CLASS } from "../constants";
import { relativeTime } from "../lib/agent-ui";
import { searchAgentIndex } from "../lib/search";
import type { AgentGitStageItem, AgentRun, AgentSearchHit } from "../types";
import { AgentPageFrame } from "./agent-app-shell";

function EmptyState({ icon: Icon, title, body }: { icon?: React.ComponentType<{ className?: string }>; title: string; body: string }) {
  const IconComponent = Icon || MessageSquare;
  return (
    <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center shadow-sm">
      <IconComponent className="size-6 text-primary mx-auto mb-2" />
      <p className="mt-2 text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
    </div>
  );
}

function KindIcon({ kind }: { kind: string }) {
  if (kind === "run") return <MessageSquare className="size-4 text-primary shrink-0" />;
  if (kind === "workspace") return <Briefcase className="size-4 text-primary shrink-0" />;
  if (kind === "project") return <FolderKanban className="size-4 text-primary shrink-0" />;
  if (kind === "skill") return <Wrench className="size-4 text-primary shrink-0" />;
  if (kind === "knowledge") return <BookOpen className="size-4 text-primary shrink-0" />;
  if (kind === "automation") return <Zap className="size-4 text-primary shrink-0" />;
  if (kind === "repo" || kind === "staging") return <GitBranch className="size-4 text-primary shrink-0" />;
  if (kind === "mcp") return <Server className="size-4 text-primary shrink-0" />;
  return <Search className="size-4 text-primary shrink-0" />;
}

export function SearchHits({ hits, onPick }: { hits: AgentSearchHit[]; onPick?: () => void }) {
  if (hits.length === 0) {
    return <p className="text-xs text-muted-foreground py-8 text-center">No matches found.</p>;
  }
  return (
    <div className="space-y-1">
      {hits.map((hit) => (
        <Link
          key={`${hit.kind}-${hit.id}`}
          href={hit.href}
          onClick={onPick}
          className="flex items-start gap-3 rounded-lg px-3 py-2 hover:bg-muted/50 transition-colors"
        >
          <div className="mt-0.5">
            <KindIcon kind={hit.kind} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-foreground truncate">{hit.title}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{hit.meta}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function AgentSearchScreen() {
  const [query, setQuery] = useState("");
  const { data: remoteHits, isFetching } = useSearchAgent(query);
  const { data: runs } = useGetAgentRuns();
  const { data: harness } = useGetAgentHarness();
  const { data: context } = useGetAgentContext();
  const localHits = useMemo(
    () =>
      searchAgentIndex({
        query,
        runs: runs ?? [],
        harness,
        context,
        limit: 40,
      }),
    [context, harness, query, runs],
  );
  const hits = query.trim() ? remoteHits ?? localHits : localHits.slice(0, 12);

  return (
    <AgentPageFrame>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Search</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Search chats, workspaces, projects, skills, knowledge, automations, docs, repos, MCP, and staging.
          </p>
        </div>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search the Agent harness…"
          className={AGENT_FIELD_CLASS}
          autoFocus
        />
        {isFetching && query.trim() ? (
          <p className="text-xs text-muted-foreground">Searching…</p>
        ) : (
          <div className="bg-card border border-border rounded-xl p-3 shadow-sm">
            <SearchHits hits={hits} />
          </div>
        )}
      </div>
    </AgentPageFrame>
  );
}

function ChatRow({
  run,
  pinned,
  onPin,
  onDelete,
  onRename,
}: {
  run: AgentRun;
  pinned: boolean;
  onPin: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(run.title);

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 flex items-start gap-3 shadow-sm hover:bg-muted/30 transition-colors">
      <div className="min-w-0 flex-1">
        {editing ? (
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onRename(title);
                setEditing(false);
              }
            }}
            className={cn("h-8", AGENT_FIELD_CLASS)}
          />
        ) : (
          <Link href={`/agent/workflow?runId=${run.id}`} className="block">
            <p className="text-sm font-semibold text-foreground truncate flex items-center gap-1.5">
              {pinned ? <Pin className="size-3.5 fill-primary text-primary shrink-0" /> : null}
              <span>{run.title}</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground capitalize">
              {run.status} · {relativeTime(run.updatedAt)}
            </p>
          </Link>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1.5"
          onClick={onPin}
        >
          <Pin className={cn("size-3.5", pinned && "fill-primary text-primary")} />
          <span>{pinned ? "Unpin" : "Pin"}</span>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => {
            if (editing) {
              onRename(title);
              setEditing(false);
            } else {
              setEditing(true);
            }
          }}
        >
          {editing ? "Save" : "Rename"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          Delete
        </Button>
      </div>
    </div>
  );
}

export function AgentChatsScreen() {
  const { data: runs, isLoading } = useGetAgentRuns();
  const { data: harness } = useGetAgentHarness();
  const updateHarness = useUpdateAgentHarness();
  const patchRun = usePatchAgentRun();
  const deleteRun = useDeleteAgentRun();
  const [DeleteDialog, confirmDelete] = useConfirm(
    "Delete Run",
    "Are you sure you want to delete this chat run? This action cannot be undone.",
    "destructive"
  );
  const pinned = new Set(harness?.chatMeta?.pinnedRunIds ?? []);
  const archived = new Set(harness?.chatMeta?.archivedRunIds ?? []);
  const visible = (runs ?? []).filter((run) => !archived.has(run.id));
  const pinnedRuns = visible.filter((run) => pinned.has(run.id));
  const otherRuns = visible.filter((run) => !pinned.has(run.id));

  const setPinned = (runId: string, next: boolean) => {
    const current = harness?.chatMeta?.pinnedRunIds ?? [];
    updateHarness.mutate({
      json: {
        chatMeta: {
          pinnedRunIds: next ? [...current.filter((id) => id !== runId), runId] : current.filter((id) => id !== runId),
          archivedRunIds: harness?.chatMeta?.archivedRunIds ?? [],
        },
      },
    });
  };

  const handleDelete = async (runId: string) => {
    const ok = await confirmDelete();
    if (!ok) return;
    deleteRun.mutate(
      { runId },
      {
        onSuccess: () => {
          toast.success("Chat deleted");
        },
      }
    );
  };

  return (
    <AgentPageFrame>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Chats</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Pin, rename, or delete Agent runs. Archived chats stay off this list.
          </p>
        </div>
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading chats…</p>
        ) : visible.length === 0 ? (
          <EmptyState title="No chats yet" body="Start an agent run from Agent Home." />
        ) : (
          <div className="space-y-6">
            {pinnedRuns.length > 0 ? (
              <section className="space-y-2">
                <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Pinned</h2>
                {pinnedRuns.map((run) => (
                  <ChatRow
                    key={run.id}
                    run={run}
                    pinned
                    onPin={() => setPinned(run.id, false)}
                    onDelete={() => handleDelete(run.id)}
                    onRename={(title) => patchRun.mutate({ param: { runId: run.id }, json: { title } })}
                  />
                ))}
              </section>
            ) : null}
            <section className="space-y-2">
              <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Recent</h2>
              {otherRuns.map((run) => (
                <ChatRow
                  key={run.id}
                  run={run}
                  pinned={false}
                  onPin={() => setPinned(run.id, true)}
                  onDelete={() => handleDelete(run.id)}
                  onRename={(title) => patchRun.mutate({ param: { runId: run.id }, json: { title } })}
                />
              ))}
            </section>
          </div>
        )}
      </div>
      <DeleteDialog />
    </AgentPageFrame>
  );
}

export function AgentGitScreen() {
  const { data: context, isLoading } = useGetAgentContext();
  const { data: harness } = useGetAgentHarness();
  const updateHarness = useUpdateAgentHarness();
  const repos = context?.githubRepos ?? [];
  const items = harness?.gitStaging?.items ?? [];
  const [path, setPath] = useState("");
  const [summary, setSummary] = useState("");
  const [message, setMessage] = useState("");

  const saveStaging = (nextItems: AgentGitStageItem[], toastMessage?: string) => {
    updateHarness.mutate(
      {
        json: {
          gitStaging: { items: nextItems, updatedAt: new Date().toISOString() },
        },
      },
      {
        onSuccess: () => {
          if (toastMessage) toast.success(toastMessage);
        },
      },
    );
  };

  return (
    <AgentPageFrame>
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Git & Staging</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Linked GitHub repositories. The Agent commits and opens PRs through the GitHub API after Accept — never git on the Fairlx host.
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Repositories</h2>
          {isLoading ? (
            <p className="text-xs text-muted-foreground">Loading repositories…</p>
          ) : repos.length === 0 ? (
            <EmptyState
              icon={GitBranch}
              title="No repositories linked"
              body="Link a GitHub repo on a project, or connect a PAT in Agent plugins, so the Agent can read files and open PRs."
            />
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {repos.map((repo) => {
                const label =
                  repo.owner && repo.repositoryName
                    ? `${repo.owner}/${repo.repositoryName}`
                    : repo.repositoryName || "Repository";
                const inner = (
                  <div className="rounded-xl border border-border bg-card p-4 hover:bg-muted/40 transition-colors shadow-sm">
                    <p className="text-sm font-semibold text-foreground truncate">{label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{repo.branch ? `Branch ${repo.branch}` : "GitHub"}</p>
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

        <section className="space-y-4">
          <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Staging</h2>
          <form
            className="rounded-xl border border-border bg-card p-5 grid sm:grid-cols-[1fr_1fr_auto] gap-3 shadow-sm"
            onSubmit={(event) => {
              event.preventDefault();
              if (!path.trim()) return;
              saveStaging(
                [
                  ...items.filter((item) => item.path !== path.trim()),
                  {
                    id: crypto.randomUUID(),
                    path: path.trim(),
                    summary: summary.trim() || path.trim(),
                    status: "staged",
                    createdAt: new Date().toISOString(),
                  },
                ],
                "Change staged.",
              );
              setPath("");
              setSummary("");
            }}
          >
            <Input
              value={path}
              onChange={(event) => setPath(event.target.value)}
              placeholder="path/to/file.ts"
              className={AGENT_FIELD_CLASS}
            />
            <Input
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              placeholder="What changed"
              className={AGENT_FIELD_CLASS}
            />
            <Button type="submit" disabled={!path.trim() || updateHarness.isPending}>
              Stage
            </Button>
          </form>
          {items.length === 0 ? (
            <EmptyState icon={GitMerge} title="Nothing staged" body="Stage a planned change for the Agent to track." />
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-3 shadow-sm"
                >
                  <span
                    className={cn(
                      "text-[11px] uppercase tracking-wide font-semibold",
                      item.status === "staged"
                        ? "text-green-500"
                        : item.status === "committed"
                          ? "text-primary"
                          : "text-muted-foreground",
                    )}
                  >
                    {item.status}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-foreground truncate">{item.path}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{item.summary}</p>
                  </div>
                  {item.status !== "committed" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-xs text-muted-foreground hover:text-foreground h-7"
                      onClick={() =>
                        saveStaging(
                          items.map((row) =>
                            row.id === item.id
                              ? { ...row, status: row.status === "staged" ? "unstaged" : "staged" }
                              : row,
                          ),
                        )
                      }
                    >
                      {item.status === "staged" ? "Unstage" : "Stage"}
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const staged = items.filter((item) => item.status === "staged");
              if (staged.length === 0) return;
              saveStaging(
                items.map((item) => (item.status === "staged" ? { ...item, status: "committed" } : item)),
                message.trim() || "Commit planned.",
              );
              setMessage("");
            }}
          >
            <Input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Commit message for staged changes"
              className={AGENT_FIELD_CLASS}
            />
            <Button type="submit" disabled={items.every((item) => item.status !== "staged") || updateHarness.isPending}>
              Plan commit
            </Button>
          </form>
        </section>
      </div>
    </AgentPageFrame>
  );
}

export function AgentNewProjectForm({
  onCreated,
}: {
  onCreated?: () => void;
}) {
  const router = useRouter();
  const { data } = useGetAgentContext();
  const { data: harness } = useGetAgentHarness();
  const createProject = useCreateProject();
  const queryClient = useQueryClient();
  const workspaces = useMemo(() => data?.workspaces ?? [], [data?.workspaces]);
  const [workspaceId, setWorkspaceId] = useState(harness?.settings.defaultWorkspaceId || workspaces[0]?.id || "");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!workspaceId) setWorkspaceId(harness?.settings.defaultWorkspaceId || workspaces[0]?.id || "");
  }, [harness?.settings.defaultWorkspaceId, workspaceId, workspaces]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || !workspaceId) return;
    createProject.mutate(
      { form: { name: trimmed, workspaceId, description: description.trim() || undefined } },
      {
        onSuccess: (result) => {
          queryClient.invalidateQueries({ queryKey: AGENT_CONTEXT_QUERY_KEY });
          setName("");
          setDescription("");
          onCreated?.();
          const project = (result as { data?: { $id?: string } }).data;
          if (project?.$id) {
            router.push(`/workspaces/${workspaceId}/projects/${project.$id}`);
          }
        },
      },
    );
  };

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="new-project-workspace">Workspace</Label>
          <select
            id="new-project-workspace"
            value={workspaceId}
            onChange={(event) => setWorkspaceId(event.target.value)}
            className={cn("h-10 w-full rounded-md px-3 text-sm outline-none", AGENT_FIELD_CLASS)}
          >
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-project-name">Name</Label>
          <Input
            id="new-project-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Website Redesign"
            className={AGENT_FIELD_CLASS}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new-project-description">Description</Label>
        <Textarea
          id="new-project-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className={AGENT_FIELD_CLASS}
          rows={3}
        />
      </div>
      <Button type="submit" disabled={!name.trim() || !workspaceId || createProject.isPending}>
        {createProject.isPending ? "Creating…" : "Create project"}
      </Button>
    </form>
  );
}

export function AutomationRunButton({ automationId }: { automationId: string }) {
  const router = useRouter();
  const runAutomation = useRunAgentAutomation();
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={runAutomation.isPending}
      onClick={() =>
        runAutomation.mutate(
          { automationId },
          {
            onSuccess: (result) => {
              toast.success("Automation started.");
              router.push(`/agent/workflow?runId=${result.data.id}`);
            },
          },
        )
      }
    >
      {runAutomation.isPending ? "Starting…" : "Run"}
    </Button>
  );
}

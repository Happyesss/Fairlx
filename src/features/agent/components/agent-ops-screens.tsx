"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateProject } from "@/features/projects/api/use-create-project";
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

function EmptyState({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-fairlx-border bg-fairlx-surface px-6 py-12 text-center">
      <i className={`${icon} text-fairlx-primary text-lg`} />
      <p className="mt-3 text-sm font-medium text-white">{title}</p>
      <p className="mt-1 text-sm text-fairlx-text-muted">{body}</p>
    </div>
  );
}

function kindIcon(kind: string) {
  if (kind === "run") return "fa-regular fa-comments";
  if (kind === "workspace") return "fa-solid fa-border-all";
  if (kind === "project") return "fa-regular fa-folder";
  if (kind === "skill") return "fa-solid fa-bullseye";
  if (kind === "knowledge") return "fa-regular fa-book";
  if (kind === "automation") return "fa-solid fa-bolt";
  if (kind === "repo" || kind === "staging") return "fa-brands fa-git-alt";
  if (kind === "mcp") return "fa-solid fa-server";
  return "fa-solid fa-magnifying-glass";
}

export function SearchHits({ hits, onPick }: { hits: AgentSearchHit[]; onPick?: () => void }) {
  if (hits.length === 0) {
    return <p className="text-sm text-fairlx-text-muted py-8 text-center">No matches.</p>;
  }
  return (
    <div className="space-y-1">
      {hits.map((hit) => (
        <Link
          key={`${hit.kind}-${hit.id}`}
          href={hit.href}
          onClick={onPick}
          className="flex items-start gap-3 rounded-lg px-3 py-2 hover:bg-fairlx-surface-hover"
        >
          <i className={`${kindIcon(hit.kind)} mt-1 text-fairlx-primary w-4 text-center`} />
          <div className="min-w-0">
            <p className="text-sm text-white truncate">{hit.title}</p>
            <p className="text-xs text-fairlx-text-muted">{hit.meta}</p>
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
          <h1 className="text-2xl font-semibold text-white">Search</h1>
          <p className="mt-1 text-sm text-fairlx-text-muted">
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
          <p className="text-sm text-fairlx-text-muted">Searching…</p>
        ) : (
          <SearchHits hits={hits} />
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
    <div className="rounded-xl border border-fairlx-border bg-fairlx-surface px-4 py-3 flex items-start gap-3">
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
            <p className="text-sm font-medium text-white truncate">
              {pinned ? <i className="fa-solid fa-thumbtack mr-2 text-fairlx-primary" /> : null}
              {run.title}
            </p>
            <p className="mt-1 text-xs text-fairlx-text-muted">
              {run.status} · {relativeTime(run.updatedAt)}
            </p>
          </Link>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button type="button" className="text-xs text-fairlx-text-muted hover:text-white" onClick={onPin}>
          {pinned ? "Unpin" : "Pin"}
        </button>
        <button
          type="button"
          className="text-xs text-fairlx-text-muted hover:text-white"
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
        </button>
        <button type="button" className="text-xs text-red-400 hover:text-red-300" onClick={onDelete}>
          Delete
        </button>
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

  return (
    <AgentPageFrame>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Chats</h1>
          <p className="mt-1 text-sm text-fairlx-text-muted">
            Pin, rename, or delete Agent runs. Archived chats stay off this list.
          </p>
        </div>
        {isLoading ? (
          <p className="text-sm text-fairlx-text-muted">Loading chats…</p>
        ) : visible.length === 0 ? (
          <EmptyState icon="fa-regular fa-comments" title="No chats yet" body="Start a run from Agent Home." />
        ) : (
          <div className="space-y-6">
            {pinnedRuns.length > 0 ? (
              <section className="space-y-2">
                <h2 className="text-sm font-semibold text-white">Pinned</h2>
                {pinnedRuns.map((run) => (
                  <ChatRow
                    key={run.id}
                    run={run}
                    pinned
                    onPin={() => setPinned(run.id, false)}
                    onDelete={() => deleteRun.mutate({ runId: run.id })}
                    onRename={(title) => patchRun.mutate({ param: { runId: run.id }, json: { title } })}
                  />
                ))}
              </section>
            ) : null}
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-white">Recent</h2>
              {otherRuns.map((run) => (
                <ChatRow
                  key={run.id}
                  run={run}
                  pinned={false}
                  onPin={() => setPinned(run.id, true)}
                  onDelete={() => deleteRun.mutate({ runId: run.id })}
                  onRename={(title) => patchRun.mutate({ param: { runId: run.id }, json: { title } })}
                />
              ))}
            </section>
          </div>
        )}
      </div>
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
          <h1 className="text-2xl font-semibold text-white">Git & staging</h1>
          <p className="mt-1 text-sm text-fairlx-text-muted">
            Linked GitHub repositories plus a Cursor-style staging buffer. Planned commits are recorded here and never
            executed on the Fairlx host.
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-white">Repositories</h2>
          {isLoading ? (
            <p className="text-sm text-fairlx-text-muted">Loading repositories…</p>
          ) : repos.length === 0 ? (
            <EmptyState
              icon="fa-brands fa-github"
              title="No repositories linked"
              body="Link a GitHub repo on a project to inspect it from Agent mode."
            />
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {repos.map((repo) => {
                const label =
                  repo.owner && repo.repositoryName
                    ? `${repo.owner}/${repo.repositoryName}`
                    : repo.repositoryName || "Repository";
                const inner = (
                  <div className="rounded-xl border border-fairlx-border bg-fairlx-surface px-4 py-4">
                    <p className="text-sm font-medium text-white truncate">{label}</p>
                    <p className="mt-1 text-xs text-fairlx-text-muted">{repo.branch ? `Branch ${repo.branch}` : "GitHub"}</p>
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
          <h2 className="text-sm font-semibold text-white">Staging</h2>
          <form
            className="rounded-xl border border-fairlx-border bg-fairlx-surface p-5 grid sm:grid-cols-[1fr_1fr_auto] gap-3"
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
            <EmptyState icon="fa-solid fa-code-commit" title="Nothing staged" body="Stage a planned change for the Agent to track." />
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-fairlx-border bg-fairlx-surface px-4 py-3 flex items-center gap-3"
                >
                  <span
                    className={cn(
                      "text-[11px] uppercase tracking-wide",
                      item.status === "staged"
                        ? "text-green-400"
                        : item.status === "committed"
                          ? "text-fairlx-primary"
                          : "text-fairlx-text-muted",
                    )}
                  >
                    {item.status}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white truncate">{item.path}</p>
                    <p className="text-xs text-fairlx-text-muted truncate">{item.summary}</p>
                  </div>
                  {item.status !== "committed" ? (
                    <button
                      type="button"
                      className="text-xs text-fairlx-text-muted hover:text-white"
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
                    </button>
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
    <form onSubmit={onSubmit} className="rounded-xl border border-fairlx-border bg-fairlx-surface p-5 space-y-4">
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
            placeholder="Website"
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

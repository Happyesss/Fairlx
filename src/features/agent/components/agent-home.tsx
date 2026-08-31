"use client";

import Link from "next/link";
import { FolderKanban, Briefcase, ChevronRight } from "lucide-react";

import { useCurrent } from "@/features/auth/api/use-current";

import { useGetAgentContext } from "../api/use-agent-context";
import { useGetAgentRuns } from "../api/use-agent-runs";
import { firstName, greetingForNow, relativeTime } from "../lib/agent-ui";
import { AgentCommandInput } from "./agent-command-input";
import { AgentPageFrame } from "./agent-app-shell";
import { McpServersCard } from "./mcp-servers-card";
import { useAgentUi } from "./agent-ui-context";

export function AgentHome() {
  const { data: user } = useCurrent();
  const { data: context, isLoading: contextLoading } = useGetAgentContext();
  const { data: runs, isLoading: runsLoading } = useGetAgentRuns();
  const { openRecentWork } = useAgentUi();
  const workspaces = context?.workspaces ?? [];
  const projects = context?.projects ?? [];
  const workItems = context?.workItems ?? [];

  return (
    <AgentPageFrame>
      <div className="max-w-[1300px] mx-auto grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {greetingForNow()}, {firstName(user?.name, user?.email)}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Start an agent run, inspect work across your workspace, or search code and documentation.
            </p>
          </div>

          <AgentCommandInput />

          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Workspaces</h2>
              <Link href="/agent/workspaces" className="text-xs text-primary hover:underline font-medium">
                View all
              </Link>
            </div>
            {contextLoading ? (
              <p className="text-sm text-muted-foreground">Loading workspaces…</p>
            ) : workspaces.length === 0 ? (
              <p className="text-sm text-muted-foreground">No workspaces yet. Create one to get started.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {workspaces.slice(0, 4).map((workspace) => (
                  <Link
                    key={workspace.id}
                    href={`/workspaces/${workspace.id}`}
                    className="rounded-xl border border-border bg-card p-4 hover:bg-muted/40 transition-colors group flex flex-col justify-between shadow-sm"
                  >
                    <div className="flex items-center gap-2.5">
                      <Briefcase className="size-4 text-primary shrink-0" />
                      <div className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                        {workspace.name}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-3 flex items-center justify-between">
                      <span>Open Workspace</span>
                      <ChevronRight className="size-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Projects</h2>
              <Link href="/agent/projects" className="text-xs text-primary hover:underline font-medium">
                View all
              </Link>
            </div>
            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No projects in your workspaces yet.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {projects.slice(0, 4).map((project) => (
                  <Link
                    key={project.id}
                    href={`/workspaces/${project.workspaceId}/projects/${project.id}`}
                    className="rounded-xl border border-border bg-card p-4 hover:bg-muted/40 transition-colors group flex flex-col justify-between shadow-sm"
                  >
                    <div className="flex items-center gap-2.5">
                      <FolderKanban className="size-4 text-blue-500 shrink-0" />
                      <div className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                        {project.name}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-3 flex items-center justify-between">
                      <span>{[project.key, project.status].filter(Boolean).join(" · ") || "Project"}</span>
                      <ChevronRight className="size-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <McpServersCard />

          <section className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground text-sm uppercase tracking-wider">Recent Runs</h3>
              <Link href="/agent/chats" className="text-xs text-primary hover:underline font-medium">
                View all
              </Link>
            </div>
            {runsLoading ? (
              <p className="text-sm text-muted-foreground">Loading runs…</p>
            ) : (runs ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">No Agent runs yet. Send a prompt to get started.</p>
            ) : (
              <div className="space-y-1.5">
                {(runs ?? []).slice(0, 6).map((run) => (
                  <Link
                    key={run.id}
                    href={`/agent/workflow?runId=${run.id}`}
                    className="block rounded-lg px-2.5 py-2 hover:bg-muted/50 transition-colors"
                  >
                    <div className="text-xs font-medium text-foreground truncate">{run.title}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 capitalize">
                      {run.status} · {relativeTime(run.updatedAt)}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground text-sm uppercase tracking-wider">Assigned Work</h3>
              <button type="button" onClick={openRecentWork} className="text-xs text-primary hover:underline font-medium">
                View all
              </button>
            </div>
            {workItems.length === 0 ? (
              <p className="text-xs text-muted-foreground">No work items assigned to you.</p>
            ) : (
              <div className="space-y-1.5">
                {workItems.slice(0, 6).map((item) => (
                  <Link
                    key={item.id}
                    href={item.workspaceId ? `/workspaces/${item.workspaceId}/tasks/${item.id}` : "/agent/projects"}
                    className="block rounded-lg px-2.5 py-2 hover:bg-muted/50 transition-colors"
                  >
                    <div className="text-xs font-medium text-foreground truncate">{item.title}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {[item.key, item.status, item.priority].filter(Boolean).join(" · ")}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </AgentPageFrame>
  );
}

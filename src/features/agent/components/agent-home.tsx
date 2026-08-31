"use client";

import Link from "next/link";

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
      <div className="max-w-[1400px] mx-auto grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div>
            <h1 className="text-3xl font-semibold text-white">
              {greetingForNow()}, {firstName(user?.name, user?.email)}
            </h1>
            <p className="mt-2 text-sm text-fairlx-text-muted">
              Start a run, inspect Fairlx work, or open a workspace. The Agent uses live data — not mock screens.
            </p>
          </div>
          <AgentCommandInput />
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white">Workspaces</h2>
              <Link href="/agent/workspaces" className="text-xs text-fairlx-primary hover:underline">
                View all
              </Link>
            </div>
            {contextLoading ? (
              <p className="text-sm text-fairlx-text-muted">Loading workspaces…</p>
            ) : workspaces.length === 0 ? (
              <p className="text-sm text-fairlx-text-muted">No workspaces yet. Use + in the command bar to create one.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {workspaces.slice(0, 4).map((workspace) => (
                  <Link
                    key={workspace.id}
                    href={`/workspaces/${workspace.id}`}
                    className="rounded-xl border border-fairlx-border bg-fairlx-surface px-4 py-4 hover:bg-fairlx-surface-hover"
                  >
                    <div className="text-sm font-medium text-white truncate">{workspace.name}</div>
                    <div className="text-xs text-fairlx-text-muted mt-1">Open workspace</div>
                  </Link>
                ))}
              </div>
            )}
          </section>
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white">Projects</h2>
              <Link href="/agent/projects" className="text-xs text-fairlx-primary hover:underline">
                View all
              </Link>
            </div>
            {projects.length === 0 ? (
              <p className="text-sm text-fairlx-text-muted">No projects in your workspaces yet.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {projects.slice(0, 4).map((project) => (
                  <Link
                    key={project.id}
                    href={`/workspaces/${project.workspaceId}/projects/${project.id}`}
                    className="rounded-xl border border-fairlx-border bg-fairlx-surface px-4 py-4 hover:bg-fairlx-surface-hover"
                  >
                    <div className="text-sm font-medium text-white truncate">{project.name}</div>
                    <div className="text-xs text-fairlx-text-muted mt-1">
                      {[project.key, project.status].filter(Boolean).join(" · ") || "Project"}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
        <div className="space-y-6">
          <McpServersCard />
          <section className="bg-fairlx-surface border border-fairlx-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white">Recent runs</h3>
              <button type="button" onClick={openRecentWork} className="text-xs text-fairlx-primary hover:underline">
                View all
              </button>
            </div>
            {runsLoading ? (
              <p className="text-sm text-fairlx-text-muted">Loading runs…</p>
            ) : (runs ?? []).length === 0 ? (
              <p className="text-sm text-fairlx-text-muted">No Agent runs yet. Send a prompt to start the harness.</p>
            ) : (
              <div className="space-y-2">
                {(runs ?? []).slice(0, 6).map((run) => (
                  <Link
                    key={run.id}
                    href={`/agent/workflow?runId=${run.id}`}
                    className="block rounded-lg px-2 py-2 hover:bg-fairlx-surface-hover"
                  >
                    <div className="text-sm text-fairlx-text truncate">{run.title}</div>
                    <div className="text-[11px] text-fairlx-text-muted">
                      {run.status} · {relativeTime(run.updatedAt)}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
          <section className="bg-fairlx-surface border border-fairlx-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white">Assigned work</h3>
              <button type="button" onClick={openRecentWork} className="text-xs text-fairlx-primary hover:underline">
                View all recent work items
              </button>
            </div>
            {workItems.length === 0 ? (
              <p className="text-sm text-fairlx-text-muted">No work items assigned to you.</p>
            ) : (
              <div className="space-y-2">
                {workItems.slice(0, 6).map((item) => (
                  <Link
                    key={item.id}
                    href={item.workspaceId ? `/workspaces/${item.workspaceId}/tasks/${item.id}` : "/agent/projects"}
                    className="block rounded-lg px-2 py-2 hover:bg-fairlx-surface-hover"
                  >
                    <div className="text-sm text-fairlx-text truncate">{item.title}</div>
                    <div className="text-[11px] text-fairlx-text-muted">
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

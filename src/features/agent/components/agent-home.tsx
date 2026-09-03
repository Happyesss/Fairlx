"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { useCurrent } from "@/features/auth/api/use-current";
import { ProjectAvatar } from "@/features/projects/components/project-avatar";

import { useGetAgentContext } from "../api/use-agent-context";
import { useGetAgentRuns } from "../api/use-agent-runs";
import { useGetAgentHarness } from "../api/use-agent-harness";
import { firstName, greetingForNow, relativeTime } from "../lib/agent-ui";
import { isPersonalSessionMode } from "../lib/session-context";
import { AgentCommandInput } from "./agent-command-input";
import { AgentPageFrame } from "./agent-app-shell";
import { DailyCockpit } from "./daily-cockpit";
import { useAgentUi } from "./agent-ui-context";
import { useGetPersonalAgent } from "../api/use-personal-agent";
import { profileIsTrained } from "../lib/personal-agent-status";

export function AgentHome() {
  const { data: user } = useCurrent();
  const { data: context } = useGetAgentContext();
  const { data: runs, isLoading: runsLoading } = useGetAgentRuns();
  const { data: harness } = useGetAgentHarness();
  const { data: personal } = useGetPersonalAgent();
  const { openRecentWork } = useAgentUi();
  const projects = context?.projects ?? [];
  const workItems = context?.workItems ?? [];
  const trained = profileIsTrained(personal?.profile);
  const personalUntrained = isPersonalSessionMode(harness?.settings.sessionMode) && !trained;

  return (
    <AgentPageFrame>
      <div className="max-w-[1300px] mx-auto grid lg:grid-cols-3 gap-8 min-h-[calc(100vh-7.5rem)]">
        <div className="lg:col-span-2 flex flex-col justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {greetingForNow()}, {firstName(user?.name, user?.email)}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Start an agent run, inspect work across your workspace, or search code and documentation.
            </p>
          </div>

          <div className="text-center py-4 my-auto">
            <p className="text-base sm:text-lg font-medium text-muted-foreground/75 tracking-tight">
              {personalUntrained
                ? "I'm here to help you — train me first, then tell me what to ship."
                : "What would you like to build, investigate, or ship today?"}
            </p>
          </div>

          <div className="space-y-6">
            <div>
              <AgentCommandInput />
            </div>

            <section className="pt-1">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Projects</h2>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {projects.length}
                  </span>
                </div>
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
                      <ProjectAvatar name={project.name} image={project.imageUrl} className="size-6 shrink-0" />
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
        </div>

        <div className="space-y-6">
          <DailyCockpit />
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

          {trained ? null : (
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
          )}
        </div>
      </div>
    </AgentPageFrame>
  );
}

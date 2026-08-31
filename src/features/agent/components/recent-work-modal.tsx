"use client";

import { useMemo } from "react";
import Link from "next/link";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useGetAgentRuns } from "../api/use-agent-runs";
import { AGENT_TOOL_CATALOG } from "../constants";
import { relativeTime } from "../lib/agent-ui";
import type { AgentToolEvent } from "../types";

const TAB_FILTERS: Record<string, (event: AgentToolEvent) => boolean> = {
  everything: () => true,
  code_inspect: (event) => event.type === "code_inspect",
  terminal: (event) => event.type === "terminal",
  file_search: (event) => event.type === "file_search",
  web_search: (event) => event.type === "web_search",
  database: (event) =>
    event.type === "database_query" ||
    event.type === "list_workspaces" ||
    event.type === "list_projects" ||
    event.type === "list_work_items",
  skills: (event) => event.type === "use_skill",
};

function toolIcon(type: string) {
  return AGENT_TOOL_CATALOG.find((tool) => tool.id === type)?.icon ?? "fa-solid fa-circle-nodes";
}

function EventRow({ event, runTitle }: { event: AgentToolEvent; runTitle: string }) {
  return (
    <div className="rounded-lg border border-fairlx-border bg-fairlx-bg px-3 py-3">
      <div className="flex items-start gap-3">
        <i className={`${toolIcon(event.type)} mt-0.5 text-fairlx-primary`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-white truncate">{event.title}</p>
            <span className="text-[11px] text-fairlx-text-muted shrink-0">
              {relativeTime(event.createdAt)}
            </span>
          </div>
          {event.detail ? (
            <p className="mt-1 text-xs text-fairlx-text-muted whitespace-pre-wrap">{event.detail}</p>
          ) : null}
          <Link
            href={`/agent/workflow?runId=${event.runId}`}
            className="mt-2 inline-block text-[11px] text-fairlx-primary hover:underline"
          >
            {runTitle}
          </Link>
        </div>
      </div>
    </div>
  );
}

export function RecentWorkModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: runs, isLoading } = useGetAgentRuns();
  const events = useMemo(
    () =>
      (runs ?? [])
        .flatMap((run) =>
          (run.events ?? []).map((event) => ({
            event,
            runTitle: run.title,
          }))
        )
        .sort((a, b) => b.event.createdAt.localeCompare(a.event.createdAt)),
    [runs]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dark bg-fairlx-surface text-fairlx-text border-fairlx-border max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Recent work</DialogTitle>
          <DialogDescription className="text-fairlx-text-muted">
            Code inspector, terminal, searches, database queries, skills, and every harness event.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="everything" className="min-h-0 flex-1 flex flex-col">
          <TabsList className="bg-fairlx-bg border border-fairlx-border justify-start overflow-x-auto w-full h-auto flex-wrap">
            <TabsTrigger value="everything">Everything</TabsTrigger>
            <TabsTrigger value="code_inspect">Code inspector</TabsTrigger>
            <TabsTrigger value="terminal">Terminal</TabsTrigger>
            <TabsTrigger value="file_search">File search</TabsTrigger>
            <TabsTrigger value="web_search">Web search</TabsTrigger>
            <TabsTrigger value="database">Database</TabsTrigger>
            <TabsTrigger value="skills">Skills</TabsTrigger>
          </TabsList>
          {Object.keys(TAB_FILTERS).map((tab) => {
            const filtered = events.filter(({ event }) => TAB_FILTERS[tab](event));
            return (
              <TabsContent key={tab} value={tab} className="mt-4 overflow-y-auto custom-scrollbar max-h-[52vh] space-y-2">
                {isLoading ? (
                  <p className="text-sm text-fairlx-text-muted py-8 text-center">Loading harness activity…</p>
                ) : tab === "everything" && filtered.length === 0 ? (
                  <div className="space-y-2">
                    {(runs ?? []).length === 0 ? (
                      <p className="text-sm text-fairlx-text-muted py-8 text-center">
                        No recent work yet. Start a run from Agent Home.
                      </p>
                    ) : (
                      (runs ?? []).map((run) => (
                        <Link
                          key={run.id}
                          href={`/agent/workflow?runId=${run.id}`}
                          className="block rounded-lg border border-fairlx-border px-3 py-3 hover:bg-fairlx-surface-hover"
                        >
                          <div className="text-sm text-white truncate">{run.title}</div>
                          <div className="text-xs text-fairlx-text-muted">
                            {run.status} · {relativeTime(run.updatedAt)}
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                ) : filtered.length === 0 ? (
                  <p className="text-sm text-fairlx-text-muted py-8 text-center">No events in this view yet.</p>
                ) : (
                  filtered.map(({ event, runTitle }) => (
                    <EventRow key={event.id} event={event} runTitle={runTitle} />
                  ))
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

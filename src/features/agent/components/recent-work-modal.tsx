"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Code, Terminal, Search, Globe, Database, Wrench, Activity } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useGetAgentRuns } from "../api/use-agent-runs";
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

function ToolEventIcon({ type }: { type: string }) {
  if (type === "code_inspect") return <Code className="size-4 text-primary shrink-0" />;
  if (type === "terminal") return <Terminal className="size-4 text-primary shrink-0" />;
  if (type === "file_search") return <Search className="size-4 text-primary shrink-0" />;
  if (type === "web_search") return <Globe className="size-4 text-primary shrink-0" />;
  if (type === "use_skill") return <Wrench className="size-4 text-primary shrink-0" />;
  if (type.includes("database") || type.includes("list_")) return <Database className="size-4 text-primary shrink-0" />;
  return <Activity className="size-4 text-primary shrink-0" />;
}

function EventRow({ event, runTitle }: { event: AgentToolEvent; runTitle: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          <ToolEventIcon type={event.type} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-foreground truncate">{event.title}</p>
            <span className="text-[11px] text-muted-foreground shrink-0 font-medium">
              {relativeTime(event.createdAt)}
            </span>
          </div>
          {event.detail ? (
            <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">{event.detail}</p>
          ) : null}
          <Link
            href={`/agent/workflow?runId=${event.runId}`}
            className="mt-2 inline-block text-[11px] font-medium text-primary hover:underline"
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
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Recent work</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Code inspector, terminal, searches, database queries, skills, and every harness event.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="everything" className="min-h-0 flex-1 flex flex-col">
          <TabsList className="bg-muted border border-border justify-start overflow-x-auto w-full h-auto flex-wrap gap-1 p-1">
            <TabsTrigger value="everything" className="text-xs">Everything</TabsTrigger>
            <TabsTrigger value="code_inspect" className="text-xs">Code inspector</TabsTrigger>
            <TabsTrigger value="terminal" className="text-xs">Terminal</TabsTrigger>
            <TabsTrigger value="file_search" className="text-xs">File search</TabsTrigger>
            <TabsTrigger value="web_search" className="text-xs">Web search</TabsTrigger>
            <TabsTrigger value="database" className="text-xs">Database</TabsTrigger>
            <TabsTrigger value="skills" className="text-xs">Skills</TabsTrigger>
          </TabsList>
          {Object.keys(TAB_FILTERS).map((tab) => {
            const filtered = events.filter(({ event }) => TAB_FILTERS[tab](event));
            return (
              <TabsContent key={tab} value={tab} className="mt-4 overflow-y-auto custom-scrollbar max-h-[52vh] space-y-2">
                {isLoading ? (
                  <p className="text-xs text-muted-foreground py-8 text-center">Loading harness activity…</p>
                ) : tab === "everything" && filtered.length === 0 ? (
                  <div className="space-y-2">
                    {(runs ?? []).length === 0 ? (
                      <p className="text-xs text-muted-foreground py-8 text-center">
                        No recent work yet. Start a run from Agent Home.
                      </p>
                    ) : (
                      (runs ?? []).map((run) => (
                        <Link
                          key={run.id}
                          href={`/agent/workflow?runId=${run.id}`}
                          className="block rounded-lg border border-border bg-card px-3 py-3 hover:bg-muted/50 transition-colors"
                        >
                          <div className="text-xs font-semibold text-foreground truncate">{run.title}</div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {run.status} · {relativeTime(run.updatedAt)}
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                ) : filtered.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-8 text-center">No events in this view yet.</p>
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

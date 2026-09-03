"use client";

import { useState } from "react";
import Link from "next/link";
import { Bot, RotateCcw } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { useGetAgentBriefing } from "../api/use-agent-briefing";
import { useGetPersonalAgent, useResetPersonalAgent } from "../api/use-personal-agent";
import { profileIsTrained } from "../lib/personal-agent-status";
import { PersonalAgentSetup } from "./personal-agent-setup";

const PRIORITY_TONE: Record<string, string> = {
  URGENT: "bg-red-500",
  HIGH: "bg-orange-500",
  MEDIUM: "bg-amber-400",
  LOW: "bg-muted-foreground/40",
};

export function DailyCockpit() {
  const { data: personal, isLoading: personalLoading } = useGetPersonalAgent();
  const { data: briefing, isLoading: briefingLoading } = useGetAgentBriefing();
  const reset = useResetPersonalAgent();
  const [confirmReset, setConfirmReset] = useState(false);

  const trained = profileIsTrained(personal?.profile);

  return (
    <section className="relative overflow-hidden bg-card border border-border rounded-2xl shadow-sm mb-5">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-muted/50 to-transparent" />
      <div className="relative p-5">
        {personalLoading ? (
          <div className="space-y-3 py-2">
            <div className="h-3 w-28 rounded-full bg-muted animate-pulse" />
            <div className="h-4 w-48 rounded-full bg-muted/80 animate-pulse" />
            <div className="h-3 w-full rounded-full bg-muted/70 animate-pulse" />
          </div>
        ) : trained ? (
          <>
            <div className="flex items-start justify-between mb-5 gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <span className="size-9 rounded-xl border border-border/80 bg-background text-foreground flex items-center justify-center shrink-0">
                  <Bot className="size-4" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground text-[11px] uppercase tracking-[0.14em]">
                      Daily cockpit
                    </h3>
                    <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                      Ready
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Trained on how you work</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {briefing ? (
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    {Math.round(briefing.generatedInMs)}ms
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  disabled={reset.isPending}
                  className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-background px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors disabled:opacity-50"
                >
                  <RotateCcw className="size-3" />
                  Reset
                </button>
              </div>
            </div>
            {briefingLoading ? (
              <p className="text-xs text-muted-foreground">Preparing your briefing…</p>
            ) : !briefing ? (
              <p className="text-xs text-muted-foreground">Sign in to load your role-aware briefing.</p>
            ) : (
              <div className="space-y-5">
                <div>
                  <p className="text-[15px] font-semibold tracking-tight text-foreground">{briefing.greeting}</p>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{briefing.headline}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-2.5">
                    Today
                  </p>
                  <ul className="space-y-1.5">
                    {briefing.priorities.map((line) => (
                      <li key={line} className="text-xs text-foreground leading-relaxed pl-3 relative">
                        <span className="absolute left-0 top-1.5 size-1 rounded-full bg-foreground/50" />
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
                {briefing.blockers.length ? (
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Blockers: {briefing.blockers.join(" · ")}
                  </p>
                ) : null}
                {briefing.suggestedActions[0] ? (
                  <p className="text-[11px] text-primary leading-relaxed">{briefing.suggestedActions[0]}</p>
                ) : null}
                <div className="pt-1 border-t border-border/70">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-2.5 mt-3">
                    Top tasks
                  </p>
                  {briefing.topTasks?.length ? (
                    <div className="space-y-0.5">
                      {briefing.topTasks.map((task) => (
                        <Link
                          key={task.id}
                          href={
                            task.workspaceId
                              ? `/workspaces/${task.workspaceId}/tasks/${task.id}`
                              : "/agent/projects"
                          }
                          className="flex items-start gap-2.5 rounded-lg px-1.5 py-2 hover:bg-muted/50 transition-colors"
                        >
                          <span
                            className={`mt-1.5 size-1.5 rounded-full shrink-0 ${PRIORITY_TONE[String(task.priority || "").toUpperCase()] ?? PRIORITY_TONE.LOW}`}
                          />
                          <span className="min-w-0">
                            <span className="block text-xs font-medium text-foreground truncate">
                              {[task.key, task.title].filter(Boolean).join(" · ")}
                            </span>
                            <span className="block text-[11px] text-muted-foreground mt-0.5">
                              {[task.status, task.priority].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">No open tasks assigned to you.</p>
                  )}
                </div>
              </div>
            )}
            <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure you want to reset?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently deletes the trained profile, interview answers, inferred workspace data, and
                    training chats from the database. You will need to train or self-train again.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={reset.isPending}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={reset.isPending}
                    onClick={(event) => {
                      event.preventDefault();
                      reset.mutate(undefined, {
                        onSuccess: () => setConfirmReset(false),
                      });
                    }}
                  >
                    {reset.isPending ? "Deleting…" : "Reset"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        ) : (
          <PersonalAgentSetup />
        )}
      </div>
    </section>
  );
}

"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { useCurrent } from "@/features/auth/api/use-current";

import { useGetAgentContext } from "../api/use-agent-context";
import { useGetAgentHarness, useUpdateAgentHarness } from "../api/use-agent-harness";
import { useGetAgentRuns } from "../api/use-agent-runs";
import { AGENT_NAV, AGENT_SETTINGS_NAV } from "../constants";
import { relativeTime, userInitials } from "../lib/agent-ui";
import type { AgentRunMode } from "../types";
import { useAgentUi } from "./agent-ui-context";
import { ModelPicker } from "./model-picker";

export function AgentPageFrame({ children }: { children: ReactNode }) {
  return <div className="h-full overflow-y-auto p-8 scrollbar-hide">{children}</div>;
}

function navActive(pathname: string, href: string, hash: string) {
  if (href.includes("#")) {
    const [path, fragment] = href.split("#");
    return pathname === path && hash === `#${fragment}`;
  }
  if (href === "/agent/dashboard") return pathname === href;
  if (href === "/agent/settings") return pathname === href && !hash;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AgentAppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { openRecentWork, openInvite, openSearch } = useAgentUi();
  const { data: user } = useCurrent();
  const { data: runs } = useGetAgentRuns();
  const { data: harness } = useGetAgentHarness();
  const { data: context } = useGetAgentContext();
  const updateHarness = useUpdateAgentHarness();
  const [hash, setHash] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  const mode: AgentRunMode = harness?.settings.mode === "manual" ? "manual" : "agent";
  const initials = userInitials(user?.name, user?.email);
  const unread = (context?.notifications ?? []).filter((item) => !item.isRead).length;

  useEffect(() => {
    const sync = () => setHash(window.location.hash);
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [pathname]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "h") {
        event.preventDefault();
        router.push("/agent/dashboard");
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openSearch();
      }
      if (!typing && event.key.toLowerCase() === "k" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        openSearch();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openSearch, router]);

  const setMode = (next: AgentRunMode) => {
    if (next === mode || updateHarness.isPending) return;
    updateHarness.mutate({ json: { settings: { mode: next } } });
  };

  return (
    <div className="flex h-full min-h-0 w-full bg-fairlx-bg text-fairlx-text">
      <aside className="w-64 flex-shrink-0 bg-fairlx-surface border-r border-fairlx-border flex flex-col">
        <div className="h-16 px-6 flex items-center border-b border-fairlx-border">
          <Link href="/agent/dashboard" className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-fairlx-primary/20 text-fairlx-primary flex items-center justify-center font-bold">
              F
            </div>
            <span className="font-semibold text-white truncate">Fairlx Agent</span>
          </Link>
        </div>
        <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-1 custom-scrollbar">
          {AGENT_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                navActive(pathname, item.href, hash)
                  ? "bg-fairlx-primary/10 text-fairlx-primary"
                  : "text-fairlx-text-muted hover:bg-fairlx-surface-hover hover:text-fairlx-text"
              )}
            >
              <i className={`${item.icon} w-4 text-center`} />
              <span className="flex-1 truncate">{item.label}</span>
              {"shortcut" in item && item.shortcut ? (
                <span className="text-[10px] text-fairlx-text-muted">{item.shortcut}</span>
              ) : null}
            </Link>
          ))}
          <div className="pt-4 pb-2 px-3 text-[11px] uppercase tracking-wide text-fairlx-text-muted">
            Settings
          </div>
          {AGENT_SETTINGS_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                navActive(pathname, item.href, hash)
                  ? "bg-fairlx-primary/10 text-fairlx-primary"
                  : "text-fairlx-text-muted hover:bg-fairlx-surface-hover hover:text-fairlx-text"
              )}
            >
              <i className={`${item.icon} w-4 text-center`} />
              {item.label}
            </Link>
          ))}
          <div className="pt-4 pb-2 px-3 flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wide text-fairlx-text-muted">
              Recent work items
            </span>
            <button
              type="button"
              onClick={openRecentWork}
              className="text-[11px] text-fairlx-primary hover:underline"
            >
              See all
            </button>
          </div>
          {(runs ?? []).slice(0, 5).map((run) => (
            <Link
              key={run.id}
              href={`/agent/workflow?runId=${run.id}`}
              className="block rounded-lg px-3 py-2 hover:bg-fairlx-surface-hover"
            >
              <div className="text-sm text-fairlx-text truncate">{run.title}</div>
              <div className="text-[11px] text-fairlx-text-muted">
                {run.status} · {relativeTime(run.updatedAt)}
              </div>
            </Link>
          ))}
          {(runs ?? []).length === 0 ? (
            <p className="px-3 text-xs text-fairlx-text-muted">No runs yet.</p>
          ) : null}
        </nav>
        <div className="p-4 border-t border-fairlx-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-fairlx-primary/20 text-fairlx-primary flex items-center justify-center text-sm font-semibold">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-white truncate">{user?.name || "Account"}</div>
              <div className="text-xs text-fairlx-text-muted truncate">{user?.email || ""}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={openInvite}
            className="mt-3 w-full rounded-lg border border-fairlx-border px-3 py-2 text-sm text-fairlx-text-muted hover:text-white hover:bg-fairlx-surface-hover"
          >
            <i className="fa-solid fa-user-plus mr-2" />
            Invite Members
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        <header className="h-16 px-8 flex items-center gap-3 border-b border-fairlx-border bg-fairlx-bg">
          <div className="inline-flex rounded-lg border border-fairlx-border bg-fairlx-surface p-1">
            {(["manual", "agent"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md capitalize",
                  mode === value
                    ? "bg-fairlx-primary/10 text-fairlx-primary shadow-sm border border-fairlx-primary/20"
                    : "text-fairlx-text-muted hover:text-white"
                )}
              >
                {value}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ModelPicker variant="sidebar" className="hidden md:flex" />
            <button
              type="button"
              onClick={openSearch}
              className="h-9 rounded-md border border-fairlx-border px-3 text-xs text-fairlx-text-muted hover:text-white"
              title="Search"
            >
              <i className="fa-solid fa-magnifying-glass mr-2" />
              K
            </button>
            <button
              type="button"
              onClick={() => setNotesOpen((open) => !open)}
              className="relative h-9 w-9 rounded-md border border-fairlx-border text-fairlx-text-muted hover:text-white"
              title="Notifications"
            >
              <i className="fa-regular fa-bell" />
              {unread > 0 ? (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 rounded-full bg-fairlx-primary text-[10px] text-white px-1">
                  {unread}
                </span>
              ) : null}
            </button>
            <div className="w-8 h-8 rounded-full bg-fairlx-primary/20 text-fairlx-primary flex items-center justify-center text-xs font-semibold">
              {initials}
            </div>
          </div>
        </header>
        {notesOpen ? (
          <div className="absolute right-8 top-20 z-20 w-80 rounded-xl border border-fairlx-border bg-fairlx-surface shadow-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-white">Notifications</p>
              <button type="button" className="text-xs text-fairlx-text-muted" onClick={() => setNotesOpen(false)}>
                Close
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto space-y-2 custom-scrollbar">
              {(context?.notifications ?? []).length === 0 ? (
                <p className="text-sm text-fairlx-text-muted py-6 text-center">No notifications.</p>
              ) : (
                (context?.notifications ?? []).slice(0, 12).map((item) => (
                  <div key={item.id} className="rounded-lg border border-fairlx-border px-3 py-2">
                    <p className="text-sm text-white">{item.title || "Notification"}</p>
                    {item.message ? <p className="text-xs text-fairlx-text-muted mt-1">{item.message}</p> : null}
                    <p className="text-[11px] text-fairlx-text-muted mt-1">{relativeTime(item.createdAt)}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}
        <main className="relative flex-1 min-h-0 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}

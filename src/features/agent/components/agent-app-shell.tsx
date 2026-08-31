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
  return <div className="h-full overflow-y-auto p-8 custom-scrollbar">{children}</div>;
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
  const [activeRunId, setActiveRunId] = useState("");
  const mode: AgentRunMode = harness?.settings.mode === "manual" ? "manual" : "agent";
  const initials = userInitials(user?.name, user?.email);
  const unread = (context?.notifications ?? []).filter((item) => !item.isRead).length;
  const isWorkflow = pathname.startsWith("/agent/workflow");

  useEffect(() => {
    const sync = () => {
      setHash(window.location.hash);
      setActiveRunId(new URLSearchParams(window.location.search).get("runId") ?? "");
    };
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
    <div className="relative flex h-full min-h-0 w-full bg-gray-950 text-fairlx-text text-sm">
      <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col flex-shrink-0">
        <div className="h-14 flex items-center px-4 shrink-0">
          <Link href="/agent/dashboard" className="flex items-center gap-2 text-blue-500 font-bold text-xl tracking-tight">
            <i className="fa-solid fa-cube" />
            <span>fairlx</span>
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-4 flex flex-col gap-6 min-h-0">
          <div className="flex flex-col gap-2">
            <Link
              href="/agent/dashboard"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-md py-2 px-3 flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-2 font-medium">
                <i className="fa-solid fa-plus text-xs" />
                New Agent
              </div>
              <div className="flex items-center gap-1 opacity-70 text-xs">
                <span className="text-[10px]">⌘</span>H
              </div>
            </Link>
            <button type="button" onClick={openSearch} className="relative w-full text-left">
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs pointer-events-none" />
              <span className="block w-full bg-gray-850 border border-gray-800 rounded-md py-1.5 pl-8 pr-12 text-gray-500 text-sm">
                Search
              </span>
              <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-gray-500 text-xs">
                ⌘K
              </span>
            </button>
          </div>
          <nav className="flex flex-col gap-1">
            {AGENT_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-2 py-2 rounded-md transition-colors",
                  navActive(pathname, item.href, hash)
                    ? "bg-gray-800 text-blue-400 font-medium"
                    : "text-gray-400 hover:text-gray-200 hover:bg-gray-850",
                )}
              >
                <i className={`${item.icon} w-4 text-center`} />
                <span className="flex-1 truncate">{item.label}</span>
              </Link>
            ))}
            <div className="pt-3 pb-1 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Settings
            </div>
            {AGENT_SETTINGS_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-2 py-2 rounded-md transition-colors",
                  navActive(pathname, item.href, hash)
                    ? "bg-gray-800 text-blue-400 font-medium"
                    : "text-gray-400 hover:text-gray-200 hover:bg-gray-850",
                )}
              >
                <i className={`${item.icon} w-4 text-center`} />
                {item.label}
              </Link>
            ))}
          </nav>
          <div>
            <div className="flex items-center justify-between px-2 mb-2">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Recent Work Items</h3>
              <button type="button" onClick={openRecentWork} className="text-blue-500 text-xs hover:underline">
                See all
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {(runs ?? []).slice(0, 5).map((run) => {
                const running = run.status === "running";
                const active = activeRunId === run.id;
                return (
                  <Link
                    key={run.id}
                    href={`/agent/workflow?runId=${run.id}`}
                    className={cn(
                      "flex flex-col gap-1 px-2 py-2 rounded-md transition-colors",
                      running || active
                        ? "bg-gray-800 border border-gray-700"
                        : "hover:bg-gray-850 text-gray-400",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <i
                        className={cn(
                          "text-xs",
                          running
                            ? "fa-regular fa-square-check text-blue-500"
                            : run.status === "failed"
                              ? "fa-solid fa-triangle-exclamation text-red-400"
                              : "fa-regular fa-comments text-gray-500",
                        )}
                      />
                      <span className={cn("truncate", running || active ? "font-medium text-gray-200" : "")}>
                        {run.title}
                      </span>
                    </div>
                    {running ? (
                      <div className="flex items-center gap-1.5 pl-5 text-xs text-blue-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                        Running
                      </div>
                    ) : (
                      <span className="pl-5 text-xs text-gray-500">{relativeTime(run.updatedAt)}</span>
                    )}
                  </Link>
                );
              })}
              {(runs ?? []).length === 0 ? (
                <p className="px-2 text-xs text-gray-500">No runs yet.</p>
              ) : null}
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-gray-800 shrink-0">
          <Link
            href="/agent/settings"
            className="w-full flex items-center justify-between p-2 rounded-md hover:bg-gray-800 border border-gray-800 bg-gray-850 transition-colors mb-2"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-gray-300 font-medium shrink-0">
                {initials[0] || "U"}
              </div>
              <div className="text-left min-w-0">
                <div className="font-medium text-gray-200 truncate">
                  {user?.name?.split(/\s+/)[0] || user?.email?.split("@")[0] || "Account"}
                </div>
                <div className="text-xs text-gray-500 truncate">{user?.email || "Account"}</div>
              </div>
            </div>
            <i className="fa-solid fa-chevron-down text-gray-500 text-xs" />
          </Link>
          <button
            type="button"
            onClick={openInvite}
            className="w-full flex items-center justify-center gap-2 p-2 rounded-md border border-gray-800 hover:bg-gray-800 text-gray-400 transition-colors text-xs"
          >
            <i className="fa-solid fa-user-plus" />
            Invite Members
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 min-h-0 flex flex-col bg-gray-950">
        {isWorkflow ? null : (
          <header className="h-14 border-b border-gray-800 flex items-center justify-between px-6 shrink-0 bg-gray-950">
            <div className="inline-flex rounded-md border border-gray-800 bg-gray-900 p-0.5">
              {(["manual", "agent"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded capitalize",
                    mode === value ? "bg-blue-600/15 text-blue-400" : "text-gray-400 hover:text-gray-200",
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              {context?.workspaces.length ? (
                <select
                  value={harness?.settings.defaultWorkspaceId || ""}
                  onChange={(event) => {
                    const nextWorkspace = event.target.value;
                    const projectStillValid = (context.projects ?? []).some(
                      (project) =>
                        project.id === harness?.settings.defaultProjectId && project.workspaceId === nextWorkspace,
                    );
                    updateHarness.mutate({
                      json: {
                        settings: {
                          defaultWorkspaceId: nextWorkspace || undefined,
                          defaultProjectId: projectStillValid ? harness?.settings.defaultProjectId : undefined,
                        },
                      },
                    });
                  }}
                  className="h-8 max-w-[180px] rounded-md border border-gray-800 bg-gray-900 px-2 text-xs text-gray-300 outline-none"
                  title="Workspace"
                >
                  <option value="">Workspace</option>
                  {(context.workspaces ?? []).map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </option>
                  ))}
                </select>
              ) : null}
              <ModelPicker variant="chip" className="hidden md:flex bg-transparent border-0 px-2" />
              <button
                type="button"
                onClick={() => setNotesOpen((open) => !open)}
                className="text-gray-400 hover:text-gray-200 relative"
                title="Notifications"
              >
                <i className="fa-regular fa-bell text-lg" />
                {unread > 0 ? (
                  <span className="absolute top-0 right-0 w-2 h-2 bg-blue-500 rounded-full border border-gray-950" />
                ) : null}
              </button>
              <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-gray-300 font-medium border border-gray-600">
                {initials[0] || "U"}
              </div>
            </div>
          </header>
        )}
        {notesOpen ? (
          <div className="absolute right-8 top-16 z-20 w-80 rounded-xl border border-gray-800 bg-gray-900 shadow-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-white">Notifications</p>
              <button type="button" className="text-xs text-gray-500" onClick={() => setNotesOpen(false)}>
                Close
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto space-y-2 custom-scrollbar">
              {(context?.notifications ?? []).length === 0 ? (
                <p className="text-sm text-gray-500 py-6 text-center">No notifications.</p>
              ) : (
                (context?.notifications ?? []).slice(0, 12).map((item) => (
                  <div key={item.id} className="rounded-lg border border-gray-800 px-3 py-2">
                    <p className="text-sm text-white">{item.title || "Notification"}</p>
                    {item.message ? <p className="text-xs text-gray-500 mt-1">{item.message}</p> : null}
                    <p className="text-[11px] text-gray-500 mt-1">{relativeTime(item.createdAt)}</p>
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

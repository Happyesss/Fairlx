"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Bot,
  MessageSquare,
  Search,
  FolderKanban,
  Briefcase,
  GitMerge,
  Wrench,
  Cpu,
  Server,
  Zap,
  Layers,
  BookOpen,
  Settings,
  Plus,
  ChevronRight,
  Menu,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ModeToggle } from "@/components/mode-toggle";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { UserButton } from "@/features/auth/components/user-button";
import { NotificationBell } from "@/features/notifications";
import { BugReportPopover } from "@/features/bug-reports/components/bug-report-popover";

import { useGetAgentContext } from "../api/use-agent-context";
import { useGetAgentHarness, useUpdateAgentHarness } from "../api/use-agent-harness";
import { useGetAgentRuns } from "../api/use-agent-runs";
import { relativeTime } from "../lib/agent-ui";
import type { AgentRunMode } from "../types";
import { useAgentUi } from "./agent-ui-context";
import { ModelPicker } from "./model-picker";

export function AgentPageFrame({ children }: { children: ReactNode }) {
  return <div className="h-full overflow-y-auto p-4 sm:p-6 lg:p-8 custom-scrollbar">{children}</div>;
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

const NAV_SECTIONS = [
  {
    title: "Agent Core",
    items: [
      { href: "/agent/dashboard", label: "Agent Home", icon: Bot, shortcut: "⌘H" },
      { href: "/agent/chats", label: "Chats", icon: MessageSquare },
    ],
  },
  {
    title: "Workspace & Code",
    items: [
      { href: "/agent/projects", label: "Projects", icon: FolderKanban },
      { href: "/agent/workspaces", label: "Workspaces", icon: Briefcase },
      { href: "/agent/git", label: "Git & Staging", icon: GitMerge },
    ],
  },
  {
    title: "Agent Tools",
    items: [
      { href: "/agent/skills", label: "Skills", icon: Wrench },
      { href: "/agent/tools", label: "Tools", icon: Cpu },
      { href: "/agent/mcp", label: "MCP Servers", icon: Server },
      { href: "/agent/automations", label: "Automations", icon: Zap },
      { href: "/agent/integrations", label: "Integrations", icon: Layers },
      { href: "/agent/knowledge", label: "Knowledge Base", icon: BookOpen },
      { href: "/agent/settings", label: "Settings", icon: Settings },
    ],
  },
];

function AgentSidebarNav({
  pathname,
  hash,
  runs,
  activeRunId,
  openSearch,
  openRecentWork,
  onNavigate,
}: {
  pathname: string;
  hash: string;
  runs: Array<{ id: string; title: string; status: string; updatedAt: string }> | undefined;
  activeRunId: string;
  openSearch: () => void;
  openRecentWork: () => void;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex flex-col h-full w-full">
      {/* Top Logo Header */}
      <div className="flex items-center w-full h-[73px] px-6 border-b border-sidebar-border flex-shrink-0">
        <Link href="/agent/dashboard" onClick={onNavigate} className="flex items-center">
          <Image src="/Logo.png" className="object-contain" alt="Fairlx Logo" width={80} height={90} priority />
        </Link>
      </div>

      {/* Scrollable Navigation Body */}
      <div className="flex flex-col flex-1 overflow-hidden overflow-y-auto px-3 py-3 gap-4 custom-scrollbar">
        {/* Quick Actions: New Agent & Search */}
        <div className="flex flex-col gap-1.5 px-0.5">
          <Link
            href="/agent/dashboard"
            onClick={onNavigate}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-md py-2 px-3 flex items-center justify-between transition-colors shadow-sm font-medium text-xs"
          >
            <div className="flex items-center gap-2">
              <Plus className="size-3.5" />
              <span>New Agent</span>
            </div>
            <div className="flex items-center gap-0.5 opacity-75 text-[10px]">
              <span>⌘</span>
              <span>H</span>
            </div>
          </Link>
          <button
            type="button"
            onClick={openSearch}
            className="w-full flex items-center justify-between px-3 py-1.5 rounded-md border border-sidebar-border bg-sidebar-accent/50 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors text-xs"
          >
            <div className="flex items-center gap-2">
              <Search className="size-3.5" />
              <span>Search</span>
            </div>
            <span className="text-[10px] opacity-75">⌘K</span>
          </button>
        </div>

        {/* Categorized Navigation */}
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="flex flex-col gap-0.5">
            <p className="text-[11px] font-semibold tracking-wider uppercase text-sidebar-foreground/50 pl-2.5 mb-1.5">
              {section.title}
            </p>
            {section.items.map((item) => {
              const isActive = navActive(pathname, item.href, hash);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-2.5 px-2.5 py-2 rounded-md font-medium text-[12px] tracking-tight transition",
                    isActive
                      ? "bg-sidebar-accent shadow-sm text-sidebar-foreground font-semibold"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  )}
                >
                  <Icon className={cn("size-[17px]", isActive && "text-primary")} />
                  <span className="flex-1 truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}

        {/* Recent Runs Section */}
        <div className="flex flex-col gap-1 pt-1">
          <div className="flex items-center justify-between px-2.5 mb-1">
            <p className="text-[11px] font-semibold tracking-wider uppercase text-sidebar-foreground/50">
              Recent Runs
            </p>
            <button
              type="button"
              onClick={openRecentWork}
              className="text-[11px] font-medium text-primary hover:underline"
            >
              All
            </button>
          </div>
          {(runs ?? []).slice(0, 4).map((run) => {
            const running = run.status === "running";
            const active = activeRunId === run.id;
            return (
              <Link
                key={run.id}
                href={`/agent/workflow?runId=${run.id}`}
                onClick={onNavigate}
                className={cn(
                  "flex items-center justify-between px-2.5 py-1.5 rounded-md text-[12px] transition truncate",
                  running || active
                    ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={cn(
                      "size-1.5 rounded-full shrink-0",
                      running ? "bg-blue-500 animate-pulse" : "bg-muted-foreground/40"
                    )}
                  />
                  <span className="truncate">{run.title}</span>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0 pl-1">
                  {relativeTime(run.updatedAt)}
                </span>
              </Link>
            );
          })}
          {(runs ?? []).length === 0 ? (
            <p className="px-2.5 text-xs text-muted-foreground">No runs yet.</p>
          ) : null}
        </div>
      </div>

      {/* Bottom Left: Workspace Switcher */}
      <div className="flex-shrink-0 border-t border-sidebar-border">
        <WorkspaceSwitcher />
      </div>
    </div>
  );
}

export function AgentAppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openRecentWork, openSearch } = useAgentUi();
  const { data: runs } = useGetAgentRuns();
  const { data: harness } = useGetAgentHarness();
  const { data: context } = useGetAgentContext();
  const updateHarness = useUpdateAgentHarness();
  const [hash, setHash] = useState("");
  const [activeRunId, setActiveRunId] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const mode: AgentRunMode = harness?.settings.mode === "manual" ? "manual" : "agent";

  const runId = searchParams.get("runId");
  const activeRun = (runs ?? []).find((r) => r.id === (runId || activeRunId));

  const activeWorkspace = useMemo(() => {
    if (activeRun?.workspaceId) {
      return (context?.workspaces ?? []).find((w) => w.id === activeRun.workspaceId);
    }
    if (harness?.settings.defaultWorkspaceId) {
      return (context?.workspaces ?? []).find((w) => w.id === harness.settings.defaultWorkspaceId);
    }
    return context?.workspaces?.[0];
  }, [activeRun, context, harness]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

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

  // Determine breadcrumb page title
  const pageTitle = useMemo(() => {
    if (pathname === "/agent/dashboard") return "Dashboard";
    if (pathname.startsWith("/agent/workflow")) return activeRun?.title || "Workflow";
    if (pathname === "/agent/chats") return "Chats";
    if (pathname === "/agent/search") return "Search";
    if (pathname === "/agent/projects") return "Projects";
    if (pathname === "/agent/workspaces") return "Workspaces";
    if (pathname === "/agent/git") return "Git & Staging";
    if (pathname === "/agent/skills") return "Skills";
    if (pathname === "/agent/tools") return "Tools";
    if (pathname === "/agent/mcp") return "MCP Servers";
    if (pathname === "/agent/automations") return "Automations";
    if (pathname === "/agent/integrations") return "Integrations";
    if (pathname === "/agent/knowledge") return "Knowledge Base";
    if (pathname === "/agent/settings") return "Settings";
    return "Agent";
  }, [pathname, activeRun]);

  return (
    <div className="relative flex h-full min-h-0 w-full bg-background text-foreground text-sm overflow-hidden">
      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:flex w-[264px] bg-sidebar border-r border-sidebar-border flex-col flex-shrink-0 h-full">
        <AgentSidebarNav
          pathname={pathname}
          hash={hash}
          runs={runs}
          activeRunId={activeRunId}
          openSearch={openSearch}
          openRecentWork={openRecentWork}
        />
      </aside>

      {/* Mobile / Tablet Left Sidebar Drawer */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="p-0 w-[280px] sm:w-[320px] bg-sidebar border-sidebar-border flex flex-col h-full text-foreground">
          <SheetTitle className="sr-only">Agent Navigation</SheetTitle>
          <AgentSidebarNav
            pathname={pathname}
            hash={hash}
            runs={runs}
            activeRunId={activeRunId}
            openSearch={() => {
              setMobileNavOpen(false);
              openSearch();
            }}
            openRecentWork={() => {
              setMobileNavOpen(false);
              openRecentWork();
            }}
            onNavigate={() => setMobileNavOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col bg-background">
        {/* Top Navbar Header */}
        <header className="h-[73px] px-3 sm:px-6 flex items-center border-b border-border sticky top-0 z-10 bg-background justify-between w-full shrink-0 gap-2 sm:gap-4">
          {/* Breadcrumbs on Left + Mobile Hamburger Button */}
          <div className="flex items-center gap-1.5 sm:gap-2 text-sm min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden size-9 text-muted-foreground hover:text-foreground shrink-0 -ml-1"
              aria-label="Open Navigation Menu"
            >
              <Menu className="size-5" />
            </Button>
            <span className="font-semibold text-foreground truncate max-w-[100px] sm:max-w-[180px] text-xs sm:text-sm">
              {activeWorkspace?.name || "Fairlx Workspace"}
            </span>
            <ChevronRight className="size-3.5 sm:size-4 text-muted-foreground shrink-0" />
            <Link href="/agent/dashboard" className="text-muted-foreground hover:text-foreground font-medium text-xs sm:text-sm">
              Agent
            </Link>
            {pageTitle !== "Dashboard" ? (
              <>
                <ChevronRight className="size-3.5 sm:size-4 text-muted-foreground shrink-0" />
                <span className="font-medium text-foreground truncate max-w-[100px] sm:max-w-[240px] text-xs sm:text-sm">
                  {pageTitle}
                </span>
              </>
            ) : null}
          </div>

          {/* Right Action Bar */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Mode Switcher */}
            <div className="hidden sm:inline-flex rounded-lg border border-border bg-muted/50 p-0.5">
              {(["manual", "agent"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium rounded-md capitalize transition-colors",
                    mode === value
                      ? "bg-background text-foreground shadow-sm font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {value}
                </button>
              ))}
            </div>

            {/* Model Picker */}
            <ModelPicker variant="chip" className="hidden md:flex" />

            {/* Switch back to Fairlx Main App */}
            <Link href="/">
              <Button
                variant="outline"
                size="sm"
                className="hidden sm:flex text-primary border-primary hover:bg-primary/10 h-8 text-xs font-medium"
              >
                Back to App
              </Button>
            </Link>

            {/* Theme Toggle */}
            <ModeToggle />

            {/* Bug Report Popover */}
            <BugReportPopover />

            {/* Notifications */}
            <NotificationBell />

            {/* Account Profile at Top Right */}
            <UserButton />
          </div>
        </header>

        {/* Content Outlet */}
        <main className="relative flex-1 min-h-0 overflow-hidden bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}

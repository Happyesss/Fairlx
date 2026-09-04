"use client";

import { useMemo, useRef, useState } from "react";
import {
  Plus,
  Paperclip,
  Image as ImageIcon,
  Sliders,
  BookOpen,
  Server,
  CheckSquare,
  FolderKanban,
  Briefcase,
  FileText,
  Lightbulb,
  ChevronRight,
  ChevronLeft,
  X,
  Settings,
} from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { useGetAgentContext } from "../api/use-agent-context";
import { useGetAgentHarness } from "../api/use-agent-harness";
import { useGetAgentMcpConfig } from "../api/use-agent-mcp-config";
import { isInternalMcpServer } from "../constants";
import { chipKey } from "../lib/session-context";
import { chipFromFile } from "../lib/attach-files";
import type { AgentContextChip } from "../types";
import { useAgentUi } from "./agent-ui-context";

type MenuView = "root" | "work_items" | "skills" | "mcp" | "projects" | "workspaces" | "docs";

export function AgentPlusMenu({
  chips,
  onAdd,
  triggerVariant = "plus",
  triggerClassName,
  align = "start",
}: {
  chips: AgentContextChip[];
  onAdd: (chip: AgentContextChip) => void;
  triggerVariant?: "plus" | "paperclip";
  triggerClassName?: string;
  align?: "start" | "end" | "center";
}) {
  const { openMcp, openModels, openNewWorkspace } = useAgentUi();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<MenuView>("root");
  const [query, setQuery] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: context } = useGetAgentContext();
  const { data: harness } = useGetAgentHarness();
  const { data: mcp } = useGetAgentMcpConfig();

  const selected = useMemo(() => new Set(chips.map(chipKey)), [chips]);
  const q = query.trim().toLowerCase();

  const workItems = useMemo(() => context?.workItems ?? [], [context?.workItems]);
  const skills = useMemo(() => harness?.skills ?? [], [harness?.skills]);
  const knowledge = useMemo(() => harness?.knowledge ?? [], [harness?.knowledge]);
  const servers = useMemo(
    () =>
      Object.entries(mcp?.mcpServers ?? {}).filter(
        ([name, server]) => !isInternalMcpServer(name, server)
      ),
    [mcp?.mcpServers]
  );
  const workspaces = useMemo(() => context?.workspaces ?? [], [context?.workspaces]);
  const projects = useMemo(() => context?.projects ?? [], [context?.projects]);
  const docs = useMemo(() => context?.docs ?? [], [context?.docs]);

  const filtered = useMemo(() => {
    const match = (value: string) => !q || value.toLowerCase().includes(q);
    if (view === "work_items") return workItems.filter((item) => match(`${item.key} ${item.title}`));
    if (view === "skills") return skills.filter((item) => match(item.name));
    if (view === "projects") return projects.filter((item) => match(item.name));
    if (view === "workspaces") return workspaces.filter((item) => match(item.name));
    if (view === "docs") return docs.filter((item) => match(item.title || item.name || ""));
    return [];
  }, [view, q, workItems, skills, projects, workspaces, docs]);

  const add = (chip: AgentContextChip) => {
    if (selected.has(chipKey(chip))) return;
    onAdd(chip);
    setOpen(false);
    setView("root");
    setQuery("");
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setView("root");
          setQuery("");
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            triggerVariant === "paperclip"
              ? "size-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/70 flex items-center justify-center transition-colors cursor-pointer select-none"
              : "size-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition-colors shadow-sm border border-border/40 cursor-pointer select-none",
            triggerClassName
          )}
          title={triggerVariant === "paperclip" ? "Attach context or files" : "Add agents, context, tools"}
        >
          {triggerVariant === "paperclip" ? (
            <Paperclip className="size-4" />
          ) : (
            <Plus className="size-3.5" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        side="top"
        className="w-80 p-0 bg-popover border-border text-popover-foreground shadow-2xl rounded-xl"
      >
        <div className="px-3 py-2 border-b border-border">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Add context, files, tools..."
            className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
            autoFocus
          />
        </div>
        {view === "root" ? (
          <div className="py-1 max-h-80 overflow-y-auto custom-scrollbar">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full flex items-center gap-3 px-3 py-2 text-xs hover:bg-muted transition-colors text-left font-medium"
            >
              <ImageIcon className="size-4 text-muted-foreground" />
              <span>Image, markdown, PDF</span>
            </button>
            <Row icon={Sliders} label="Models" onClick={() => { setOpen(false); openModels(); }} nested />
            <Row icon={BookOpen} label="Skills" onClick={() => setView("skills")} nested />
            <Row icon={Server} label="MCP Servers" onClick={() => setView("mcp")} nested />
            <Row icon={CheckSquare} label="Work items" onClick={() => setView("work_items")} nested />
            <Row icon={FolderKanban} label="Projects" onClick={() => setView("projects")} nested />
            <Row icon={Briefcase} label="Workspaces" onClick={() => setView("workspaces")} nested />
            <Row icon={FileText} label="Docs" onClick={() => setView("docs")} nested />
            <Row icon={Plus} label="New workspace" onClick={() => { setOpen(false); openNewWorkspace(); }} />
          </div>
        ) : view === "mcp" ? (
          <ListShell title="MCP Servers" onBack={() => setView("root")}>
            {servers
              .filter(([name]) => !q || name.toLowerCase().includes(q))
              .map(([name, server]) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => add({ kind: "mcp", id: name, label: name, meta: String(server.transport || "http") })}
                  className="w-full flex items-center gap-3 px-3 py-2 text-xs hover:bg-muted transition-colors text-left"
                >
                  <Server className="size-4 text-muted-foreground" />
                  <span className="flex-1 truncate font-medium text-foreground">{name}</span>
                  {server.disabled ? <span className="text-[10px] text-muted-foreground">off</span> : null}
                </button>
              ))}
            <Row icon={Settings} label="Manage MCP" onClick={() => { setOpen(false); openMcp(); }} />
          </ListShell>
        ) : (
          <ListShell
            title={
              view === "work_items"
                ? "Work items"
                : view === "skills"
                  ? "Skills"
                  : view === "projects"
                    ? "Projects"
                    : view === "workspaces"
                      ? "Workspaces"
                      : "Docs"
            }
            onBack={() => setView("root")}
          >
            {view === "work_items"
              ? (filtered as typeof workItems).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      add({
                        kind: "work_item",
                        id: item.id,
                        label: item.title,
                        meta: [item.key, item.status].filter(Boolean).join(" · "),
                      })
                    }
                    className="w-full flex items-center gap-3 px-3 py-2 text-xs hover:bg-muted transition-colors text-left"
                  >
                    <CheckSquare className="size-4 text-muted-foreground" />
                    <span className="flex-1 truncate font-medium text-foreground">{item.title}</span>
                  </button>
                ))
              : null}
            {view === "skills"
              ? (filtered as typeof skills).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => add({ kind: "skill", id: item.id, label: item.name, meta: item.description })}
                    className="w-full flex items-center gap-3 px-3 py-2 text-xs hover:bg-muted transition-colors text-left"
                  >
                    <BookOpen className="size-4 text-muted-foreground" />
                    <span className="flex-1 truncate font-medium text-foreground">{item.name}</span>
                  </button>
                ))
              : null}
            {view === "projects"
              ? (filtered as typeof projects).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => add({ kind: "project", id: item.id, label: item.name, meta: item.key })}
                    className="w-full flex items-center gap-3 px-3 py-2 text-xs hover:bg-muted transition-colors text-left"
                  >
                    <FolderKanban className="size-4 text-muted-foreground" />
                    <span className="flex-1 truncate font-medium text-foreground">{item.name}</span>
                  </button>
                ))
              : null}
            {view === "workspaces"
              ? (filtered as typeof workspaces).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => add({ kind: "workspace", id: item.id, label: item.name })}
                    className="w-full flex items-center gap-3 px-3 py-2 text-xs hover:bg-muted transition-colors text-left"
                  >
                    <Briefcase className="size-4 text-muted-foreground" />
                    <span className="flex-1 truncate font-medium text-foreground">{item.name}</span>
                  </button>
                ))
              : null}
            {view === "docs"
              ? (filtered as typeof docs).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      add({ kind: "doc", id: item.id, label: item.title || item.name || "Doc" })
                    }
                    className="w-full flex items-center gap-3 px-3 py-2 text-xs hover:bg-muted transition-colors text-left"
                  >
                    <FileText className="size-4 text-muted-foreground" />
                    <span className="flex-1 truncate font-medium text-foreground">{item.title || item.name}</span>
                  </button>
                ))
              : null}
            {view === "skills"
              ? knowledge
                  .filter((item) => !q || item.title.toLowerCase().includes(q))
                  .map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => add({ kind: "knowledge", id: item.id, label: item.title })}
                      className="w-full flex items-center gap-3 px-3 py-2 text-xs hover:bg-muted transition-colors text-left"
                    >
                      <Lightbulb className="size-4 text-muted-foreground" />
                      <span className="flex-1 truncate font-medium text-foreground">{item.title}</span>
                    </button>
                  ))
              : null}
            {filtered.length === 0 && view !== "skills" ? (
              <p className="px-3 py-4 text-xs text-muted-foreground">Nothing matches.</p>
            ) : null}
          </ListShell>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.md,.markdown,.pdf,.txt,.ts,.tsx,.js,.jsx,.json"
          className="hidden"
          multiple
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            void (async () => {
              for (const file of files) {
                try {
                  add(await chipFromFile(file));
                } catch {
                  add({
                    kind: file.type.startsWith("image/") ? "image" : "file",
                    id: `${file.name}-${file.size}-${file.lastModified}`,
                    label: file.name,
                    meta: "unreadable",
                  });
                }
              }
            })();
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

function Row({
  icon: Icon,
  label,
  onClick,
  nested,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  nested?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2 text-xs hover:bg-muted transition-colors text-left font-medium text-foreground"
    >
      <Icon className="size-4 text-muted-foreground" />
      <span className="flex-1 truncate">{label}</span>
      {nested ? <ChevronRight className="size-3 text-muted-foreground" /> : null}
    </button>
  );
}

function ListShell({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="py-1 max-h-80 overflow-y-auto custom-scrollbar">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground hover:text-foreground font-semibold"
      >
        <ChevronLeft className="size-3.5" />
        {title}
      </button>
      {children}
    </div>
  );
}

export function ContextChips({
  chips,
  onRemove,
}: {
  chips: AgentContextChip[];
  onRemove: (chip: AgentContextChip) => void;
}) {
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 px-3 pt-3">
      {chips.map((chip) => (
        <span
          key={chipKey(chip)}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-[11px] text-foreground font-medium shadow-sm"
        >
          <span className="truncate max-w-[160px]">{chip.label}</span>
          <button type="button" onClick={() => onRemove(chip)} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="size-3" />
          </button>
        </span>
      ))}
    </div>
  );
}

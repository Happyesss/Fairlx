"use client";

import { useMemo, useRef, useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { useGetAgentContext } from "../api/use-agent-context";
import { useGetAgentHarness, useUpdateAgentHarness } from "../api/use-agent-harness";
import { useGetAgentMcpConfig } from "../api/use-agent-mcp-config";
import { AGENT_SESSION_MODES, chipKey, runModeForSession } from "../lib/session-context";
import type { AgentContextChip, AgentSessionMode } from "../types";
import { useAgentUi } from "./agent-ui-context";

type MenuView = "root" | "work_items" | "skills" | "mcp" | "projects" | "workspaces" | "docs";

export function AgentPlusMenu({
  chips,
  onAdd,
}: {
  chips: AgentContextChip[];
  onAdd: (chip: AgentContextChip) => void;
}) {
  const { openMcp, openModels, openNewWorkspace } = useAgentUi();
  const { data: context } = useGetAgentContext();
  const { data: harness } = useGetAgentHarness();
  const { data: mcp } = useGetAgentMcpConfig();
  const updateHarness = useUpdateAgentHarness();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<MenuView>("root");
  const selected = new Set(chips.map(chipKey));
  const sessionMode = harness?.settings.sessionMode || "agent";
  const q = query.trim().toLowerCase();

  const workItems = useMemo(() => context?.workItems ?? [], [context?.workItems]);
  const skills = useMemo(() => harness?.skills ?? [], [harness?.skills]);
  const knowledge = useMemo(() => harness?.knowledge ?? [], [harness?.knowledge]);
  const servers = useMemo(() => Object.entries(mcp?.mcpServers ?? {}), [mcp?.mcpServers]);
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

  const setMode = (id: AgentSessionMode) => {
    updateHarness.mutate({
      json: { settings: { sessionMode: id, mode: runModeForSession(id) } },
    });
    setOpen(false);
  };

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
          className="h-7 w-7 rounded-full text-zinc-400 hover:text-zinc-100 hover:bg-white/10 flex items-center justify-center transition-colors"
          title="Add agents, context, tools"
        >
          <i className="fa-solid fa-plus text-[11px]" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className="dark w-80 p-0 bg-[#1c1d21] border-white/10 text-zinc-200 shadow-2xl"
      >
        <div className="px-3 py-2 border-b border-white/10">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Add agents, context, tools..."
            className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 outline-none"
            autoFocus
          />
        </div>
        {view === "root" ? (
          <div className="py-1 max-h-80 overflow-y-auto custom-scrollbar">
            {AGENT_SESSION_MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setMode(mode.id)}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-white/5 text-left"
              >
                <i className={`${mode.icon} w-4 text-center text-zinc-400`} />
                <span className="flex-1">{mode.label}</span>
                {sessionMode === mode.id ? <i className="fa-solid fa-check text-xs text-blue-400" /> : null}
              </button>
            ))}
            <div className="h-px bg-white/10 my-1" />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-white/5 text-left"
            >
              <i className="fa-regular fa-image w-4 text-center text-zinc-400" />
              Image, markdown, PDF
            </button>
            <Row icon="fa-solid fa-cube" label="Models" onClick={() => { setOpen(false); openModels(); }} nested />
            <Row icon="fa-solid fa-book" label="Skills" onClick={() => setView("skills")} nested />
            <Row icon="fa-solid fa-server" label="MCP Servers" onClick={() => setView("mcp")} nested />
            <Row icon="fa-solid fa-clipboard-list" label="Work items" onClick={() => setView("work_items")} nested />
            <Row icon="fa-solid fa-folder" label="Projects" onClick={() => setView("projects")} nested />
            <Row icon="fa-solid fa-briefcase" label="Workspaces" onClick={() => setView("workspaces")} nested />
            <Row icon="fa-regular fa-file-lines" label="Docs" onClick={() => setView("docs")} nested />
            <Row icon="fa-solid fa-plus" label="New workspace" onClick={() => { setOpen(false); openNewWorkspace(); }} />
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
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-white/5 text-left"
                >
                  <i className="fa-solid fa-server w-4 text-center text-zinc-400" />
                  <span className="flex-1 truncate">{name}</span>
                  {server.disabled ? <span className="text-[10px] text-zinc-500">off</span> : null}
                </button>
              ))}
            <Row icon="fa-solid fa-gear" label="Manage MCP" onClick={() => { setOpen(false); openMcp(); }} />
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
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-white/5 text-left"
                  >
                    <i className="fa-regular fa-square-check w-4 text-center text-zinc-400" />
                    <span className="flex-1 truncate">{item.title}</span>
                  </button>
                ))
              : null}
            {view === "skills"
              ? (filtered as typeof skills).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => add({ kind: "skill", id: item.id, label: item.name, meta: item.description })}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-white/5 text-left"
                  >
                    <i className="fa-solid fa-book w-4 text-center text-zinc-400" />
                    <span className="flex-1 truncate">{item.name}</span>
                  </button>
                ))
              : null}
            {view === "projects"
              ? (filtered as typeof projects).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => add({ kind: "project", id: item.id, label: item.name, meta: item.key })}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-white/5 text-left"
                  >
                    <i className="fa-solid fa-folder w-4 text-center text-zinc-400" />
                    <span className="flex-1 truncate">{item.name}</span>
                  </button>
                ))
              : null}
            {view === "workspaces"
              ? (filtered as typeof workspaces).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => add({ kind: "workspace", id: item.id, label: item.name })}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-white/5 text-left"
                  >
                    <i className="fa-solid fa-briefcase w-4 text-center text-zinc-400" />
                    <span className="flex-1 truncate">{item.name}</span>
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
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-white/5 text-left"
                  >
                    <i className="fa-regular fa-file-lines w-4 text-center text-zinc-400" />
                    <span className="flex-1 truncate">{item.title || item.name}</span>
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
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-white/5 text-left"
                    >
                      <i className="fa-solid fa-lightbulb w-4 text-center text-zinc-400" />
                      <span className="flex-1 truncate">{item.title}</span>
                    </button>
                  ))
              : null}
            {filtered.length === 0 && view !== "skills" ? (
              <p className="px-3 py-4 text-xs text-zinc-500">Nothing matches.</p>
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
            files.forEach((file) => {
              const image = file.type.startsWith("image/");
              add({
                kind: image ? "image" : "file",
                id: `${file.name}-${file.size}`,
                label: file.name,
                meta: image ? "image" : file.type || "file",
              });
            });
            event.target.value = "";
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

function Row({
  icon,
  label,
  onClick,
  nested,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  nested?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-white/5 text-left">
      <i className={`${icon} w-4 text-center text-zinc-400`} />
      <span className="flex-1 truncate">{label}</span>
      {nested ? <i className="fa-solid fa-chevron-right text-[10px] text-zinc-500" /> : null}
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
      <button type="button" onClick={onBack} className="flex items-center gap-2 px-3 py-2 text-xs text-zinc-500 hover:text-zinc-200">
        <i className="fa-solid fa-chevron-left text-[10px]" />
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
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-zinc-300"
        >
          <span className="truncate max-w-[160px]">{chip.label}</span>
          <button type="button" onClick={() => onRemove(chip)} className="text-zinc-500 hover:text-zinc-200">
            <i className="fa-solid fa-xmark text-[9px]" />
          </button>
        </span>
      ))}
    </div>
  );
}

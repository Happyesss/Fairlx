"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import { useGetAgentMcpConfig } from "../api/use-agent-mcp-config";
import { useUpdateAgentMcpConfig } from "../api/use-update-agent-mcp-config";
import { getMcpServerIcon } from "../constants";
import { defaultMcpConfig } from "../lib/client-defaults";
import type { McpConfig, McpServerConfig, McpTransport } from "../types";

const fieldClass =
  "border-border bg-background text-foreground placeholder:text-muted-foreground";

type ManageMcpDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type ServerForm = {
  originalName: string | null;
  name: string;
  transport: McpTransport;
  command: string;
  argsText: string;
  url: string;
  envText: string;
  headersText: string;
  disabled: boolean;
};

function cloneConfig(config: McpConfig): McpConfig {
  return JSON.parse(JSON.stringify(config)) as McpConfig;
}

function recordToLines(record?: Record<string, string>): string {
  if (!record) return "";
  return Object.entries(record)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

function linesToRecord(lines: string): Record<string, string> | undefined {
  const result: Record<string, string> = {};
  for (const line of lines.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (key) result[key] = value;
  }
  return Object.keys(result).length ? result : undefined;
}

function emptyForm(): ServerForm {
  return {
    originalName: null,
    name: "",
    transport: "http",
    command: "",
    argsText: "",
    url: "",
    envText: "",
    headersText: "",
    disabled: false,
  };
}

function serverToForm(name: string, server: McpServerConfig): ServerForm {
  return {
    originalName: name,
    name,
    transport: server.transport || (server.url ? "http" : "stdio"),
    command: server.command || "",
    argsText: (server.args ?? []).join("\n"),
    url: server.url || "",
    envText: recordToLines(server.env),
    headersText: recordToLines(server.headers),
    disabled: Boolean(server.disabled),
  };
}

function applyForm(current: McpConfig, form: ServerForm): McpConfig | string {
  const name = form.name.trim();
  if (!name) return "Server name is required.";
  const next = cloneConfig(current);
  if (!next.mcpServers) next.mcpServers = {};

  if (form.originalName && form.originalName !== name) {
    delete next.mcpServers[form.originalName];
  }

  const server: McpServerConfig = {
    transport: form.transport,
  };
  if (form.disabled) server.disabled = true;

  if (form.transport === "stdio") {
    if (!form.command.trim()) return "Command is required for stdio transport.";
    server.command = form.command.trim();
    const args = form.argsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (args.length) server.args = args;
  } else {
    if (!form.url.trim()) return "URL is required for HTTP/SSE transport.";
    server.url = form.url.trim();
  }

  const env = linesToRecord(form.envText);
  if (env) server.env = env;
  const headers = linesToRecord(form.headersText);
  if (headers) server.headers = headers;

  next.mcpServers[name] = server;
  return next;
}

export function ManageMcpDialog({ open, onOpenChange }: ManageMcpDialogProps) {
  const { data, isLoading } = useGetAgentMcpConfig();
  const { mutate, isPending } = useUpdateAgentMcpConfig();
  const [draft, setDraft] = useState<McpConfig>(defaultMcpConfig());
  const [view, setView] = useState<"list" | "json">("list");
  const [jsonText, setJsonText] = useState("");
  const [form, setForm] = useState<ServerForm | null>(null);

  useEffect(() => {
    if (data) {
      setDraft(data);
      setJsonText(JSON.stringify(data, null, 2));
    }
  }, [data]);

  const servers = useMemo(() => Object.entries(draft.mcpServers ?? {}), [draft]);

  const persistDraft = (next: McpConfig) => {
    setDraft(next);
    setJsonText(JSON.stringify(next, null, 2));
  };

  const handleSave = () => {
    let payload = draft;
    if (view === "json") {
      try {
        payload = JSON.parse(jsonText) as McpConfig;
      } catch {
        toast.error("Invalid JSON. Fix syntax before saving.");
        return;
      }
    }
    mutate(
      { json: payload },
      {
        onSuccess: () => onOpenChange(false),
      }
    );
  };

  const handleApplyForm = () => {
    if (!form) return;
    const result = applyForm(draft, form);
    if (typeof result === "string") {
      toast.error(result);
      return;
    }
    persistDraft(result);
    setForm(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage MCP Servers</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Per-account MCP config.json. Secrets stay masked after save.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={view === "list" ? "primary" : "outline"}
            onClick={() => {
              if (view === "json") {
                try {
                  persistDraft(JSON.parse(jsonText) as McpConfig);
                } catch {
                  toast.error("Fix JSON before switching views.");
                  return;
                }
              }
              setView("list");
            }}
          >
            Servers
          </Button>
          <Button
            type="button"
            size="sm"
            variant={view === "json" ? "primary" : "outline"}
            onClick={() => {
              setJsonText(JSON.stringify(draft, null, 2));
              setView("json");
              setForm(null);
            }}
          >
            JSON
          </Button>
        </div>

        {view === "json" ? (
          <Textarea
            value={jsonText}
            onChange={(event) => setJsonText(event.target.value)}
            className={`${fieldClass} min-h-[320px] font-mono text-xs`}
          />
        ) : (
          <div className="space-y-4">
            <div className="space-y-1">
              {isLoading && (
                <p className="text-sm text-muted-foreground">Loading MCP servers…</p>
              )}
              {servers.map(([name, server]) => {
                const icon = getMcpServerIcon(name);
                return (
                  <div
                    key={name}
                    className="flex items-center justify-between rounded-lg border border-border bg-card p-3 shadow-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {icon.kind === "badge" ? (
                        <div className="size-5 bg-foreground text-background rounded flex items-center justify-center font-bold text-xs">
                          {icon.value}
                        </div>
                      ) : (
                        <i className={`${icon.value} ${icon.className ?? ""} w-5 text-center`} />
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate text-foreground">{name}</div>
                        <div className="text-xs text-muted-foreground">
                          {server.transport || (server.url ? "http" : "stdio")}
                          {server.url ? ` · ${server.url}` : server.command ? ` · ${server.command}` : ""}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium ${server.disabled ? "text-muted-foreground" : "text-green-500"}`}>
                        {server.disabled ? "Disconnected" : "Connected"}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-foreground h-8 text-xs"
                        onClick={() => setForm(serverToForm(name, server))}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive h-8 text-xs"
                        onClick={() => {
                          const next = cloneConfig(draft);
                          delete next.mcpServers[name];
                          persistDraft(next);
                          if (form?.originalName === name) setForm(null);
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                );
              })}
              {servers.length === 0 && !isLoading && (
                <p className="text-sm text-muted-foreground">No MCP servers yet.</p>
              )}
            </div>

            {form ? (
              <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-foreground">
                    {form.originalName ? `Edit ${form.originalName}` : "Add MCP server"}
                  </h4>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setForm(null)}>
                    Cancel
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Name</Label>
                    <Input
                      value={form.name}
                      onChange={(event) => setForm({ ...form, name: event.target.value })}
                      className={fieldClass}
                      placeholder="github"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Transport</Label>
                    <select
                      value={form.transport}
                      onChange={(event) =>
                        setForm({ ...form, transport: event.target.value as McpTransport })
                      }
                      className={`flex h-10 w-full rounded-md border px-3 text-sm ${fieldClass}`}
                    >
                      <option value="http">HTTP</option>
                      <option value="sse">SSE</option>
                      <option value="stdio">stdio</option>
                    </select>
                  </div>
                </div>
                {form.transport === "stdio" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Command</Label>
                      <Input
                        value={form.command}
                        onChange={(event) => setForm({ ...form, command: event.target.value })}
                        className={fieldClass}
                        placeholder="npx"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Args (one per line)</Label>
                      <Textarea
                        value={form.argsText}
                        onChange={(event) => setForm({ ...form, argsText: event.target.value })}
                        className={fieldClass}
                        placeholder={"-y\n@modelcontextprotocol/server-github"}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label>URL</Label>
                    <Input
                      value={form.url}
                      onChange={(event) => setForm({ ...form, url: event.target.value })}
                      className={fieldClass}
                      placeholder="https://example.com/mcp"
                    />
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Env (KEY=value)</Label>
                    <Textarea
                      value={form.envText}
                      onChange={(event) => setForm({ ...form, envText: event.target.value })}
                      className={`${fieldClass} font-mono text-xs`}
                      placeholder="GITHUB_TOKEN=••••abcd"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Headers (KEY=value)</Label>
                    <Textarea
                      value={form.headersText}
                      onChange={(event) => setForm({ ...form, headersText: event.target.value })}
                      className={`${fieldClass} font-mono text-xs`}
                      placeholder="Authorization=Bearer ••••abcd"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={!form.disabled}
                      onCheckedChange={(checked) => setForm({ ...form, disabled: !checked })}
                    />
                    <Label>Enabled</Label>
                  </div>
                  <Button type="button" size="sm" onClick={handleApplyForm}>
                    Apply
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => setForm(emptyForm())}
              >
                Add server
              </Button>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

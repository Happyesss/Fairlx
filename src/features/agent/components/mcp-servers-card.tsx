"use client";

import { ChevronRight } from "lucide-react";
import { useAgentUi } from "./agent-ui-context";
import { useGetAgentMcpConfig } from "../api/use-agent-mcp-config";
import { getMcpServerIcon, isInternalMcpServer } from "../constants";
import type { McpConfig } from "../types";

function connectedMcpCount(config: McpConfig | undefined): number {
  if (!config?.mcpServers) return 0;
  return Object.entries(config.mcpServers).filter(
    ([name, server]) => !isInternalMcpServer(name, server) && !server.disabled
  ).length;
}

export function McpConnectedLabel({ className }: { className?: string }) {
  const { data, isLoading } = useGetAgentMcpConfig();
  const count = connectedMcpCount(data);

  if (isLoading) {
    return <span className={className}>…</span>;
  }

  return <span className={className ?? "text-green-500 font-medium"}>{count} connected</span>;
}

export function McpServersCard() {
  const { openMcp } = useAgentUi();
  const { data, isLoading } = useGetAgentMcpConfig();
  const servers = Object.entries(data?.mcpServers ?? {}).filter(
    ([name, server]) => !isInternalMcpServer(name, server)
  );

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground text-sm uppercase tracking-wider">MCP Servers</h3>
        <button
          type="button"
          onClick={openMcp}
          className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors bg-muted/60 hover:bg-muted px-2.5 py-1 rounded-md border border-border"
        >
          Manage
        </button>
      </div>
      <div className="space-y-1">
        {isLoading && (
          <p className="text-xs text-muted-foreground px-2 py-2">Loading MCP servers…</p>
        )}
        {!isLoading && servers.length === 0 && (
          <div className="py-3 px-3 rounded-lg border border-dashed border-border text-center bg-muted/20">
            <p className="text-xs text-muted-foreground">No external MCP servers added.</p>
            <button
              type="button"
              onClick={openMcp}
              className="text-xs font-medium text-primary hover:underline mt-1 inline-block"
            >
              + Add external server
            </button>
          </div>
        )}
        {servers.map(([name, server]) => {
          const icon = getMcpServerIcon(name);
          const connected = !server.disabled;
          return (
            <button
              key={name}
              type="button"
              onClick={openMcp}
              className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors group text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                {icon.kind === "badge" ? (
                  <div className="size-5 bg-foreground text-background rounded flex items-center justify-center font-bold text-xs">
                    {icon.value}
                  </div>
                ) : (
                  <i className={`${icon.value} ${icon.className ?? ""} text-base w-5 text-center`} />
                )}
                <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors truncate">
                  {name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`flex items-center gap-1.5 text-xs font-medium ${
                    connected ? "text-green-500" : "text-muted-foreground"
                  }`}
                >
                  <span
                    className={`size-1.5 rounded-full ${
                      connected ? "bg-green-500" : "border border-muted-foreground"
                    }`}
                  />
                  {connected ? "Connected" : "Disconnected"}
                </span>
                <ChevronRight className="size-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

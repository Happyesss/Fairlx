"use client";

import { useAgentUi } from "./agent-ui-context";
import { useGetAgentMcpConfig } from "../api/use-agent-mcp-config";
import { getMcpServerIcon } from "../constants";
import type { McpConfig } from "../types";

function connectedMcpCount(config: McpConfig | undefined): number {
  if (!config?.mcpServers) return 0;
  return Object.values(config.mcpServers).filter((server) => !server.disabled).length;
}

export function McpConnectedLabel({ className }: { className?: string }) {
  const { data, isLoading } = useGetAgentMcpConfig();
  const count = connectedMcpCount(data);

  if (isLoading) {
    return <span className={className}>…</span>;
  }

  return <span className={className ?? "text-green-500"}>{count} connected</span>;
}

export function McpServersCard() {
  const { openMcp } = useAgentUi();
  const { data, isLoading } = useGetAgentMcpConfig();
  const servers = Object.entries(data?.mcpServers ?? {});

  return (
    <div className="bg-fairlx-surface border border-fairlx-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-white">MCP Servers</h3>
        <button
          type="button"
          onClick={openMcp}
          className="text-xs font-medium text-fairlx-text-muted hover:text-white transition-colors bg-fairlx-bg px-2 py-1 rounded border border-fairlx-border"
        >
          Manage
        </button>
      </div>
      <div className="space-y-1">
        {isLoading && (
          <p className="text-sm text-fairlx-text-muted px-2 py-2">Loading MCP servers…</p>
        )}
        {!isLoading && servers.length === 0 && (
          <p className="text-sm text-fairlx-text-muted px-2 py-2">No MCP servers configured.</p>
        )}
        {servers.map(([name, server]) => {
          const icon = getMcpServerIcon(name);
          const connected = !server.disabled;
          return (
            <button
              key={name}
              type="button"
              onClick={openMcp}
              className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-fairlx-surface-hover transition-colors group text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                {icon.kind === "badge" ? (
                  <div className="w-5 h-5 bg-white text-black rounded flex items-center justify-center font-bold text-xs">
                    {icon.value}
                  </div>
                ) : (
                  <i className={`${icon.value} ${icon.className ?? ""} text-lg w-5 text-center`} />
                )}
                <span className="text-sm font-medium text-fairlx-text group-hover:text-white truncate">
                  {name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`flex items-center gap-1.5 text-xs ${
                    connected ? "text-green-500" : "text-fairlx-text-muted"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      connected ? "bg-green-500" : "border border-fairlx-text-muted"
                    }`}
                  />
                  {connected ? "Connected" : "Disconnected"}
                </span>
                <i className="fa-solid fa-chevron-right text-[10px] text-fairlx-text-muted" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

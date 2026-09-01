import { AGENT_TOOL_CATALOG } from "../constants";
import type { AgentChatMessage, AgentToolCall, AgentToolEvent } from "../types";

export type TranscriptStep = {
  call: AgentToolCall;
  result?: AgentChatMessage;
  event?: AgentToolEvent;
};

export type TranscriptBlock =
  | { kind: "user"; message: AgentChatMessage }
  | { kind: "assistant"; message: AgentChatMessage }
  | { kind: "steps"; lead?: AgentChatMessage; steps: TranscriptStep[] };

function toolAsCall(message: AgentChatMessage): AgentToolCall {
  return {
    id: message.toolCallId || message.id,
    name: message.toolName || "tool",
    arguments: "",
  };
}

export function groupTranscript(
  messages: AgentChatMessage[],
  events: AgentToolEvent[] = [],
): TranscriptBlock[] {
  const leftoverEvents = [...events];
  const takeEvent = (name: string) => {
    const pretty = name.replace(/^fairlx_/, "").replaceAll("_", " ");
    const index = leftoverEvents.findIndex((event) => {
      if (event.type === name || event.title.includes(name)) return true;
      if (pretty && event.title.toLowerCase().includes(pretty.toLowerCase())) return true;
      const payload = event.payload as { tool?: unknown } | undefined;
      return Boolean(payload && typeof payload === "object" && payload.tool === name);
    });
    if (index === -1) return undefined;
    return leftoverEvents.splice(index, 1)[0];
  };

  const consumeTools = (start: number, pending: AgentToolCall[]) => {
    const remaining = [...pending];
    const steps: TranscriptStep[] = [];
    let i = start;
    while (i + 1 < messages.length && messages[i + 1]?.role === "tool") {
      i += 1;
      const result = messages[i]!;
      const matchIdx = remaining.findIndex(
        (call) => call.id === result.toolCallId || call.name === result.toolName,
      );
      const call = matchIdx >= 0 ? remaining.splice(matchIdx, 1)[0]! : toolAsCall(result);
      steps.push({ call, result, event: takeEvent(call.name) });
    }
    for (const call of remaining) {
      steps.push({ call, event: takeEvent(call.name) });
    }
    return { steps, index: i };
  };

  const blocks: TranscriptBlock[] = [];
  for (let i = 0; i < messages.length; i += 1) {
    const message = messages[i]!;
    if (message.role === "user") {
      blocks.push({ kind: "user", message });
      continue;
    }
    if (message.role === "assistant" && message.toolCalls?.length) {
      const consumed = consumeTools(i, message.toolCalls);
      blocks.push({ kind: "steps", lead: message, steps: consumed.steps });
      i = consumed.index;
      continue;
    }
    if (message.role === "tool") {
      const steps: TranscriptStep[] = [{ call: toolAsCall(message), result: message, event: takeEvent(message.toolName || "") }];
      while (i + 1 < messages.length && messages[i + 1]?.role === "tool") {
        i += 1;
        const result = messages[i]!;
        steps.push({ call: toolAsCall(result), result, event: takeEvent(result.toolName || "") });
      }
      blocks.push({ kind: "steps", steps });
      continue;
    }
    if (message.role === "assistant") {
      blocks.push({ kind: "assistant", message });
    }
  }
  return blocks;
}

function asRecord(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function toolLabel(name: string) {
  const catalog = AGENT_TOOL_CATALOG.find((tool) => tool.id === name);
  if (catalog) return catalog.name;
  const mcp = name.startsWith("fairlx_") ? name.slice("fairlx_".length) : name;
  return mcp.replaceAll("_", " ");
}

export function summarizeToolResult(name: string, content?: string): { ok: boolean; detail: string } {
  if (!content?.trim()) return { ok: true, detail: "Done" };
  const parsed = asRecord(content);
  if (!parsed) {
    const text = content.trim();
    return { ok: !/error|failed/i.test(text), detail: text.slice(0, 140) };
  }
  const error = typeof parsed.error === "string" ? parsed.error : "";
  if (error) return { ok: false, detail: error };

  if (name === "git_status") {
    const repos = Array.isArray(parsed.repos) ? parsed.repos.length : 0;
    const staged = Array.isArray((parsed.staging as { items?: unknown[] } | undefined)?.items)
      ? ((parsed.staging as { items: unknown[] }).items.filter((item) => (item as { status?: string }).status === "staged")
          .length)
      : 0;
    return { ok: true, detail: `${repos} repos · ${staged} staged` };
  }
  if (name === "mcp_call") {
    const tool = String(parsed.tool || "tool").replace(/^fairlx_/, "").replaceAll("_", " ");
    const result = parsed.result;
    const nestedError =
      result && typeof result === "object" && "error" in result
        ? String((result as { error?: unknown }).error || "")
        : "";
    if (nestedError) return { ok: false, detail: nestedError };
    const denied = typeof parsed.error === "string" && /denied/i.test(parsed.error);
    if (denied) return { ok: false, detail: "Denied" };
    return { ok: true, detail: tool };
  }
  if (
    name === "list_work_items" ||
    name === "list_projects" ||
    name === "list_workspaces" ||
    name === "fairlx_work_item_list" ||
    name === "fairlx_project_list" ||
    name === "fairlx_workspace_list"
  ) {
    const key =
      name === "list_workspaces" || name === "fairlx_workspace_list"
        ? "workspaces"
        : name === "list_projects" || name === "fairlx_project_list"
          ? "projects"
          : "workItems";
    const count = Array.isArray(parsed[key])
      ? (parsed[key] as unknown[]).length
      : Array.isArray(parsed.items)
        ? parsed.items.length
        : 0;
    return { ok: true, detail: `${count} ${key === "workItems" ? "work items" : key}` };
  }
  if (name === "search_harness" || name === "web_search" || name === "file_search") {
    const hits = Array.isArray(parsed.hits) ? parsed.hits.length : Array.isArray(parsed.related) ? parsed.related.length : 0;
    const query = String(parsed.query || "");
    return { ok: true, detail: query ? `${query}${hits ? ` · ${hits} hits` : ""}` : `${hits} hits` };
  }
  if (name === "create_project") {
    return { ok: true, detail: String(parsed.name || "Project created") };
  }
  if (name === "database_query") {
    const collection = String(parsed.collection || parsed.table || parsed.from || "records");
    const rows = Array.isArray(parsed.documents)
      ? parsed.documents.length
      : Array.isArray(parsed.rows)
        ? parsed.rows.length
        : Array.isArray(parsed.items)
          ? parsed.items.length
          : typeof parsed.total === "number"
            ? parsed.total
            : null;
    return { ok: true, detail: rows === null ? collection : `${collection} · ${rows} rows` };
  }
  if (parsed.ok === false) {
    return { ok: false, detail: String(parsed.message || parsed.error || "Failed") };
  }
  const countKeys = ["workspaces", "projects", "workItems", "docs", "servers", "skills", "items", "members"];
  for (const key of countKeys) {
    if (Array.isArray(parsed[key])) return { ok: true, detail: `${(parsed[key] as unknown[]).length} ${key}` };
  }
  return { ok: true, detail: toolLabel(name) };
}

export function activitySummary(events: AgentToolEvent[]) {
  const thoughts = events.filter((event) => event.type === "thought");
  const searches = events.filter((event) =>
    event.type === "file_search" || event.type === "web_search" || event.type === "search_harness" || event.type === "code_inspect",
  );
  const edits = events.filter((event) =>
    event.type === "git_stage" || event.type === "git_unstage" || event.type === "git_commit_plan" || event.type === "create_project",
  );
  const terminals = events.filter((event) => event.type === "terminal");
  let thoughtMs = 0;
  if (thoughts.length >= 2) {
    thoughtMs = new Date(thoughts[thoughts.length - 1]!.createdAt).getTime() - new Date(thoughts[0]!.createdAt).getTime();
  } else if (thoughts.length === 1 && events.length > 1) {
    const next = events.find((event) => event.id !== thoughts[0]!.id);
    if (next) thoughtMs = new Date(next.createdAt).getTime() - new Date(thoughts[0]!.createdAt).getTime();
  }
  const thoughtSec = Math.max(1, Math.round(thoughtMs / 1000));
  const parts: string[] = [];
  if (thoughts.length) parts.push(`Thought for ${thoughtSec}s`);
  if (searches.length) parts.push(`Explored ${searches.length} ${searches.length === 1 ? "search" : "searches"}`);
  if (edits.length) parts.push(`${edits.length} ${edits.length === 1 ? "change" : "changes"}`);
  if (terminals.length) parts.push(`${terminals.length} terminal ${terminals.length === 1 ? "command" : "commands"}`);
  return { parts, thoughtSec, searches: searches.length, edits: edits.length, terminals: terminals.length };
}

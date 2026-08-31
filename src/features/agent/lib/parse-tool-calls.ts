import { AGENT_TOOL_CATALOG } from "../constants";
import type { AgentToolCall } from "../types";

const HARNESS_TOOL_IDS = new Set<string>(AGENT_TOOL_CATALOG.map((tool) => tool.id));

const ALIASES: Record<string, string> = {
  listworkitems: "list_work_items",
  list_work_items: "list_work_items",
  workitemlist: "list_work_items",
  work_item_list: "fairlx_work_item_list",
  listworkspacemembers: "fairlx_workspace_members_list",
  list_workspace_members: "fairlx_workspace_members_list",
  workspacemembers: "fairlx_workspace_members_list",
  workspace_members_list: "fairlx_workspace_members_list",
  listworkspacemember: "fairlx_workspace_members_list",
  updateworkspacemember: "fairlx_workspace_member_update",
  workspacememberupdate: "fairlx_workspace_member_update",
  changememberrole: "fairlx_workspace_member_update",
  updatememberrole: "fairlx_workspace_member_update",
  setmemberrole: "fairlx_workspace_member_update",
  listprojects: "list_projects",
  list_projects: "list_projects",
  project_list: "fairlx_project_list",
  listworkspaces: "list_workspaces",
  list_workspaces: "list_workspaces",
  workspace_list: "fairlx_workspace_list",
  mcplist: "mcp_list",
  mcp_list: "mcp_list",
  mcpcall: "mcp_call",
  mcp_call: "mcp_call",
  mcpresources: "mcp_resources",
  createproject: "create_project",
  create_project: "create_project",
  project_create: "fairlx_project_create",
};

export function camelToSnake(value: string): string {
  return value
    .replace(/[:./]/g, "_")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1_$2")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();
}

export function stripToolPrefix(name: string): string {
  return name
    .trim()
    .replace(/^(fairlx|mcp|tool|function)[_:]/i, "")
    .replace(/^mcp__/i, "");
}

function compactKey(value: string): string {
  return camelToSnake(stripToolPrefix(value)).replace(/_/g, "");
}

export function resolveToolName(rawName: string, mcpToolNames: string[] = []): string {
  const trimmed = rawName.trim();
  if (!trimmed) return trimmed;
  if (HARNESS_TOOL_IDS.has(trimmed)) return trimmed;
  if (mcpToolNames.includes(trimmed)) return trimmed;

  const snake = camelToSnake(stripToolPrefix(trimmed));
  const compact = compactKey(trimmed);
  const aliased = ALIASES[snake] || ALIASES[compact];
  if (aliased) return aliased;
  if (HARNESS_TOOL_IDS.has(snake)) return snake;
  if (mcpToolNames.includes(snake)) return snake;

  const fairlxPrefixed = snake.startsWith("fairlx_") ? snake : `fairlx_${snake}`;
  if (mcpToolNames.includes(fairlxPrefixed)) return fairlxPrefixed;

  if (snake.startsWith("list_")) {
    const rest = snake.slice(5);
    const asList = `fairlx_${rest}_list`;
    if (mcpToolNames.includes(asList)) return asList;
    const singular = rest.replace(/s$/, "");
    const asSingularList = `fairlx_${singular}_list`;
    if (mcpToolNames.includes(asSingularList)) return asSingularList;
  }

  const needle = snake.replace(/^fairlx_/, "").replace(/^list_/, "").replace(/_list$/, "");
  const match = mcpToolNames.find((name) => {
    const target = name.replace(/^fairlx_/, "").replace(/_list$/, "");
    return target === needle || target.replace(/s$/, "") === needle.replace(/s$/, "");
  });
  return match || snake;
}

function parseObjectLiteral(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // continue
  }
  const wrapped = trimmed.replace(/'/g, '"');
  try {
    const parsed = JSON.parse(wrapped);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return {};
  }
  return {};
}

export function normalizeAgentToolCall(call: AgentToolCall, mcpToolNames: string[] = []): AgentToolCall {
  let args: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(call.arguments || "{}");
    if (parsed && typeof parsed === "object") args = parsed as Record<string, unknown>;
  } catch {
    args = {};
  }
  if (call.name === "mcp_call") {
    const tool = resolveToolName(String(args.tool || args.name || ""), mcpToolNames);
    const inner =
      args.arguments && typeof args.arguments === "object"
        ? (args.arguments as Record<string, unknown>)
        : {};
    return {
      ...call,
      name: "mcp_call",
      arguments: JSON.stringify({ server: String(args.server || "fairlx"), tool, arguments: inner }),
    };
  }
  return toCall(call.name, args, mcpToolNames, call.id);
}

function toCall(
  name: string,
  args: Record<string, unknown>,
  mcpToolNames: string[],
  id = crypto.randomUUID(),
): AgentToolCall {
  const resolved = resolveToolName(name, mcpToolNames);
  if (mcpToolNames.includes(resolved) && !HARNESS_TOOL_IDS.has(resolved)) {
    return {
      id,
      name: "mcp_call",
      arguments: JSON.stringify({ server: "fairlx", tool: resolved, arguments: args }),
    };
  }
  return {
    id,
    name: resolved,
    arguments: JSON.stringify(args),
  };
}

const CLOSED_XML_RE =
  /<\/\s*(?:([\w-]+):)?([A-Za-z][\w.]*)\s*>/g;
const XML_BLOCK_RE =
  /<((?:[\w-]+:)?[A-Za-z][\w.]*)\b[^>]*>([\s\S]*?)<\/\s*\1\s*>/g;
const INLINE_XML_RE =
  /(?:<)?(?:([\w-]+):)?([A-Za-z][\w]*)\s+(\{[\s\S]*?\})\s*<\/\s*(?:\1:)?\2\s*>/g;
const TOOL_CALL_TAG_RE =
  /<tool_call>\s*(?:<name>|<tool>)([\s\S]*?)(?:<\/name>|<\/tool>)\s*(?:<arguments>|<args>)?([\s\S]*?)(?:<\/arguments>|<\/args>)?\s*<\/tool_call>/gi;

export function stripToolCallMarkup(content: string): string {
  if (!content) return "";
  return content
    .replace(XML_BLOCK_RE, "")
    .replace(INLINE_XML_RE, "")
    .replace(TOOL_CALL_TAG_RE, "")
    .replace(CLOSED_XML_RE, "")
    .replace(/<\/?[A-Za-z][\w.:-]*\b[^>]*>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractToolCallsFromText(content: string, mcpToolNames: string[] = []): AgentToolCall[] {
  if (!content?.trim()) return [];
  const calls: AgentToolCall[] = [];
  const seen = new Set<string>();

  const push = (name: string, argsRaw: string) => {
    const resolvedName = name.trim();
    if (!resolvedName) return;
    const args = parseObjectLiteral(argsRaw);
    const call = toCall(resolvedName, args, mcpToolNames);
    const key = `${call.name}:${call.arguments}`;
    if (seen.has(key)) return;
    seen.add(key);
    calls.push(call);
  };

  for (const match of content.matchAll(TOOL_CALL_TAG_RE)) {
    push(match[1] ?? "", match[2] ?? "{}");
  }
  for (const match of content.matchAll(XML_BLOCK_RE)) {
    const tag = match[1] ?? "";
    if (/^(think|thinking|reason|reasoning|fairlx_untrusted_content)$/i.test(tag)) continue;
    push(tag, match[2] ?? "{}");
  }
  for (const match of content.matchAll(INLINE_XML_RE)) {
    push(`${match[1] ? `${match[1]}:` : ""}${match[2] ?? ""}`, match[3] ?? "{}");
  }

  return calls;
}

export function mergeToolCalls(native: AgentToolCall[], fromText: AgentToolCall[]): AgentToolCall[] {
  const keyOf = (call: AgentToolCall) => `${call.name}:${call.arguments}`;
  const seen = new Set(native.map(keyOf));
  const extra = fromText.filter((call) => !seen.has(keyOf(call)));
  return extra.length ? [...native, ...extra] : native;
}

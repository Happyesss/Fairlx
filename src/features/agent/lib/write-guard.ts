import type { AgentPendingConfirmation, AgentToolCall, AgentToolEvent } from "../types";

const HARNESS_WRITES = new Set(["create_project"]);
const WRITE_NAME_RE = /_(create|update|delete|add|set|start|complete|split|sync|remove|mark_read)$/i;

export function mcpToolNameFromCall(call: AgentToolCall): string | undefined {
  if (call.name !== "mcp_call" && call.name !== "create_project") {
    if (call.name.startsWith("fairlx_")) return call.name;
    return undefined;
  }
  try {
    const parsed = JSON.parse(call.arguments || "{}") as Record<string, unknown>;
    const tool = parsed.tool ?? parsed.name;
    return typeof tool === "string" && tool ? tool : undefined;
  } catch {
    return undefined;
  }
}

export function isWriteToolCall(call: AgentToolCall): boolean {
  if (HARNESS_WRITES.has(call.name)) return true;
  const mcpName = mcpToolNameFromCall(call) ?? (call.name.startsWith("fairlx_") ? call.name : "");
  if (!mcpName) return false;
  return WRITE_NAME_RE.test(mcpName);
}

export function confirmationSummary(call: AgentToolCall): string {
  const mcpName = mcpToolNameFromCall(call) ?? call.name;
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(call.arguments || "{}") as Record<string, unknown>;
  } catch {
    args = {};
  }
  const nested =
    args.arguments && typeof args.arguments === "object"
      ? (args.arguments as Record<string, unknown>)
      : args;
  const label = String(nested.name || nested.title || nested.key || "").trim();
  const role = String(nested.role || "").trim();
  const action = mcpName
    .replace(/^fairlx_/, "")
    .replaceAll("_", " ")
    .trim();
  if (/work_item_create/i.test(mcpName) && label) {
    const type = String(nested.type || "Task").toLowerCase();
    const formattedType = type.charAt(0).toUpperCase() + type.slice(1);
    const priority = nested.priority ? ` [${String(nested.priority)}]` : "";
    return `Create ${formattedType}: "${label}"${priority}?`;
  }
  if (/project_team_member_add/i.test(mcpName)) {
    const person = String(nested.name || nested.email || "").trim();
    const team = String(nested.teamName || nested.team || "").trim();
    if (person && team) return `Add ${person} to ${team}?`;
    if (person) return `Add ${person} to the team?`;
  }
  if (/project_team_member_remove/i.test(mcpName)) {
    const person = String(nested.name || nested.email || "").trim();
    const team = String(nested.teamName || nested.team || "").trim();
    if (person && team) return `Remove ${person} from ${team}?`;
    if (person) return `Remove ${person} from the team?`;
  }
  if (/project_team_create/i.test(mcpName) && label) {
    return `Create team "${label}"?`;
  }
  if (/workspace_member_add/i.test(mcpName) && label) {
    return role ? `Add ${label} as ${role}?` : `Add ${label} to the workspace?`;
  }
  if (/workspace_member_remove/i.test(mcpName) && label) {
    return `Remove ${label} from the workspace?`;
  }
  if (/workspace_member_update/i.test(mcpName) && (label || role)) {
    if (label && role) return `Make ${label} ${role}?`;
    if (label) return `Update ${label}'s role?`;
    return `Change member role to ${role}?`;
  }
  if (/delete/i.test(mcpName)) {
    return label ? `Delete ${label}?` : `Delete via ${action}?`;
  }
  if (/update|set|complete|start|sync/i.test(mcpName)) {
    return label ? `Update ${label}?` : `Apply ${action}?`;
  }
  if (/create|add/i.test(mcpName) || call.name === "create_project") {
    return label ? `Create ${label}?` : `Create via ${action}?`;
  }
  return label ? `Apply ${action} to ${label}?` : `Apply ${action}?`;
}

export type ParsedWorkItemCall = {
  id: string;
  toolName: string;
  projectId?: string;
  title: string;
  type: string;
  priority: string;
  description?: string;
  labels: string[];
  sprintId?: string;
};

export function parseWorkItemCall(call: AgentToolCall): ParsedWorkItemCall | null {
  const mcpName = mcpToolNameFromCall(call) ?? call.name;
  if (!/work_item_create/i.test(mcpName)) return null;
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(call.arguments || "{}") as Record<string, unknown>;
  } catch {
    args = {};
  }
  const nested =
    args.arguments && typeof args.arguments === "object"
      ? (args.arguments as Record<string, unknown>)
      : args;
  const title = String(nested.title || nested.name || "").trim();
  if (!title) return null;
  const type = String(nested.type || "TASK").toUpperCase();
  const priority = String(nested.priority || "MEDIUM").toUpperCase();
  const description = typeof nested.description === "string" ? nested.description.trim() : undefined;
  const labels = Array.isArray(nested.labels)
    ? nested.labels.map(String).filter(Boolean)
    : [];
  return {
    id: call.id,
    toolName: mcpName,
    projectId: typeof nested.projectId === "string" ? nested.projectId : undefined,
    title,
    type,
    priority,
    description,
    labels,
    sprintId: typeof nested.sprintId === "string" ? nested.sprintId : undefined,
  };
}

export type ParsedConfirmationCall = {
  id: string;
  call: AgentToolCall;
  toolName: string;
  action: string;
  label: string;
  summary: string;
  workItem?: ParsedWorkItemCall;
};

export function parseConfirmationCall(call: AgentToolCall): ParsedConfirmationCall {
  const mcpName = mcpToolNameFromCall(call) ?? call.name;
  const workItem = parseWorkItemCall(call) ?? undefined;
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(call.arguments || "{}") as Record<string, unknown>;
  } catch {
    args = {};
  }
  const nested =
    args.arguments && typeof args.arguments === "object"
      ? (args.arguments as Record<string, unknown>)
      : args;
  const label = String(nested.name || nested.title || nested.key || "").trim();
  const action = mcpName.replace(/^fairlx_/, "").replaceAll("_", " ").trim();
  return {
    id: call.id,
    call,
    toolName: mcpName,
    action,
    label,
    summary: confirmationSummary(call),
    workItem,
  };
}

export function pendingFromEvent(event: AgentToolEvent | undefined): AgentPendingConfirmation | undefined {
  if (!event || event.type !== "confirmation") return undefined;
  const payload = event.payload;
  if (!payload || typeof payload !== "object") return undefined;
  const data = payload as AgentPendingConfirmation;
  if (!Array.isArray(data.calls) || data.calls.length === 0) return undefined;
  return data;
}

export function findPendingConfirmation(events: AgentToolEvent[]): AgentPendingConfirmation | undefined {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i]!;
    if (event.type === "confirmation") return pendingFromEvent(event);
    if (event.type === "confirmation_resolved") return undefined;
  }
  return undefined;
}

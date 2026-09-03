import { routes } from "@/lib/routes";

import type { AgentChatMessage } from "../types";
import type { TranscriptBlock, TranscriptStep } from "./transcript";
import { unwrapMcpToolContent } from "./truncate";

export type AgentProjectLaunch = {
  workspaceId: string;
  projectId: string;
  name?: string;
};

const BOARD_MUTATION_RE =
  /(^create_project$|project_create|sprint_create|sprint_start|sprint_update|sprint_complete|sprint_delete|work_item_create|work_item_update|work_item_bulk_update|work_item_split|work_item_delete|subtask_create|subtask_update|subtask_delete|comment_add|comment_delete|link_create|link_delete)/i;

export function isBoardMutationTool(name: string): boolean {
  const tool = name.trim();
  if (!tool) return false;
  if (tool === "mcp_call") return false;
  return BOARD_MUTATION_RE.test(tool);
}

function asRecord(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(unwrapMcpToolContent(raw));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function nestedRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringField(record: Record<string, unknown> | null | undefined, ...keys: string[]): string {
  if (!record) return "";
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function parseArgs(raw?: string): Record<string, unknown> | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const record = parsed as Record<string, unknown>;
    const nested = nestedRecord(record.arguments);
    return nested ?? record;
  } catch {
    return null;
  }
}

function firstWorkItem(record: Record<string, unknown>): Record<string, unknown> | null {
  const single = nestedRecord(record.workItem);
  if (single) return single;
  if (Array.isArray(record.workItems) && record.workItems[0]) {
    return nestedRecord(record.workItems[0]);
  }
  if (Array.isArray(record.created) && record.created[0]) {
    return nestedRecord(record.created[0]);
  }
  return null;
}

function isProjectCreateTool(name: string): boolean {
  return name === "create_project" || /project_create/i.test(name);
}

export function extractBoardProjectFromTool(
  name: string,
  content?: string,
  argsJson?: string,
): AgentProjectLaunch | null {
  if (content && /denied|error/i.test(content) && asRecord(content)?.error) return null;
  const parsed = content ? asRecord(content) : null;
  if (parsed?.error) return null;

  let record = parsed;
  let toolName = name;
  if (name === "mcp_call" && parsed) {
    toolName = String(parsed.tool || parsed.name || "");
    record = nestedRecord(parsed.result) ?? parsed;
  }
  if (!isBoardMutationTool(toolName)) return null;

  const args = parseArgs(argsJson);
  const project = nestedRecord(record?.project);
  const sprint = nestedRecord(record?.sprint);
  const workItem = record ? firstWorkItem(record) : null;

  let projectId =
    stringField(project, "id", "$id") ||
    stringField(sprint, "projectId") ||
    stringField(workItem, "projectId") ||
    stringField(record, "projectId") ||
    stringField(args, "projectId");

  if (!projectId && isProjectCreateTool(toolName)) {
    projectId = stringField(record, "id", "$id");
  }

  const workspaceId =
    stringField(project, "workspaceId") ||
    stringField(sprint, "workspaceId") ||
    stringField(workItem, "workspaceId") ||
    stringField(record, "workspaceId") ||
    stringField(args, "workspaceId");

  const nameValue =
    stringField(project, "name") || (isProjectCreateTool(toolName) ? stringField(record, "name") : "");

  if (!projectId) return null;
  return {
    projectId,
    workspaceId,
    name: nameValue || undefined,
  };
}

/** @deprecated use extractBoardProject */
export function extractCreatedProject(messages: AgentChatMessage[]): AgentProjectLaunch | null {
  return extractBoardProject(messages);
}

export function extractBoardProject(messages: AgentChatMessage[]): AgentProjectLaunch | null {
  const argsByCallId = new Map<string, string>();
  for (const message of messages) {
    if (message.role !== "assistant" || !message.toolCalls?.length) continue;
    for (const call of message.toolCalls) {
      if (call.id && call.arguments) argsByCallId.set(call.id, call.arguments);
    }
  }

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (!message || message.role !== "tool") continue;
    const args = message.toolCallId ? argsByCallId.get(message.toolCallId) : undefined;
    const launch = extractBoardProjectFromTool(message.toolName || "", message.content, args);
    if (launch?.projectId) {
      if (launch.workspaceId) return launch;
      const earlier = fillWorkspaceFromEarlier(messages, i, launch.projectId);
      return earlier ?? launch;
    }
  }
  return null;
}

function fillWorkspaceFromEarlier(
  messages: AgentChatMessage[],
  fromIndex: number,
  projectId: string,
): AgentProjectLaunch | null {
  for (let i = fromIndex - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (!message || message.role !== "tool") continue;
    const launch = extractBoardProjectFromTool(message.toolName || "", message.content);
    if (launch?.projectId === projectId && launch.workspaceId) return launch;
  }
  return null;
}

export function withWorkspaceFallback(
  launch: AgentProjectLaunch | null,
  workspaceId?: string | null,
): AgentProjectLaunch | null {
  if (!launch) return null;
  const nextWorkspace = launch.workspaceId || workspaceId?.trim() || "";
  if (!nextWorkspace) return null;
  return { ...launch, workspaceId: nextWorkspace };
}

export function projectKanbanHref(launch: AgentProjectLaunch): string {
  return routes.projectKanban(launch.workspaceId, launch.projectId);
}

export function userAskedToViewBoard(content: string): boolean {
  const text = content.toLowerCase();
  if (!/\b(kanban|board|sprint board)\b/.test(text)) return false;
  return /\b(open|view|show|see|take me|go to|launch)\b/.test(text);
}

function callArguments(step: TranscriptStep): string | undefined {
  const args = step.call.arguments;
  if (typeof args === "string") return args;
  if (args && typeof args === "object") return JSON.stringify(args);
  return undefined;
}

export function launchFromSteps(
  steps: TranscriptStep[],
  workspaceFallback?: string | null,
): AgentProjectLaunch | null {
  for (let i = steps.length - 1; i >= 0; i -= 1) {
    const step = steps[i];
    if (!step) continue;
    const launch = extractBoardProjectFromTool(step.call.name, step.result?.content, callArguments(step));
    const resolved = withWorkspaceFallback(launch, workspaceFallback);
    if (resolved) return resolved;
  }
  return null;
}

function nextAssistantIndex(blocks: TranscriptBlock[], from: number): number | null {
  for (let i = from + 1; i < blocks.length; i += 1) {
    const block = blocks[i];
    if (!block) continue;
    if (block.kind === "user") return null;
    if (block.kind === "assistant") return i;
  }
  return null;
}

export function kanbanCtasForBlocks(
  blocks: TranscriptBlock[],
  workspaceFallback?: string | null,
  knownLaunch?: AgentProjectLaunch | null,
): Map<number, AgentProjectLaunch> {
  const map = new Map<number, AgentProjectLaunch>();
  const fallback = withWorkspaceFallback(knownLaunch ?? null, workspaceFallback);

  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];
    if (!block) continue;

    if (block.kind === "steps") {
      const launch = launchFromSteps(block.steps, workspaceFallback);
      if (!launch) continue;
      const target = nextAssistantIndex(blocks, i) ?? i;
      map.set(target, launch);
      continue;
    }

    if (block.kind === "user" && fallback && userAskedToViewBoard(block.message.content)) {
      const target = nextAssistantIndex(blocks, i) ?? i;
      if (!map.has(target)) map.set(target, fallback);
    }
  }
  return map;
}

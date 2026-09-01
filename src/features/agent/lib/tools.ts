import type { Databases } from "node-appwrite";
import type { AuthContext } from "@fairlx/mcp-server";

import type {
  AgentContext,
  AgentHarness,
  AgentRun,
  AgentRunMode,
  AgentSpecialistId,
  AgentToolEvent,
  AgentToolEventType,
  McpConfig,
} from "../types";
import { AGENT_TOOL_CATALOG } from "../constants";
import { specialistById } from "./graph";
import { commitStaged, stageItem, unstageItem } from "./git-staging";
import { callMcpServerTool, ensurePersonalMcp, listMcpResourcesForServer } from "./mcp-bridge";
import { createFairlxProject } from "./mutations";
import { readPersonalContent } from "./personal";
import { toPublicMcpConfig } from "./public-mcp";
import { matchingAutomations, searchAgentIndex } from "./search";
import { HARNESS_TO_MCP } from "./parse-tool-calls";
import { compactJsonString } from "./truncate";

export type OpenAiTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type ToolExecutionContext = {
  runId: string;
  userId: string;
  context: AgentContext;
  harness: AgentHarness;
  mcp: McpConfig;
  databases?: Databases;
  runs?: AgentRun[];
  workspaceId?: string;
  projectId?: string;
  mcpAuth?: AuthContext;
};

export type ToolExecutionResult = {
  content: string;
  event: AgentToolEvent;
  harnessPatch?: Partial<Pick<AgentHarness, "gitStaging" | "chatMeta">>;
  delegate?: { agent: AgentSpecialistId; task: string };
};

const TOOL_PARAMETERS: Record<string, { description: string; parameters: Record<string, unknown> }> = {
  code_inspect: {
    description: "Inspect Fairlx work items, repositories, and docs related to the current user.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "What to inspect." },
        kind: { type: "string", enum: ["work_item", "repo", "doc", "all"] },
      },
    },
  },
  terminal: {
    description: "Record a planned shell command. Never executed on the Fairlx host.",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string" },
        cwd: { type: "string" },
      },
      required: ["command"],
    },
  },
  file_search: {
    description: "Search Fairlx docs and work items.",
    parameters: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  web_search: {
    description: "Search the public web via DuckDuckGo instant answers.",
    parameters: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  database_query: {
    description: "Query Fairlx workspaces, projects, work items, or docs.",
    parameters: {
      type: "object",
      properties: {
        collection: { type: "string", enum: ["workspaces", "projects", "work_items", "docs", "all"] },
        query: { type: "string" },
      },
    },
  },
  use_skill: {
    description: "Load an enabled harness skill by id or name.",
    parameters: {
      type: "object",
      properties: {
        skillId: { type: "string" },
        name: { type: "string" },
      },
    },
  },
  list_workspaces: {
    description: "List the user's Fairlx workspaces.",
    parameters: { type: "object", properties: {} },
  },
  list_projects: {
    description: "List Fairlx projects, optionally filtered by workspaceId.",
    parameters: {
      type: "object",
      properties: { workspaceId: { type: "string" } },
    },
  },
  list_work_items: {
    description: "List assigned work items, optionally filtered.",
    parameters: {
      type: "object",
      properties: {
        workspaceId: { type: "string" },
        projectId: { type: "string" },
        query: { type: "string" },
      },
    },
  },
  mcp_list: {
    description: "List configured MCP servers without leaking secrets.",
    parameters: { type: "object", properties: {} },
  },
  mcp_call: {
    description: "Call a tool on an external MCP server only. For Fairlx platform data, call the native fairlx_* tools directly — do not wrap them in mcp_call.",
    parameters: {
      type: "object",
      properties: {
        server: { type: "string" },
        tool: { type: "string" },
        arguments: { type: "object" },
      },
      required: ["tool"],
    },
  },
  mcp_resources: {
    description: "List MCP resources for a server, including fairlx://me/* personal content.",
    parameters: {
      type: "object",
      properties: { server: { type: "string" } },
    },
  },
  delegate_agent: {
    description: "Delegate a focused task to a specialist: planner, researcher, builder, git, or reviewer.",
    parameters: {
      type: "object",
      properties: {
        agent: { type: "string", enum: ["planner", "researcher", "builder", "git", "reviewer"] },
        task: { type: "string" },
      },
      required: ["task"],
    },
  },
  search_harness: {
    description: "Search chats, workspaces, projects, skills, knowledge, automations, docs, repos, MCP, and staging.",
    parameters: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  create_project: {
    description: "Create a Fairlx project in a workspace the user belongs to.",
    parameters: {
      type: "object",
      properties: {
        workspaceId: { type: "string" },
        name: { type: "string" },
        description: { type: "string" },
      },
      required: ["name"],
    },
  },
  git_status: {
    description: "Show linked GitHub repositories and the Agent git staging buffer.",
    parameters: { type: "object", properties: {} },
  },
  git_stage: {
    description: "Stage a planned change. Does not run git on the host.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        summary: { type: "string" },
        repoId: { type: "string" },
        branch: { type: "string" },
      },
      required: ["path"],
    },
  },
  git_unstage: {
    description: "Unstage a planned change by id or path.",
    parameters: {
      type: "object",
      properties: { id: { type: "string" }, path: { type: "string" } },
    },
  },
  git_commit_plan: {
    description: "Mark staged items as a planned commit. Never executes git commit on the host.",
    parameters: {
      type: "object",
      properties: { message: { type: "string" } },
      required: ["message"],
    },
  },
  run_automation: {
    description: "Load a saved automation and return the action the Agent should follow.",
    parameters: {
      type: "object",
      properties: { automationId: { type: "string" }, name: { type: "string" } },
    },
  },
  personal_read: {
    description: "Read personal MCP content: harness, skills, knowledge, rules, automations, chats, staging.",
    parameters: {
      type: "object",
      properties: {
        kind: {
          type: "string",
          enum: ["harness", "skills", "knowledge", "rules", "automations", "chats", "staging"],
        },
        query: { type: "string" },
      },
    },
  },
};

export function openaiToolsForMode(mode: AgentRunMode, enabledTools: string[]): OpenAiTool[] {
  if (mode !== "agent") return [];
  const enabled = new Set(enabledTools);
  return AGENT_TOOL_CATALOG.filter((tool) => enabled.has(tool.id)).map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.id,
      description: TOOL_PARAMETERS[tool.id]?.description ?? tool.description,
      parameters: TOOL_PARAMETERS[tool.id]?.parameters ?? { type: "object", properties: {} },
    },
  }));
}

function mcpToolDescription(tool: {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}): string {
  const required = Array.isArray(tool.inputSchema?.required)
    ? (tool.inputSchema.required as unknown[]).filter((item): item is string => typeof item === "string")
    : [];
  const parts = [tool.description?.trim() || tool.name];
  if (required.length) parts.push(`Required arguments: ${required.join(", ")}.`);
  parts.push("Call this tool directly; do not wrap it in mcp_call.");
  return parts.join(" ");
}

export function openaiToolsForTurn(params: {
  mode: AgentRunMode;
  enabledTools: string[];
  mcpTools?: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>;
}): OpenAiTool[] {
  const mcpTools = params.mcpTools ?? [];
  const mcpNames = new Set(mcpTools.map((tool) => tool.name));
  const harness = openaiToolsForMode(params.mode, params.enabledTools).filter((tool) => {
    const mapped = HARNESS_TO_MCP[tool.function.name];
    return !(mapped && mcpNames.has(mapped));
  });
  if (params.mode !== "agent") return harness;
  const existing = new Set(harness.map((tool) => tool.function.name));
  const mcp = mcpTools
    .filter((tool) => !existing.has(tool.name))
    .map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: mcpToolDescription(tool),
        parameters: tool.inputSchema?.type ? tool.inputSchema : { type: "object", properties: tool.inputSchema ?? {} },
      },
    }));
  return [...harness, ...mcp];
}

function compactEventPayload(payload: unknown): unknown {
  if (payload == null) return payload;
  try {
    if (JSON.stringify(payload).length <= 600) return payload;
  } catch {
    return undefined;
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { truncated: true };
  }
  const source = payload as Record<string, unknown>;
  const slim: Record<string, unknown> = {};
  for (const key of ["server", "tool", "error", "query", "name", "kind", "command", "cwd", "status"]) {
    if (source[key] != null) slim[key] = source[key];
  }
  return Object.keys(slim).length ? slim : { truncated: true };
}

function unwrapMcpToolContent(content: string): string {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return content;
    if (parsed.server != null && parsed.tool != null && "result" in parsed) {
      const result = parsed.result;
      return typeof result === "string" ? result : JSON.stringify(result ?? null);
    }
  } catch {
    return content;
  }
  return content;
}

function event(
  runId: string,
  type: AgentToolEventType,
  title: string,
  detail?: string,
  payload?: unknown,
): AgentToolEvent {
  return {
    id: crypto.randomUUID(),
    type,
    title,
    detail,
    payload: compactEventPayload(payload),
    createdAt: new Date().toISOString(),
    runId,
  };
}

function parseArgs(args: unknown): Record<string, unknown> {
  if (typeof args === "string") {
    try {
      const parsed = JSON.parse(args);
      if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
    } catch {
      return { raw: args };
    }
  }
  if (args && typeof args === "object") return args as Record<string, unknown>;
  return {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

export function applyScopeDefaults(args: Record<string, unknown>, ctx: ToolExecutionContext): Record<string, unknown> {
  const next = { ...args };
  const rawWs = asString(next.workspaceId);
  if (!rawWs) {
    if (ctx.workspaceId) next.workspaceId = ctx.workspaceId;
  } else {
    const matchedWs = ctx.context.workspaces.find(
      (w) => w.id === rawWs || w.name.toLowerCase() === rawWs.toLowerCase()
    );
    if (matchedWs) next.workspaceId = matchedWs.id;
  }
  const rawProj = asString(next.projectId);
  if (!rawProj) {
    if (ctx.projectId) next.projectId = ctx.projectId;
  } else {
    const matchedProj = ctx.context.projects.find(
      (p) =>
        p.id === rawProj ||
        p.name.toLowerCase() === rawProj.toLowerCase() ||
        (p.key && p.key.toLowerCase() === rawProj.toLowerCase())
    );
    if (matchedProj) next.projectId = matchedProj.id;
  }
  if (next.arguments && typeof next.arguments === "object") {
    next.arguments = applyScopeDefaults(next.arguments as Record<string, unknown>, ctx);
  }
  return next;
}

function matchesQuery(haystack: string, query: string): boolean {
  if (!query.trim()) return true;
  return haystack.toLowerCase().includes(query.toLowerCase());
}

async function duckDuckGo(query: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return { error: `DuckDuckGo returned ${response.status}` };
    return await response.json();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Web search failed" };
  } finally {
    clearTimeout(timer);
  }
}

export async function executeTool(
  name: string,
  args: unknown,
  ctx: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const parsed = applyScopeDefaults(parseArgs(args), ctx);
  if (name.startsWith("fairlx_")) {
    const inner = await executeTool(
      "mcp_call",
      { server: "fairlx", tool: name, arguments: parsed },
      ctx,
    );
    return {
      ...inner,
      content: compactJsonString(unwrapMcpToolContent(inner.content), 8000),
    };
  }
  const query = asString(parsed.query || parsed.q || parsed.search);
  const { context, harness, mcp, runId } = ctx;
  const publicMcp = toPublicMcpConfig(ensurePersonalMcp(mcp));
  const mcpCtx = {
    userId: ctx.userId,
    mcp,
    harness,
    runs: ctx.runs,
    databases: ctx.databases,
    auth: ctx.mcpAuth,
  };

  switch (name) {
    case "code_inspect": {
      const kind = asString(parsed.kind) || "all";
      const workItems = context.workItems.filter((item) =>
        matchesQuery(`${item.key ?? ""} ${item.title} ${item.status ?? ""}`, query),
      );
      const repos = context.githubRepos.filter((repo) =>
        matchesQuery(`${repo.repositoryName ?? ""} ${repo.owner ?? ""} ${repo.githubUrl ?? ""}`, query),
      );
      const docs = context.docs.filter((doc) =>
        matchesQuery(`${doc.title ?? ""} ${doc.name ?? ""} ${doc.description ?? ""}`, query),
      );
      const payload = {
        kind,
        query,
        workItems: kind === "repo" || kind === "doc" ? [] : workItems.slice(0, 12),
        repos: kind === "work_item" || kind === "doc" ? [] : repos.slice(0, 12),
        docs: kind === "work_item" || kind === "repo" ? [] : docs.slice(0, 12),
      };
      return {
        content: JSON.stringify(payload),
        event: event(
          runId,
          "code_inspect",
          "Inspected Fairlx code context",
          query || "Current work items, repos, and docs",
          payload,
        ),
      };
    }
    case "terminal": {
      const command = asString(parsed.command || parsed.cmd || parsed.input);
      const cwd = asString(parsed.cwd) || ".";
      const payload = {
        command,
        cwd,
        status: "recorded",
        note: "sandbox: command recorded, not executed on host",
      };
      return {
        content: JSON.stringify(payload),
        event: event(
          runId,
          "terminal",
          command || "Recorded terminal command",
          "sandbox: command recorded, not executed on host",
          payload,
        ),
      };
    }
    case "file_search": {
      const docs = context.docs.filter((doc) =>
        matchesQuery(`${doc.title ?? ""} ${doc.name ?? ""} ${doc.description ?? ""} ${doc.category ?? ""}`, query),
      );
      const workItems = context.workItems.filter((item) =>
        matchesQuery(`${item.key ?? ""} ${item.title}`, query),
      );
      const payload = { query, docs: docs.slice(0, 20), workItems: workItems.slice(0, 20) };
      return {
        content: JSON.stringify(payload),
        event: event(
          runId,
          "file_search",
          query ? `Searched files for "${query}"` : "Searched Fairlx files",
          undefined,
          payload,
        ),
      };
    }
    case "web_search": {
      const result = await duckDuckGo(query || "fairlx");
      const payload = { query, result };
      const heading =
        result && typeof result === "object" && "Heading" in result
          ? asString((result as Record<string, unknown>).Heading)
          : "";
      const abstract =
        result && typeof result === "object" && "AbstractText" in result
          ? asString((result as Record<string, unknown>).AbstractText)
          : "";
      const relatedRaw =
        result && typeof result === "object" && Array.isArray((result as { RelatedTopics?: unknown }).RelatedTopics)
          ? ((result as { RelatedTopics: Array<{ Text?: string; FirstURL?: string }> }).RelatedTopics || [])
          : [];
      return {
        content: JSON.stringify({
          query,
          heading,
          abstract,
          related: relatedRaw.slice(0, 8).map((topic) => ({ text: topic.Text, url: topic.FirstURL })),
        }),
        event: event(
          runId,
          "web_search",
          query ? `Web search: ${query}` : "Web search",
          abstract || heading || undefined,
          payload,
        ),
      };
    }
    case "database_query": {
      const collection = asString(parsed.collection || parsed.table || parsed.target) || "all";
      const payload = {
        collection,
        query,
        workspaces: collection === "all" || collection === "workspaces" ? context.workspaces : [],
        projects: collection === "all" || collection === "projects" ? context.projects : [],
        workItems: collection === "all" || collection === "work_items" ? context.workItems : [],
        docs: collection === "all" || collection === "docs" ? context.docs : [],
      };
      return {
        content: JSON.stringify(payload),
        event: event(runId, "database_query", `Queried ${collection}`, query || undefined, payload),
      };
    }
    case "use_skill": {
      const skillId = asString(parsed.skillId || parsed.id);
      const skillName = asString(parsed.name);
      const skill =
        harness.skills.find((item) => item.id === skillId || item.name.toLowerCase() === skillName.toLowerCase()) ??
        harness.skills.find((item) => item.enabled);
      const payload = skill
        ? {
            id: skill.id,
            name: skill.name,
            description: skill.description,
            instructions: skill.instructions,
            enabled: skill.enabled,
          }
        : { error: "Skill not found", skillId, skillName };
      return {
        content: JSON.stringify(payload),
        event: event(
          runId,
          "use_skill",
          skill ? `Used skill: ${skill.name}` : "Skill not found",
          skill?.description,
          payload,
        ),
      };
    }
    case "list_workspaces": {
      const payload = {
        workspaces: context.workspaces.map(({ inviteCode: _inviteCode, ...rest }) => rest),
      };
      return {
        content: JSON.stringify(payload),
        event: event(runId, "list_workspaces", `${context.workspaces.length} workspaces`, undefined, payload),
      };
    }
    case "list_projects": {
      const workspaceId = asString(parsed.workspaceId);
      const projects = workspaceId
        ? context.projects.filter((project) => project.workspaceId === workspaceId)
        : context.projects;
      const payload = { workspaceId: workspaceId || undefined, projects };
      return {
        content: JSON.stringify(payload),
        event: event(runId, "list_projects", `${projects.length} projects`, undefined, payload),
      };
    }
    case "list_work_items": {
      const workspaceId = asString(parsed.workspaceId);
      const projectId = asString(parsed.projectId);
      const items = context.workItems.filter((item) => {
        if (workspaceId && item.workspaceId !== workspaceId) return false;
        if (projectId && item.projectId !== projectId) return false;
        return matchesQuery(`${item.key ?? ""} ${item.title} ${item.status ?? ""}`, query);
      });
      const payload = { workspaceId: workspaceId || undefined, projectId: projectId || undefined, workItems: items };
      return {
        content: JSON.stringify(payload),
        event: event(runId, "list_work_items", `${items.length} work items`, undefined, payload),
      };
    }
    case "mcp_list": {
      const servers = Object.entries(publicMcp.mcpServers ?? {}).map(([serverName, server]) => ({
        name: serverName,
        transport: server.transport,
        url: server.url,
        command: server.command,
        disabled: Boolean(server.disabled),
        personal: serverName === "fairlx-personal",
      }));
      const payload = { servers };
      return {
        content: JSON.stringify(payload),
        event: event(runId, "mcp_list", `${servers.length} MCP servers`, undefined, payload),
      };
    }
    case "mcp_call": {
      const tool = asString(parsed.tool || parsed.name || parsed.method);
      const server = asString(parsed.server) || "fairlx";
      const callArgs =
        parsed.arguments && typeof parsed.arguments === "object"
          ? (parsed.arguments as Record<string, unknown>)
          : parsed.args && typeof parsed.args === "object"
            ? (parsed.args as Record<string, unknown>)
            : {};
      if (!tool) {
        const payload = { error: "tool is required" };
        return {
          content: JSON.stringify(payload),
          event: event(runId, "mcp_call", "MCP call missing tool", undefined, payload),
        };
      }
      const effectiveArgs = applyScopeDefaults(callArgs, ctx);
      console.log(`[Fairlx Agent] 🛠️ Calling MCP Tool -> Server: "${server}", Tool: "${tool}", Args:`, JSON.stringify(effectiveArgs));
      try {
        const result = await callMcpServerTool({
          server,
          tool,
          args: effectiveArgs,
          ctx: mcpCtx,
        });
        console.log(`[Fairlx Agent] ✅ MCP Tool "${tool}" succeeded:`, JSON.stringify(result));
        return {
          content: compactJsonString(JSON.stringify(result), 8000),
          event: event(runId, "mcp_call", tool.replace(/^fairlx_/, "").replaceAll("_", " "), undefined, { server, tool }),
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "MCP call failed";
        console.error(`[Fairlx Agent] ❌ MCP Tool "${tool}" failed:`, errorMessage, { server, args: effectiveArgs });
        const payload = { server, tool, error: errorMessage };
        return {
          content: JSON.stringify(payload),
          event: event(runId, "error", `${tool.replace(/^fairlx_/, "").replaceAll("_", " ")} failed`, payload.error, payload),
        };
      }
    }
    case "mcp_resources": {
      const server = asString(parsed.server) || "fairlx-personal";
      try {
        const result = await listMcpResourcesForServer(server, mcpCtx);
        return {
          content: JSON.stringify(result),
          event: event(runId, "mcp_resources", `Resources: ${server}`, undefined, result),
        };
      } catch (error) {
        const payload = { error: error instanceof Error ? error.message : "Failed to list MCP resources" };
        return {
          content: JSON.stringify(payload),
          event: event(runId, "error", "MCP resources failed", payload.error, payload),
        };
      }
    }
    case "delegate_agent": {
      const agent = specialistById(asString(parsed.agent) || "planner");
      const task = asString(parsed.task || parsed.prompt || query);
      const payload = { agent, task };
      return {
        content: JSON.stringify(payload),
        event: event(runId, "delegate_agent", `Delegated to ${agent}`, task || undefined, payload),
        delegate: { agent: agent === "orchestrator" ? "planner" : agent, task: task || "Continue the current request." },
      };
    }
    case "search_harness": {
      const hits = searchAgentIndex({
        query,
        runs: ctx.runs,
        context,
        harness,
        mcp: publicMcp,
        limit: 24,
      });
      const payload = { query, hits };
      return {
        content: JSON.stringify(payload),
        event: event(runId, "search_harness", query ? `Search: ${query}` : "Harness search", `${hits.length} hits`, payload),
      };
    }
    case "create_project": {
      const workspaceId =
        asString(parsed.workspaceId) || harness.settings.defaultWorkspaceId || context.workspaces[0]?.id || "";
      const name = asString(parsed.name || parsed.title);
      if (!ctx.databases) {
        const payload = { error: "Project creation is unavailable in this turn." };
        return {
          content: JSON.stringify(payload),
          event: event(runId, "error", "Create project unavailable", undefined, payload),
        };
      }
      try {
        const created = await createFairlxProject({
          databases: ctx.databases,
          userId: ctx.userId,
          workspaceId,
          name,
          description: asString(parsed.description) || undefined,
        });
        return {
          content: JSON.stringify(created),
          event: event(runId, "create_project", `Created project ${created.name}`, created.workspaceId, created),
        };
      } catch (error) {
        const payload = { error: error instanceof Error ? error.message : "Failed to create project." };
        return {
          content: JSON.stringify(payload),
          event: event(runId, "error", "Create project failed", payload.error, payload),
        };
      }
    }
    case "git_status": {
      const payload = {
        repos: context.githubRepos,
        staging: harness.gitStaging,
        note: "Staging is a Fairlx harness buffer. Git is never executed on the host.",
      };
      return {
        content: JSON.stringify(payload),
        event: event(
          runId,
          "git_status",
          `${context.githubRepos.length} repos · ${harness.gitStaging.items.filter((item) => item.status === "staged").length} staged`,
          undefined,
          payload,
        ),
      };
    }
    case "git_stage": {
      const next = stageItem(harness.gitStaging, {
        path: asString(parsed.path || parsed.file),
        summary: asString(parsed.summary || parsed.message),
        repoId: asString(parsed.repoId) || undefined,
        branch: asString(parsed.branch) || undefined,
        content: asString(parsed.content) || undefined,
      });
      const payload = { staging: next };
      return {
        content: JSON.stringify(payload),
        event: event(runId, "git_stage", `Staged ${asString(parsed.path)}`, undefined, payload),
        harnessPatch: { gitStaging: next },
      };
    }
    case "git_unstage": {
      const next = unstageItem(harness.gitStaging, asString(parsed.id || parsed.path));
      const payload = { staging: next };
      return {
        content: JSON.stringify(payload),
        event: event(runId, "git_unstage", "Unstaged change", undefined, payload),
        harnessPatch: { gitStaging: next },
      };
    }
    case "git_commit_plan": {
      const planned = commitStaged(harness.gitStaging, asString(parsed.message || parsed.commit));
      const payload = {
        message: planned.message,
        committed: planned.committed,
        staging: planned.staging,
        note: "Commit recorded in the harness buffer. Not executed on the host.",
      };
      return {
        content: JSON.stringify(payload),
        event: event(runId, "git_commit_plan", planned.message, `${planned.committed.length} files`, payload),
        harnessPatch: { gitStaging: planned.staging },
      };
    }
    case "run_automation": {
      const id = asString(parsed.automationId || parsed.id);
      const nameArg = asString(parsed.name);
      const automation =
        harness.automations.find((item) => item.id === id || item.name.toLowerCase() === nameArg.toLowerCase()) ??
        matchingAutomations(harness, query || nameArg)[0];
      const payload = automation
        ? {
            id: automation.id,
            name: automation.name,
            trigger: automation.trigger,
            action: automation.action,
            enabled: automation.enabled,
          }
        : { error: "Automation not found", id, name: nameArg };
      return {
        content: JSON.stringify(payload),
        event: event(
          runId,
          "run_automation",
          automation ? `Automation: ${automation.name}` : "Automation not found",
          automation?.action,
          payload,
        ),
      };
    }
    case "personal_read": {
      const kind = asString(parsed.kind) || "harness";
      const payload = readPersonalContent({ kind, harness, runs: ctx.runs, query });
      return {
        content: JSON.stringify(payload),
        event: event(runId, "personal_read", `Personal ${kind}`, undefined, payload),
      };
    }
    default: {
      const payload = { name, args: parsed };
      return {
        content: JSON.stringify({ error: `Unknown tool: ${name}` }),
        event: event(runId, "error", `Unknown tool: ${name}`, undefined, payload),
      };
    }
  }
}

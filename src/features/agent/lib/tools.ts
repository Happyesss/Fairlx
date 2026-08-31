import type {
  AgentContext,
  AgentHarness,
  AgentRunMode,
  AgentToolEvent,
  AgentToolEventType,
  McpConfig,
} from "../types";
import { AGENT_TOOL_CATALOG } from "../constants";
import { toPublicMcpConfig } from "./public-mcp";

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
    payload,
    createdAt: new Date().toISOString(),
    runId,
  };
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
): Promise<{ content: string; event: AgentToolEvent }> {
  const parsed = parseArgs(args);
  const query = asString(parsed.query || parsed.q || parsed.search);
  const { context, harness, mcp, runId } = ctx;

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
      const payload = { workspaces: context.workspaces };
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
      const publicConfig = toPublicMcpConfig(mcp);
      const servers = Object.entries(publicConfig.mcpServers ?? {}).map(([serverName, server]) => ({
        name: serverName,
        transport: server.transport,
        url: server.url,
        command: server.command,
        disabled: Boolean(server.disabled),
      }));
      const payload = { servers };
      return {
        content: JSON.stringify(payload),
        event: event(runId, "mcp_list", `${servers.length} MCP servers`, undefined, payload),
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

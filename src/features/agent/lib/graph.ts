import type {
  AgentContext,
  AgentContextGraph,
  AgentContextGraphNode,
  AgentHarness,
  AgentRun,
  AgentSpecialistId,
  McpConfig,
} from "../types";

export const AGENT_SPECIALISTS: Array<{
  id: AgentSpecialistId;
  name: string;
  role: string;
}> = [
  {
    id: "orchestrator",
    name: "Orchestrator",
    role: "Route work, keep context, and finish with a concise answer.",
  },
  {
    id: "planner",
    name: "Planner",
    role: "Break the request into ordered steps. Do not invent Fairlx data.",
  },
  {
    id: "researcher",
    name: "Researcher",
    role: "Search the harness, Fairlx records, docs, and the web. Cite tool results.",
  },
  {
    id: "builder",
    name: "Builder",
    role: "Create projects, apply skills, and use MCP write tools only when asked.",
  },
  {
    id: "git",
    name: "Git",
    role: "Inspect linked repos and the staging buffer. Never execute git on the host.",
  },
  {
    id: "reviewer",
    name: "Reviewer",
    role: "Check plans against work patterns, automations, and safety rules.",
  },
];

const SPECIALIST_HINTS: Array<{ id: AgentSpecialistId; pattern: RegExp }> = [
  { id: "git", pattern: /\b(git|commit|stage|unstag|branch|pr\b|pull request|repo|repository|diff)\b/i },
  { id: "builder", pattern: /\b(create project|new project|scaffold|implement|ship|build)\b/i },
  { id: "researcher", pattern: /\b(search|find|look up|what is|who is|docs?|investigate)\b/i },
  { id: "planner", pattern: /\b(plan|roadmap|breakdown|steps|how should we)\b/i },
  { id: "reviewer", pattern: /\b(review|audit|risk|check this|is this safe)\b/i },
];

export function resolveSpecialist(prompt: string): AgentSpecialistId {
  for (const hint of SPECIALIST_HINTS) {
    if (hint.pattern.test(prompt)) return hint.id;
  }
  return "orchestrator";
}

export function specialistById(id: string): AgentSpecialistId {
  return AGENT_SPECIALISTS.some((item) => item.id === id) ? (id as AgentSpecialistId) : "orchestrator";
}

export function buildContextGraph(params: {
  harness: AgentHarness;
  context: AgentContext;
  run: AgentRun;
  mcp: McpConfig;
}): AgentContextGraph {
  const { harness, context, run, mcp } = params;
  const workspace =
    context.workspaces.find((item) => item.id === run.workspaceId) ??
    context.workspaces.find((item) => item.id === harness.settings.defaultWorkspaceId) ??
    context.workspaces[0];
  const project =
    context.projects.find((item) => item.id === run.projectId) ??
    context.projects.find((item) => item.id === harness.settings.defaultProjectId);

  const nodes: AgentContextGraphNode[] = [];
  for (const specialist of AGENT_SPECIALISTS) {
    nodes.push({
      id: `specialist:${specialist.id}`,
      kind: "specialist",
      label: specialist.name,
      meta: specialist.role,
    });
  }
  for (const item of context.workspaces.slice(0, 12)) {
    nodes.push({
      id: `workspace:${item.id}`,
      kind: "workspace",
      label: item.name,
      meta: item.id,
    });
  }
  const relatedProjects = workspace
    ? context.projects.filter((item) => item.workspaceId === workspace.id).slice(0, 12)
    : context.projects.slice(0, 8);
  for (const item of relatedProjects) {
    nodes.push({
      id: `project:${item.id}`,
      kind: "project",
      label: item.name,
      parentId: `workspace:${item.workspaceId}`,
      meta: item.key,
    });
  }
  const assigned = context.workItems
    .filter((item) => !project || item.projectId === project.id)
    .slice(0, 10);
  for (const item of assigned) {
    nodes.push({
      id: `item:${item.id}`,
      kind: "work_item",
      label: item.title,
      parentId: item.projectId ? `project:${item.projectId}` : undefined,
      meta: [item.key, item.status].filter(Boolean).join(" · "),
    });
  }
  for (const repo of context.githubRepos.slice(0, 8)) {
    nodes.push({
      id: `repo:${repo.id}`,
      kind: "repo",
      label: repo.owner && repo.repositoryName ? `${repo.owner}/${repo.repositoryName}` : repo.repositoryName || "repo",
      parentId: repo.projectId ? `project:${repo.projectId}` : repo.workspaceId ? `workspace:${repo.workspaceId}` : undefined,
      meta: repo.branch,
    });
  }
  for (const [name, server] of Object.entries(mcp.mcpServers ?? {})) {
    nodes.push({
      id: `mcp:${name}`,
      kind: "mcp",
      label: name,
      meta: server.disabled ? "disabled" : server.transport || "http",
    });
  }

  return {
    nodes,
    specialist: resolveSpecialist(run.prompt || run.title),
    workspaceId: workspace?.id,
    projectId: project?.id,
  };
}

export function formatContextGraph(graph: AgentContextGraph): string {
  const lines = graph.nodes.slice(0, 40).map((node) => {
    const parent = node.parentId ? ` <- ${node.parentId}` : "";
    const meta = node.meta ? ` [${node.meta}]` : "";
    return `- ${node.kind}:${node.label}${meta}${parent}`;
  });
  return [`Active specialist: ${graph.specialist}`, ...lines].join("\n");
}

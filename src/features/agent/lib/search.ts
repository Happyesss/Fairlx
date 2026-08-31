import type {
  AgentContext,
  AgentHarness,
  AgentRun,
  AgentSearchHit,
  AgentSearchKind,
  McpConfig,
} from "../types";

function scoreText(query: string, ...fields: Array<string | undefined>): number {
  const needle = query.trim().toLowerCase();
  if (!needle) return 1;
  let score = 0;
  for (const field of fields) {
    const haystack = (field ?? "").toLowerCase();
    if (!haystack) continue;
    if (haystack === needle) score += 12;
    else if (haystack.startsWith(needle)) score += 8;
    else if (haystack.includes(needle)) score += 5;
    const tokens = needle.split(/\s+/).filter(Boolean);
    for (const token of tokens) {
      if (haystack.includes(token)) score += 1;
    }
  }
  return score;
}

function hit(
  kind: AgentSearchKind,
  id: string,
  title: string,
  href: string,
  meta: string,
  score: number,
): AgentSearchHit {
  return { id, kind, title, href, meta, score };
}

export function searchAgentIndex(params: {
  query: string;
  runs?: AgentRun[];
  context?: AgentContext;
  harness?: AgentHarness;
  mcp?: McpConfig;
  limit?: number;
}): AgentSearchHit[] {
  const { query, runs = [], context, harness, mcp, limit = 40 } = params;
  const hits: AgentSearchHit[] = [];

  for (const run of runs) {
    const score = scoreText(query, run.title, run.prompt);
    if (score > 0) {
      hits.push(
        hit("run", run.id, run.title, `/agent/workflow?runId=${run.id}`, `Chat · ${run.status}`, score + 1),
      );
    }
  }

  for (const workspace of context?.workspaces ?? []) {
    const score = scoreText(query, workspace.name);
    if (score > 0) {
      hits.push(hit("workspace", workspace.id, workspace.name, `/workspaces/${workspace.id}`, "Workspace", score));
    }
  }

  for (const project of context?.projects ?? []) {
    const score = scoreText(query, project.name, project.key, project.description);
    if (score > 0) {
      hits.push(
        hit(
          "project",
          project.id,
          project.name,
          `/workspaces/${project.workspaceId}/projects/${project.id}`,
          project.key ? `Project · ${project.key}` : "Project",
          score,
        ),
      );
    }
  }

  for (const item of context?.workItems ?? []) {
    const score = scoreText(query, item.title, item.key, item.status, item.priority);
    if (score > 0) {
      hits.push(
        hit(
          "work_item",
          item.id,
          item.title,
          item.workspaceId ? `/workspaces/${item.workspaceId}/tasks/${item.id}` : "/agent/projects",
          [item.key, item.status].filter(Boolean).join(" · ") || "Work item",
          score,
        ),
      );
    }
  }

  for (const skill of harness?.skills ?? []) {
    const score = scoreText(query, skill.name, skill.description, skill.instructions);
    if (score > 0) {
      hits.push(hit("skill", skill.id, skill.name, "/agent/skills", "Skill", score));
    }
  }

  for (const item of harness?.knowledge ?? []) {
    const score = scoreText(query, item.title, item.content, item.source);
    if (score > 0) {
      hits.push(hit("knowledge", item.id, item.title, "/agent/knowledge", "Knowledge", score));
    }
  }

  for (const item of harness?.automations ?? []) {
    const score = scoreText(query, item.name, item.description, item.trigger, item.action);
    if (score > 0) {
      hits.push(hit("automation", item.id, item.name, "/agent/automations", "Automation", score));
    }
  }

  for (const pattern of harness?.workPatterns ?? []) {
    const score = scoreText(query, pattern.name, pattern.instructions);
    if (score > 0) {
      hits.push(hit("pattern", pattern.id, pattern.name, "/agent/settings#work-patterns", "Rule", score));
    }
  }

  for (const doc of context?.docs ?? []) {
    const score = scoreText(query, doc.title, doc.name, doc.description, doc.category);
    if (score > 0) {
      hits.push(
        hit("doc", doc.id, doc.title || doc.name || "Doc", "/agent/knowledge", doc.category || "Doc", score),
      );
    }
  }

  for (const repo of context?.githubRepos ?? []) {
    const label =
      repo.owner && repo.repositoryName ? `${repo.owner}/${repo.repositoryName}` : repo.repositoryName || "Repository";
    const score = scoreText(query, label, repo.githubUrl, repo.branch);
    if (score > 0) {
      hits.push(hit("repo", repo.id, label, repo.githubUrl || "/agent/git", repo.branch || "GitHub", score));
    }
  }

  for (const [name, server] of Object.entries(mcp?.mcpServers ?? {})) {
    const score = scoreText(query, name, server.transport, server.url, server.command);
    if (score > 0) {
      hits.push(
        hit("mcp", name, name, "/agent/mcp", server.disabled ? "MCP · disabled" : "MCP", score),
      );
    }
  }

  for (const item of harness?.gitStaging?.items ?? []) {
    const score = scoreText(query, item.path, item.summary, item.branch, item.status);
    if (score > 0) {
      hits.push(hit("staging", item.id, item.path, "/agent/git", `Staging · ${item.status}`, score));
    }
  }

  return hits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, limit);
}

export function rankKnowledge(query: string, harness: AgentHarness, limit = 8) {
  return [...harness.knowledge]
    .map((item) => ({ item, score: scoreText(query, item.title, item.content, item.source) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row) => row.item);
}

export function matchingAutomations(harness: AgentHarness, query: string) {
  const enabled = harness.automations.filter((item) => item.enabled);
  if (!query.trim()) return enabled.slice(0, 6);
  return enabled.filter((item) => scoreText(query, item.name, item.description, item.trigger, item.action) > 0);
}

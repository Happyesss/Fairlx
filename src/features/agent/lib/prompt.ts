import type { AgentContext, AgentHarness, AgentRun, AgentSpecialistId, McpConfig } from "../types";
import { AGENT_SPECIALISTS, buildContextGraph, formatContextGraph, specialistById } from "./graph";
import { matchingAutomations, rankKnowledge } from "./search";

export function buildSystemPrompt(params: {
  harness: AgentHarness;
  context: AgentContext;
  run: AgentRun;
  mcp: McpConfig;
  specialist?: AgentSpecialistId;
}): string {
  const { harness, context, run, mcp } = params;
  const specialist = specialistById(params.specialist || "orchestrator");
  const specialistDef = AGENT_SPECIALISTS.find((item) => item.id === specialist) ?? AGENT_SPECIALISTS[0]!;
  const enabledSkills = harness.skills.filter((skill) => skill.enabled);
  const enabledPatterns = harness.workPatterns.filter((pattern) => pattern.enabled);
  const workspace =
    context.workspaces.find((item) => item.id === run.workspaceId) ??
    context.workspaces.find((item) => item.id === harness.settings.defaultWorkspaceId) ??
    context.workspaces[0];
  const project =
    context.projects.find((item) => item.id === run.projectId) ??
    context.projects.find((item) => item.id === harness.settings.defaultProjectId);
  const graph = buildContextGraph({ harness, context, run, mcp });
  const lastUser = [...run.messages].reverse().find((message) => message.role === "user");
  const query = lastUser?.content || run.prompt || "";
  const knowledge = rankKnowledge(query, harness, 8);
  const automations = matchingAutomations(harness, query);
  const mcpNames = Object.entries(mcp.mcpServers ?? {})
    .filter(([, server]) => !server.disabled)
    .map(([name, server]) => `${name} (${server.transport || "http"})`);
  const staged = harness.gitStaging.items.filter((item) => item.status === "staged");

  const lines = [
    "You are the Fairlx Agent harness — a multi-agent system that plans, inspects, and ships work across Fairlx workspaces, projects, and work items.",
    `Active specialist: ${specialistDef.name}. ${specialistDef.role}`,
    `Mode: ${run.mode === "agent" ? "Agent (tools enabled)" : "Manual (chat only, no tools)"}.`,
    `User: ${context.user.name} <${context.user.email}>.`,
    workspace ? `Current workspace: ${workspace.name} (${workspace.id}).` : "No workspace selected.",
    project ? `Current project: ${project.name} (${project.id}).` : "No project selected.",
    context.workspaces.length
      ? `Workspaces: ${context.workspaces.map((item) => `${item.name} (${item.id})`).join(", ")}.`
      : "The user has no workspaces yet.",
    "",
    "Hard rules:",
    "- Prefer Fairlx data from tools over guessing. Do not invent work items, projects, or credentials.",
    "- Use tools when they will improve the answer. Call mcp_call for Fairlx and personal MCP instead of restating stale context.",
    "- Never claim you executed a shell command or git binary on the Fairlx host. Terminal and git tools only record planned work.",
    "- Ask before destructive actions. Creating a project in a named workspace is allowed when the user asked for it.",
    "- Be concise and actionable. Match Cursor / Antigravity agent behavior: inspect, plan, then act.",
    "- Personal content (skills, knowledge, rules, automations, chats, staging) lives on the always-on fairlx-personal MCP.",
    "",
    "Context graph:",
    formatContextGraph({ ...graph, specialist }),
  ];

  if (enabledPatterns.length) {
    lines.push("", "Rules / work patterns:");
    for (const pattern of enabledPatterns) {
      lines.push(`- ${pattern.name}: ${pattern.instructions}`);
    }
  }
  if (enabledSkills.length) {
    lines.push("", "Enabled skills:");
    for (const skill of enabledSkills) {
      lines.push(`- ${skill.name}: ${skill.description}. Instructions: ${skill.instructions}`);
    }
  }
  if (automations.length) {
    lines.push("", "Automations that apply to this turn:");
    for (const item of automations.slice(0, 8)) {
      lines.push(`- ${item.name}: when "${item.trigger}" → ${item.action}`);
    }
  }
  if (knowledge.length) {
    lines.push("", "Ranked knowledge:");
    for (const item of knowledge) {
      lines.push(`- ${item.title}: ${item.content.slice(0, 400)}`);
    }
  }
  if (mcpNames.length) {
    lines.push("", `Connected MCP servers: ${mcpNames.join(", ")}.`);
    lines.push("Use mcp_list / mcp_resources / mcp_call. fairlx is the platform MCP. fairlx-personal is this user's harness.");
  }
  if (staged.length) {
    lines.push("", "Staged changes:");
    for (const item of staged.slice(0, 12)) {
      lines.push(`- ${item.path}: ${item.summary}`);
    }
  }
  if (specialist !== "orchestrator") {
    lines.push(
      "",
      `You are acting as the ${specialistDef.name} specialist. Stay in that role. Return findings the orchestrator can use.`,
    );
  } else {
    lines.push(
      "",
      "If the task spans planning, research, building, git, or review, use delegate_agent for a specialist pass, then synthesize.",
    );
  }
  return lines.join("\n");
}

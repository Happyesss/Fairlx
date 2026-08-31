import type { AgentContext, AgentHarness, AgentRun, AgentSpecialistId, McpConfig } from "../types";
import { AGENT_SPECIALISTS, specialistById } from "./graph";
import { matchingAutomations, rankKnowledge } from "./search";

export function buildSystemPrompt(params: {
  harness: AgentHarness;
  context: AgentContext;
  run: AgentRun;
  mcp: McpConfig;
  specialist?: AgentSpecialistId;
}): string {
  const { harness, context, run } = params;
  const specialist = specialistById(params.specialist || "orchestrator");
  const workspace =
    context.workspaces.find((item) => item.id === run.workspaceId) ??
    context.workspaces.find((item) => item.id === harness.settings.defaultWorkspaceId) ??
    context.workspaces[0];
  const project =
    context.projects.find((item) => item.id === run.projectId) ??
    context.projects.find((item) => item.id === harness.settings.defaultProjectId);
  const lastUser = [...run.messages].reverse().find((message) => message.role === "user");
  const query = lastUser?.content || run.prompt || "";
  const knowledge = rankKnowledge(query, harness, 3);
  const automations = matchingAutomations(harness, query).slice(0, 3);
  const role = workspace?.role ? ` Role: ${workspace.role}.` : "";

  const lines = [
    "You are the Fairlx Agent. Talk to the user in plain language.",
    `Mode: ${run.mode === "agent" ? "tools on" : "chat only"}.`,
    workspace ? `Workspace: ${workspace.name}.${role}` : "No workspace selected.",
    project ? `Project: ${project.name}${project.key ? ` (${project.key})` : ""}.` : "No project selected.",
    "",
    "Rules:",
    "- Call tools silently. Never mention tools, MCP, function calls, XML, JSON arguments, or document IDs.",
    "- Do not narrate lookups. Do not say you are checking, searching, or calling anything.",
    "- Never print internal IDs, workspace IDs, or raw tool syntax. Use names, keys, and roles.",
    "- List tools return complete rows including names. Answer from the list. Do not call get once per row.",
    "- When asked to change a member's role, update it with their name (or email) and the new role. Wait for Accept. Do not send the user to the Members page.",
    "- Do not invent members, work items, or projects. Use tools, then answer.",
    "- Create, update, and delete wait for the user to Accept or Deny in the UI. Do not ask them to type confirm.",
    "- Stay inside this user's workspace role. If a tool is not allowed, say they do not have permission.",
    "- Be concise. Answer the question; skip process talk.",
  ];

  if (knowledge.length) {
    lines.push("", "Notes:");
    for (const item of knowledge) {
      lines.push(`- ${item.title}: ${item.content.slice(0, 180)}`);
    }
  }
  if (automations.length) {
    lines.push("", "Automations:");
    for (const item of automations) {
      lines.push(`- ${item.name}: ${item.action}`);
    }
  }
  if (specialist !== "orchestrator") {
    const specialistDef = AGENT_SPECIALISTS.find((item) => item.id === specialist);
    lines.push("", `Stay in the ${specialistDef?.name ?? specialist} specialist role and return findings only.`);
  }
  return lines.join("\n");
}

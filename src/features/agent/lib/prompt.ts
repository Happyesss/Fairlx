import type { AgentContext, AgentHarness, AgentRun, AgentSpecialistId, McpConfig } from "../types";
import { AGENT_SPECIALISTS, resolveSpecialist, specialistById } from "./graph";
import { matchingAutomations, rankKnowledge } from "./search";

export function buildSystemPrompt(params: {
  harness: AgentHarness;
  context: AgentContext;
  run: AgentRun;
  mcp: McpConfig;
  specialist?: AgentSpecialistId;
}): string {
  const { harness, context, run } = params;
  const lastUser = [...run.messages].reverse().find((message) => message.role === "user");
  const query = lastUser?.content || run.prompt || "";
  const specialist = specialistById(params.specialist || resolveSpecialist(query));
  const workspace =
    context.workspaces.find((item) => item.id === run.workspaceId) ??
    context.workspaces.find((item) => item.id === harness.settings.defaultWorkspaceId) ??
    context.workspaces[0];
  const project =
    context.projects.find((item) => item.id === run.projectId) ??
    context.projects.find((item) => item.id === harness.settings.defaultProjectId);
  const knowledge = rankKnowledge(query, harness, 3);
  const automations = matchingAutomations(harness, query).slice(0, 3);
  const role = workspace?.role ? ` Role: ${workspace.role}.` : "";

  const lines = [
    "You are the Fairlx Agent. Talk to the user in plain language.",
    `Mode: ${run.mode === "agent" ? "tools on" : "chat only"}.`,
    workspace
      ? `Workspace: ${workspace.name}.${role} workspaceId: ${workspace.id}`
      : "No workspace selected.",
    project
      ? `Project: ${project.name}${project.key ? ` (${project.key})` : ""}. projectId: ${project.id}`
      : "No project selected.",
  ];
  if (query) lines.push(`Task: ${query.slice(0, 400)}`);
  lines.push(
    "",
    "Rules:",
    "- Do the Task. A plan, proposal, or answer is the deliverable — not a roster of members, sprints, or project settings.",
    "- Call native fairlx_* tools directly. Do not wrap Fairlx platform tools in mcp_call. mcp_call is only for external MCP servers.",
    "- Put workspaceId and projectId in tool arguments. Never print those IDs in the user-facing answer.",
    "- Call tools without explaining them. The UI shows progress. Never mention MCP, function calls, XML, JSON arguments, or document IDs in the user-facing answer.",
    "- Never print internal IDs, workspace IDs, or raw tool syntax. Use names, keys, and roles.",
    "- Never repeat the same tool with the same arguments. If a tool already returned data, answer from it.",
    "- List tools return complete rows including names. Answer from the list. Do not call get once per row.",
    "- When asked to plan a feature, glance at open work only to avoid duplicates, then propose one concrete feature: name, why, user stories, work items to create, acceptance criteria, and sprint fit. Do not recap the team.",
    "- You may propose new work items and stories. Creating them in Fairlx waits for Accept. Do not invent existing members or claim records already exist.",
    "- Never invent or hallucinate existing work items, bug counts, sprint numbers, or metrics. Base all observations strictly on real data returned by tools; if lookups return no items or fail, state that truthfully.",
    "- When asked to change a member's role, update it with their name (or email) and the new role. Wait for Accept. Do not send the user to the Members page.",
    "- Create, update, and delete wait for the user to Accept or Deny in the UI. Do not ask them to type confirm.",
    "- Stay inside this user's workspace role. If a tool is not allowed, say they do not have permission.",
    "- Be concise. Answer the question; skip process talk.",
  );

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
    lines.push("", `Stay in the ${specialistDef?.name ?? specialist} role: ${specialistDef?.role ?? ""}`.trim());
  }
  return lines.join("\n");
}

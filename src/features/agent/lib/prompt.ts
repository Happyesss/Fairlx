import type { AgentContext, AgentHarness, AgentRun, AgentSpecialistId, McpConfig, PersonalTrainingAnswer } from "../types";
import { compilePersonaPrompt, inferPersonaRole } from "@fairlx/multi-agent";
import { AGENT_DEFINITIONS } from "./brain";
import { AGENT_SPECIALISTS, resolveSpecialist, specialistById } from "./graph";
import { matchingAutomations, rankKnowledge } from "./search";
import { isPersonalSessionMode, SESSION_MODE_INSTRUCTIONS } from "./session-context";
import { firstName } from "./agent-ui";
import {
  buildTrainingInterviewPrompt,
  formatTrainingSnapshot,
  isTrainingRun,
  suggestedPersonaRole,
} from "./personal-training";

export function buildSystemPrompt(params: {
  harness: AgentHarness;
  context: AgentContext;
  run: AgentRun;
  mcp: McpConfig;
  specialist?: AgentSpecialistId;
  personalPrompt?: string;
  personalAnswers?: PersonalTrainingAnswer[];
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
  const personaRole = inferPersonaRole({ workspaceRole: workspace?.role, prompt: query, title: run.title });
  const persona = compilePersonaPrompt(personaRole, workspace?.name, project?.name);
  const sessionMode = harness.settings.sessionMode;
  const personal = isPersonalSessionMode(sessionMode);
  const training = isTrainingRun(run);

  if (training) {
    const trainingRole = suggestedPersonaRole(context, run.workspaceId || harness.settings.defaultWorkspaceId);
    return buildTrainingInterviewPrompt({
      userName: firstName(context.user.name, context.user.email),
      personaRole: trainingRole,
      workspaceRole: workspace?.role,
      workspaceName: workspace?.name,
      projectName: project?.name,
      retraining: Boolean(params.personalPrompt?.trim()),
      snapshot: formatTrainingSnapshot(
        context,
        run.workspaceId || harness.settings.defaultWorkspaceId || workspace?.id,
        run.projectId || harness.settings.defaultProjectId || project?.id,
      ),
      covered: params.personalAnswers,
    });
  }

  const lines = [
    personal
      ? "You are the Fairlx Personal Agent, the user's Chief of Staff. Talk to the user in plain language."
      : "You are the Fairlx Agent. Talk to the user in plain language.",
    persona,
    `Mode: ${run.mode === "agent" ? "tools on" : "chat only"}.`,
    workspace
      ? `Workspace: ${workspace.name}.${role} workspaceId: ${workspace.id}`
      : "No workspace selected.",
    project
      ? `Project: ${project.name}${project.key ? ` (${project.key})` : ""}. projectId: ${project.id}${
          project.customLabels?.length
            ? ` Labels: ${project.customLabels.map((l) => l.name).join(", ")}.`
            : ""
        }`
      : "No project selected.",
  ];
  if (personal) lines.push(SESSION_MODE_INSTRUCTIONS.personal);
  if (personal && params.personalPrompt?.trim()) {
    lines.push(
      "",
      "Trained Personal Agent operating system (user-authored; follow over generic defaults):",
      params.personalPrompt.trim(),
    );
  }
  if (query) lines.push(`Task: ${query.slice(0, 400)}`);
  const connected = (harness.plugins ?? []).filter((plugin) => plugin.status === "connected");
  if (connected.length) {
    lines.push(`Plugins: ${connected.map((plugin) => plugin.displayName).join(", ")}.`);
  } else {
    lines.push("Plugins: Fairlx platform only. Mail, GitHub write, and extra MCP need connecting.");
  }
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
    "- Workspace and project are already selected. Do not list workspaces or projects to discover them.",
    "- Unassigned means no current project member on the item — the same as the board Unassigned label. Call fairlx_work_item_list once with unassigned=true. Do not filter by type unless the user asked for bugs or stories only.",
    "- Answer work-item lists as a markdown table of key, title, status, priority, and assignees. Never print document IDs.",
    "- One fairlx_work_item_list per project unless the user asked for a specific slice. Do not fan out by status or type. Paginate only when hasMore is true, and pass nextCursor unchanged. Never invent cursorAfter. After the list is in context, answer.",
    "- When asked to plan a feature, glance at open work only to avoid duplicates, then propose one concrete feature: name, why, user stories, work items to create, acceptance criteria, and sprint fit. Do not recap the team.",
    "- When creating or proposing work items (fairlx_work_item_create), always specify: type (TASK, STORY, BUG, or EPIC), priority (LOW, MEDIUM, HIGH, or URGENT), a descriptive title, clear description, and relevant labels/tags.",
    "- When creating a new project's first sprint with fairlx_sprint_create, that sprint starts automatically. Do not ask the user to start it, and do not call fairlx_sprint_start.",
    "- You may propose new work items and stories. Creating them in Fairlx waits for Accept. Do not invent existing members or claim records already exist.",
    "- Never invent or hallucinate existing work items, bug counts, sprint numbers, or metrics. Base all observations strictly on real data returned by tools; if lookups return no items or fail, state that truthfully.",
    "- When asked to change a member's role, update it with their name (or email) and the new role. Wait for Accept. Do not send the user to the Members page.",
    "- When asked to add someone to this workspace, call fairlx_workspace_member_add with their email (and name if you have it). Wait for Accept. If they are not in the organization yet, the owner can still invite them — that adds them to the organization and the workspace. Use role ADMIN for a lead developer. Do not send the user to Settings.",
    "- When asked to create a project team, call fairlx_project_team_create with the projectId and name. Wait for Accept. Do not send the user to Settings → Teams.",
    "- When asked to add someone to a project team, call fairlx_project_team_member_add with their name or email and the team name (or teamId). They must already be in the workspace — invite them with fairlx_workspace_member_add first if needed. Wait for Accept. Do not send the user to Settings.",
    "- When asked to remove someone, call fairlx_workspace_member_remove with their name or email. Wait for Accept.",
    "- When asked for an invite, join, or share link, call fairlx_workspace_invite_get. If invite links are disabled, add the person with fairlx_workspace_member_add instead of sending the user to Settings.",
    "- Create, update, and delete wait for the user to Accept or Deny in the UI. Do not ask them to type confirm.",
    "- When asked to send mail about a work item, load the item, draft the mail, then call mail_send with workItemKey. After Accept, a comment is added on the item. If mail is not configured, call request_capability with email.send instead of guessing.",
    "- Edit code through github_read_file, github_write_file, and github_open_pr on linked repos. Pass files[] on github_open_pr for multi-file PRs. Never claim you ran git on the Fairlx host.",
    "- Security review uses security_review. Cite file paths. Never exploit production or staging unless the user confirmed a staging URL. Findings become Fairlx bugs and a channel digest.",
    "- Delegate long or specialized work to ops, security, builder, git, workflow, or reviewer. Reviewer never grades its own output.",
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
  if (specialist !== "orchestrator" && !personal) {
    const specialistDef = AGENT_SPECIALISTS.find((item) => item.id === specialist);
    const definition = AGENT_DEFINITIONS[specialist];
    lines.push(
      "",
      `Stay in the ${specialistDef?.name ?? specialist} role: ${definition?.identity ?? specialistDef?.role ?? ""}`.trim(),
    );
    if (definition?.done) lines.push(`Done when: ${definition.done}`);
  }
  return lines.join("\n");
}

import type { PersonaRole, SubAgentType, WorkspaceRole } from "./types";

export const HARNESS_TOOLS = [
  "code_inspect",
  "git_status",
  "git_stage",
  "git_unstage",
  "git_commit_plan",
  "search_harness",
  "write_guard",
  "spawn_sub_agent",
  "testmu_run_test",
  "browser_click",
  "browser_shot",
  "playwright_run",
] as const;

export const MCP_TOOL_PREFIXES = {
  docs: "fairlx_doc_",
  items: "fairlx_work_item_",
  itemsAlias: "fairlx_item_",
} as const;

const DELETE_RE = /delete|purge|destroy|drop_workspace|push_main|merge_production/i;

/**
 * Spec §6 — strict least-privilege tool scoping per sub-agent.
 * Planner: docs + items + search. Builder: inspect + git stage + items, no deletes.
 * QA: browser/TestMu only, no code writes. Reviewer: git status + items + write_guard.
 */
export const ROLE_TOOLS: Record<SubAgentType | "orchestrator", readonly string[]> = {
  orchestrator: [
    "spawn_sub_agent",
    "search_harness",
    "fairlx_doc_list",
    "fairlx_doc_get",
    "fairlx_work_item_list",
    "fairlx_work_item_get",
    "git_status",
    "write_guard",
  ],
  planner: [
    "fairlx_doc_list",
    "fairlx_doc_get",
    "fairlx_work_item_list",
    "fairlx_work_item_get",
    "fairlx_work_item_create",
    "search_harness",
  ],
  builder: [
    "code_inspect",
    "git_status",
    "git_stage",
    "git_commit_plan",
    "fairlx_work_item_list",
    "fairlx_work_item_get",
    "fairlx_work_item_update",
  ],
  qa: ["testmu_run_test", "browser_click", "browser_shot", "playwright_run"],
  reviewer: ["git_status", "fairlx_work_item_list", "fairlx_work_item_get", "write_guard"],
};

const WRITE_TOOLS = new Set([
  "git_stage",
  "git_commit_plan",
  "fairlx_work_item_create",
  "fairlx_work_item_update",
  "spawn_sub_agent",
]);

export function toolsForRole(role: SubAgentType | "orchestrator"): string[] {
  return [...ROLE_TOOLS[role]];
}

export function isToolAllowed(role: SubAgentType | "orchestrator", tool: string): boolean {
  const allowed = ROLE_TOOLS[role];
  if (allowed.includes(tool)) return true;
  if (role === "planner" && (tool.startsWith("fairlx_doc_") || tool.startsWith("fairlx_work_item_") || tool.startsWith("fairlx_item_"))) {
    return !DELETE_RE.test(tool);
  }
  if (role === "builder" && (tool.startsWith("fairlx_work_item_") || tool.startsWith("fairlx_item_"))) {
    return !DELETE_RE.test(tool);
  }
  if (role === "reviewer" && (tool.startsWith("fairlx_work_item_") || tool.startsWith("fairlx_item_"))) {
    return !DELETE_RE.test(tool);
  }
  return false;
}

export function isWriteTool(tool: string): boolean {
  if (WRITE_TOOLS.has(tool)) return true;
  return /_(create|update|add|set|start|complete|split|sync|remove|mark_read)$/i.test(tool);
}

export function isDeleteTool(tool: string): boolean {
  return DELETE_RE.test(tool);
}

export function isHighRiskTool(tool: string, args?: Record<string, unknown>): boolean {
  if (isDeleteTool(tool)) return true;
  if (/billing|wallet|production/i.test(tool)) return true;
  const branch = String(args?.branch ?? args?.base ?? "");
  if (/^(main|master|production)$/i.test(branch) && /merge|push|pr/i.test(tool)) return true;
  return false;
}

export type PersonaProfile = {
  id: PersonaRole;
  name: string;
  focus: string;
  briefingBias: string[];
};

export const PERSONAS: Record<PersonaRole, PersonaProfile> = {
  tech_lead: {
    id: "tech_lead",
    name: "Tech Lead",
    focus: "Team capacity, blockers, unassigned work, and review load.",
    briefingBias: ["blockers", "unassigned", "review-load", "sprint-risk"],
  },
  frontend: {
    id: "frontend",
    name: "Frontend Engineer",
    focus: "Assigned UI bugs, design docs, and the next shippable slice.",
    briefingBias: ["assigned", "ui-bugs", "docs"],
  },
  qa: {
    id: "qa",
    name: "QA Engineer",
    focus: "Items ready for test, regressions, and visual proof.",
    briefingBias: ["ready-for-qa", "regressions", "failed-runs"],
  },
  pm: {
    id: "pm",
    name: "Product Manager",
    focus: "Sprint goal, scope risk, and stakeholder-facing status.",
    briefingBias: ["sprint-goal", "scope-risk", "deadlines"],
  },
};

export function inferPersonaRole(input: {
  workspaceRole?: string;
  title?: string;
  prompt?: string;
  personaRole?: PersonaRole;
}): PersonaRole {
  if (input.personaRole) return input.personaRole;
  const blob = `${input.title || ""} ${input.prompt || ""} ${input.workspaceRole || ""}`.toLowerCase();
  if (/\b(qa|tester|quality|regression)\b/.test(blob)) return "qa";
  if (/\b(pm|product manager|\bprd\b|roadmap|stakeholder)\b/.test(blob)) return "pm";
  if (/\b(frontend|front-end|ui|css|sidebar|layout)\b/.test(blob)) return "frontend";
  if (/\b(tech lead|engineering lead|architect)\b/.test(blob)) return "tech_lead";
  const role = String(input.workspaceRole || "").toUpperCase();
  if (role === "OWNER" || role === "ADMIN") return "tech_lead";
  return "frontend";
}

export function normalizeWorkspaceRole(role?: string | null): WorkspaceRole {
  const key = String(role || "").toUpperCase();
  if (key === "OWNER" || key === "PROJECT_OWNER") return "OWNER";
  if (key === "ADMIN" || key === "WS_ADMIN" || key === "PROJECT_ADMIN") return "ADMIN";
  if (key === "VIEWER" || key === "WS_VIEWER") return "VIEWER";
  return "MEMBER";
}

export function compilePersonaPrompt(role: PersonaRole, workspaceName?: string, projectName?: string): string {
  const persona = PERSONAS[role];
  const scope = [workspaceName, projectName].filter(Boolean).join(" / ");
  return [
    `You are the Fairlx Personal Agent acting as Chief of Staff for a ${persona.name}.`,
    `Focus: ${persona.focus}`,
    scope ? `Scope: ${scope}.` : "",
    "Adapt morning briefings and task decomposition to this role.",
    "Never invent work items, members, or metrics. Ground every claim in tool results or injected @ context.",
    "Call native fairlx_* tools directly. Do not wrap Fairlx platform tools in mcp_call.",
    "Stay inside this user's workspace role. Admin/Owner actions are forbidden for Members.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function specialistSystemPrompt(kind: SubAgentType): string {
  switch (kind) {
    case "planner":
      return "You are the Planner sub-agent. Write user stories, acceptance criteria, and a shippable ordered plan. You may propose work items. You cannot delete records or write code.";
    case "builder":
      return "You are the Builder/Coder sub-agent. Inspect context, stage code changes, and open a GitHub PR. You cannot delete files, workspaces, or push to main.";
    case "qa":
      return "You are the QA/Tester sub-agent. Run TestMu/Playwright against the live URL, capture video proof and visual diffs. You cannot write code or mutate git.";
    case "reviewer":
      return "You are the Reviewer sub-agent. Verify the builder diff and QA proof. Auto-apply safe work. Require a 1-click challenge for deletions or production merges. Reject failing QA.";
  }
}

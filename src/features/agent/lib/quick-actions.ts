import {
  Lightbulb,
  FolderPlus,
  Bug,
  Code,
  FlaskConical,
  FileText,
  type LucideIcon,
} from "lucide-react";

export type AgentQuickAction = {
  icon: LucideIcon;
  label: string;
  prompt: string;
};

export const PLAN_FEATURE_ACTION: AgentQuickAction = {
  icon: Lightbulb,
  label: "Plan new feature",
  prompt:
    "Propose one new feature for this Fairlx project. Glance at open work items only to avoid duplicates, then return: feature name, why it matters, user stories, work items to create (type, title, acceptance criteria), and sprint fit. Do not list members or recap project settings.",
};

export const CREATE_PROJECT_ACTION: AgentQuickAction = {
  icon: FolderPlus,
  label: "Create project",
  prompt:
    "Help me create a new project in this workspace. Propose a project name, description, key milestones, and initial work items to get started. After I confirm, create the project and first sprint — the sprint starts automatically.",
};

export const COMMON_QUICK_ACTIONS: readonly AgentQuickAction[] = [
  {
    icon: Bug,
    label: "Fix a bug",
    prompt: "Help me investigate and fix a bug in the current Fairlx project.",
  },
  {
    icon: Code,
    label: "Refactor code",
    prompt: "Propose a focused refactor for the current Fairlx project.",
  },
  {
    icon: FlaskConical,
    label: "Write tests",
    prompt: "Write tests for the current Fairlx work.",
  },
  {
    icon: FileText,
    label: "Add docs",
    prompt: "Draft documentation for the current Fairlx work.",
  },
] as const;

export function countWorkspaceProjects(
  projects: Array<{ workspaceId?: string }> | undefined | null,
  workspaceId: string | undefined | null
): number {
  if (!projects || projects.length === 0) return 0;
  if (!workspaceId) return projects.length;
  return projects.filter((project) => project.workspaceId === workspaceId).length;
}

export function getQuickActions(hasProjects: boolean): AgentQuickAction[] {
  return [
    hasProjects ? PLAN_FEATURE_ACTION : CREATE_PROJECT_ACTION,
    ...COMMON_QUICK_ACTIONS,
  ];
}

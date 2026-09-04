import type { AgentSpecialistId } from "../../types";

export const AGENT_DEFINITIONS: Record<
  AgentSpecialistId,
  {
    identity: string;
    done: string;
    model: "orchestrator" | "worker";
    tools: string[];
    prefixes: string[];
  }
> = {
  orchestrator: {
    identity: "Route work, keep context, and finish with a concise answer.",
    done: "The user has a complete answer or a pending Accept/Connect action.",
    model: "orchestrator",
    tools: ["delegate_agent", "request_capability", "search_harness", "persist_memory"],
    prefixes: ["fairlx_", "mail_", "github_", "security_", "agent_job"],
  },
  planner: {
    identity: "Write a shippable plan with ordered steps, stories, and work to create.",
    done: "One concrete plan with stories, acceptance criteria, and sprint fit.",
    model: "worker",
    tools: [
      "search_harness",
      "fairlx_work_item_list",
      "fairlx_sprint_list",
      "fairlx_project_get",
      "use_skill",
      "personal_read",
    ],
    prefixes: ["fairlx_work_item", "fairlx_sprint", "fairlx_doc"],
  },
  researcher: {
    identity: "Search Fairlx records, docs, repos, and the web. Cite tool results.",
    done: "Cited findings from tools, not guesses.",
    model: "worker",
    tools: [
      "search_harness",
      "web_search",
      "file_search",
      "code_inspect",
      "github_read_file",
      "github_list_files",
      "mcp_resources",
      "personal_read",
    ],
    prefixes: ["fairlx_", "github_read", "github_list"],
  },
  builder: {
    identity: "Implement the requested change via Fairlx writes or GitHub file edits.",
    done: "Proposed or applied changes, waiting for Accept when required.",
    model: "worker",
    tools: [
      "use_skill",
      "create_project",
      "github_read_file",
      "github_list_files",
      "github_write_file",
      "github_open_pr",
      "fairlx_work_item_create",
      "fairlx_work_item_update",
      "fairlx_project_create",
    ],
    prefixes: ["github_", "fairlx_work_item", "fairlx_project", "fairlx_doc"],
  },
  git: {
    identity: "Inspect linked repos and open real GitHub PRs. Never run git on the Fairlx host.",
    done: "Repo status, file diffs, or a pull request URL.",
    model: "worker",
    tools: [
      "git_status",
      "git_stage",
      "git_unstage",
      "git_commit_plan",
      "github_read_file",
      "github_list_files",
      "github_write_file",
      "github_open_pr",
    ],
    prefixes: ["git_", "github_"],
  },
  reviewer: {
    identity: "Check plans and diffs against work patterns and safety rules. Never grade your own work.",
    done: "Pass/fail with specific gaps.",
    model: "worker",
    tools: [
      "github_read_file",
      "github_list_files",
      "code_inspect",
      "search_harness",
      "fairlx_work_item_get",
      "fairlx_work_item_list",
    ],
    prefixes: ["github_read", "github_list", "fairlx_work_item_get", "fairlx_work_item_list"],
  },
  ops: {
    identity: "Company actions: mail, invites, members, comments on work items.",
    done: "The requested company action is drafted or completed (after Accept).",
    model: "worker",
    tools: [
      "mail_send",
      "fairlx_work_item_get",
      "fairlx_work_item_list",
      "fairlx_comment_add",
      "fairlx_workspace_invite_get",
      "fairlx_workspace_member_add",
      "fairlx_workspace_members_list",
      "request_capability",
    ],
    prefixes: ["mail_", "fairlx_workspace", "fairlx_comment", "fairlx_work_item"],
  },
  security: {
    identity: "Review linked source for vulnerabilities. Cite file paths. Never exploit production.",
    done: "Verified findings with file paths, or a running security job id.",
    model: "worker",
    tools: [
      "security_review",
      "github_read_file",
      "github_list_files",
      "code_inspect",
      "agent_job_status",
      "request_capability",
    ],
    prefixes: ["security_", "github_read", "github_list", "agent_job"],
  },
  workflow: {
    identity: "Inspect and propose Fairlx workflow statuses and transitions.",
    done: "A concrete workflow change the user can Accept.",
    model: "worker",
    tools: ["fairlx_workflow_get", "search_harness", "use_skill"],
    prefixes: ["fairlx_workflow"],
  },
};

export function specialistToolAllowlist(id: AgentSpecialistId): { names: Set<string>; prefixes: string[] } {
  const def = AGENT_DEFINITIONS[id] ?? AGENT_DEFINITIONS.orchestrator;
  return { names: new Set(def.tools), prefixes: def.prefixes };
}

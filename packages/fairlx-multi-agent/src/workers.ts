import { defaultBranchName, type GitHubConnector, type QaConnector, usageFromCounts } from "./connectors";
import { estimateTokens } from "./ids";
import { specialistSystemPrompt } from "./roles";
import { VerificationGateway } from "./safety";
import type {
  Artifact,
  HierarchicalAgentRun,
  InjectedContext,
  SubAgentReport,
  SubAgentType,
  WorkspaceRole,
} from "./types";

export type WorkerInput = {
  run: HierarchicalAgentRun;
  kind: SubAgentType;
  prompt: string;
  context?: InjectedContext;
  dependencyReports: SubAgentReport[];
  workspaceRole?: WorkspaceRole;
};

export type WorkerDeps = {
  github: GitHubConnector;
  qa: QaConnector;
  gateway: VerificationGateway;
  workerModel: string;
};

function usageFor(modelId: string, prompt: string, summary: string) {
  return usageFromCounts(modelId, estimateTokens(prompt), estimateTokens(summary));
}

function findArtifact(reports: SubAgentReport[], kind: Artifact["kind"]): Artifact | undefined {
  for (const report of reports) {
    const hit = report.artifacts.find((artifact) => artifact.kind === kind);
    if (hit) return hit;
  }
  return undefined;
}

export async function runPlanner(input: WorkerInput, deps: WorkerDeps): Promise<SubAgentReport> {
  const stories = [
    {
      name: "User-facing fix",
      asA: "user",
      want: input.prompt,
      soThat: "the product behaves as specified",
    },
  ];
  const acceptance = [
    "Given the current UI, when the user reproduces the issue, then the overflow/regression is gone.",
    "QA captures video proof on at least one browser.",
    "A Fairlx work item is updated to Verified & Done after review.",
  ];
  const summary = `Planned 1 story and ${acceptance.length} acceptance criteria.`;
  return {
    runId: input.run.id,
    subAgentType: "planner",
    status: "completed",
    summary,
    artifacts: [
      {
        kind: "plan",
        title: "Implementation plan",
        body: [specialistSystemPrompt("planner"), "", JSON.stringify({ stories, acceptance }, null, 2)].join("\n"),
        data: { stories, acceptance },
      },
    ],
    usage: usageFor(deps.workerModel, input.prompt, summary),
  };
}

export async function runBuilder(input: WorkerInput, deps: WorkerDeps): Promise<SubAgentReport> {
  const plan = findArtifact(input.dependencyReports, "plan");
  const repo = input.context?.repos[0];
  const owner = repo?.owner || "fairlx";
  const name = repo?.name || "app";
  const branch = defaultBranchName(input.prompt);
  const files = [
    {
      path: "fairlx/autonomous-fix.md",
      content: [
        `# ${input.run.title}`,
        "",
        input.prompt,
        "",
        plan?.body ?? "",
        "",
        "Staged by the Fairlx Builder sub-agent. Does not execute git on the Fairlx host.",
      ].join("\n"),
    },
  ];
  const git = await deps.github.stageAndOpenPr({
    owner,
    repo: name,
    branch,
    title: input.run.title,
    body: `Autonomous builder run ${input.run.id}`,
    files,
    workItemKey: input.context?.workItems[0]?.key,
  });
  const summary = git.url ? `Opened ${git.url}` : `Staged ${git.staged} file(s) on ${git.branch}`;
  return {
    runId: input.run.id,
    subAgentType: "builder",
    status: "completed",
    summary,
    artifacts: [
      {
        kind: "pr",
        title: git.branch,
        body: summary,
        data: git,
      },
      {
        kind: "diff",
        title: files[0]!.path,
        body: files[0]!.content,
      },
    ],
    git,
    usage: usageFor(deps.workerModel, input.prompt, summary),
  };
}

function inferUrl(prompt: string, context?: InjectedContext): string | undefined {
  const match = prompt.match(/https?:\/\/\S+/);
  if (match) return match[0];
  return context?.repos[0]?.url;
}

export async function runQa(input: WorkerInput, deps: WorkerDeps): Promise<SubAgentReport> {
  const url = inferUrl(input.prompt, input.context);
  const qaReport = await deps.qa.run({ url, intent: input.prompt, browsers: ["chrome"] });
  const summary = qaReport.skipped
    ? `QA skipped: ${qaReport.reason || "connector unavailable"}`
    : qaReport.passed
      ? `QA passed${qaReport.videoUrl ? ` — ${qaReport.videoUrl}` : ""}`
      : "QA failed";
  return {
    runId: input.run.id,
    subAgentType: "qa",
    status: qaReport.passed || qaReport.skipped ? "completed" : "failed",
    summary,
    artifacts: [{ kind: "qa", title: "QA report", body: summary, data: qaReport }],
    qaReport,
    usage: usageFor(deps.workerModel, input.prompt, summary),
  };
}

export async function runReviewer(input: WorkerInput, deps: WorkerDeps): Promise<SubAgentReport> {
  const git = input.dependencyReports.find((report) => report.git)?.git;
  const qa = input.dependencyReports.find((report) => report.qaReport)?.qaReport;
  const action = git?.url ? `merge ${git.branch}` : "update work item";
  const decision = await deps.gateway.evaluate({
    action,
    tool: git?.branch?.includes("main") ? "git_push_main" : "fairlx_work_item_update",
    args: { branch: git?.branch, prUrl: git?.url },
    actorUserId: input.run.userId,
    workspaceRole: input.workspaceRole,
    qaPassed: qa?.passed,
    qaSkipped: qa?.skipped,
  });
  const summary =
    decision.verdict === "auto_apply"
      ? `Verified. ${decision.reason}`
      : decision.verdict === "reject"
        ? `Rejected. ${decision.reason}`
        : `Needs confirmation. ${decision.reason}`;
  return {
    runId: input.run.id,
    subAgentType: "reviewer",
    status: decision.verdict === "reject" ? "failed" : "completed",
    summary,
    artifacts: [
      {
        kind: "review",
        title: decision.verdict,
        body: summary,
        data: { decision, git, qa },
      },
    ],
    usage: usageFor(deps.workerModel, input.prompt, summary),
  };
}

export async function executeWorker(input: WorkerInput, deps: WorkerDeps): Promise<SubAgentReport> {
  switch (input.kind) {
    case "planner":
      return runPlanner(input, deps);
    case "builder":
      return runBuilder(input, deps);
    case "qa":
      return runQa(input, deps);
    case "reviewer":
      return runReviewer(input, deps);
  }
}

import type { Databases } from "node-appwrite";
import type { AuthContext } from "@fairlx/mcp-server";

import type { AgentContext, AgentHarness, AgentJob, AgentPluginConnection, McpConfig } from "../types";
import { githubCommitFilesAndOpenPr, resolveGithubRepo } from "../plugins/github";
import { parsePrFiles } from "../plugins/github-helpers";
import { scanSourceFiles, verifyFindings } from "../plugins/security";
import { publishSecurityFindings } from "./fairlx-side-effects";
import { getAgentJob, updateAgentJob } from "./jobs";

export type AgentJobRunParams = {
  databases: Databases;
  userId: string;
  jobId: string;
  context: AgentContext;
  plugins: AgentPluginConnection[];
  mcp?: McpConfig;
  mcpAuth?: AuthContext;
  harness?: AgentHarness;
  projectId?: string;
  workspaceId?: string;
};

async function runSecurityReviewJob(params: AgentJobRunParams & { job: AgentJob }): Promise<AgentJob | null> {
  const { databases, job, context, plugins } = params;
  await updateAgentJob(databases, job.id, {
    status: "running",
    progress: { step: "Loading repository", percent: 10 },
  });
  const resolved = await resolveGithubRepo({
    databases,
    context,
    plugins,
    repoId: typeof job.payload.repoId === "string" ? job.payload.repoId : undefined,
    projectId: typeof job.payload.projectId === "string" ? job.payload.projectId : params.projectId,
  });
  if ("error" in resolved) {
    return updateAgentJob(databases, job.id, { status: "failed", error: resolved.error });
  }
  await updateAgentJob(databases, job.id, { progress: { step: "Reading source", percent: 40 } });
  const files = await resolved.api.getAllFiles(resolved.owner, resolved.repo, resolved.branch, "", 40);
  await updateAgentJob(databases, job.id, { progress: { step: "Scanning", percent: 70 } });
  const verified = verifyFindings(scanSourceFiles(files));
  let published = { bugs: [] as Array<{ title: string }>, notified: false };
  if (params.mcp && params.harness) {
    published = await publishSecurityFindings({
      databases,
      mcp: params.mcp,
      harness: params.harness,
      userId: params.userId,
      mcpAuth: params.mcpAuth,
      projectId: params.projectId || (typeof job.payload.projectId === "string" ? job.payload.projectId : undefined),
      workspaceId: params.workspaceId,
      repoLabel: `${resolved.owner}/${resolved.repo}`,
      findings: verified,
    });
  }
  return updateAgentJob(databases, job.id, {
    status: "completed",
    progress: { step: "Done", percent: 100 },
    result: {
      owner: resolved.owner,
      repo: resolved.repo,
      branch: resolved.branch,
      filesScanned: files.length,
      findings: verified,
      bugs: published.bugs,
      notified: published.notified,
    },
  });
}

async function runGithubPrJob(params: AgentJobRunParams & { job: AgentJob }): Promise<AgentJob | null> {
  const { databases, job, context, plugins } = params;
  const files = parsePrFiles(job.payload.files);
  const title = typeof job.payload.title === "string" ? job.payload.title : "Fairlx agent changes";
  if (!files.length) {
    return updateAgentJob(databases, job.id, { status: "failed", error: "No files to commit." });
  }
  await updateAgentJob(databases, job.id, {
    status: "running",
    progress: { step: "Writing files", percent: 5 },
  });
  try {
    const result = await githubCommitFilesAndOpenPr({
      databases,
      context,
      plugins,
      title,
      body: typeof job.payload.body === "string" ? job.payload.body : undefined,
      files,
      branch: typeof job.payload.branch === "string" ? job.payload.branch : undefined,
      base: typeof job.payload.base === "string" ? job.payload.base : undefined,
      repoId: typeof job.payload.repoId === "string" ? job.payload.repoId : undefined,
      projectId: typeof job.payload.projectId === "string" ? job.payload.projectId : params.projectId,
      onProgress: async (step, percent) => {
        await updateAgentJob(databases, job.id, { progress: { step, percent } });
      },
    });
    if ("error" in result) {
      return updateAgentJob(databases, job.id, { status: "failed", error: result.error });
    }
    return updateAgentJob(databases, job.id, {
      status: "completed",
      progress: { step: "Done", percent: 100 },
      result,
    });
  } catch (error) {
    return updateAgentJob(databases, job.id, {
      status: "failed",
      error: error instanceof Error ? error.message : "Pull request job failed",
    });
  }
}

export async function executeAgentJob(params: AgentJobRunParams): Promise<AgentJob | null> {
  const job = await getAgentJob(params.databases, params.userId, params.jobId);
  if (!job) return null;
  if (job.status === "completed") return job;
  if (job.status === "running") return job;
  if (job.kind === "security_review") {
    return runSecurityReviewJob({ ...params, job });
  }
  if (job.kind === "github_pr") {
    return runGithubPrJob({ ...params, job });
  }
  return updateAgentJob(params.databases, job.id, {
    status: "failed",
    error: `Unknown job kind: ${job.kind}`,
  });
}

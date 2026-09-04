import { after } from "next/server";
import type { Databases } from "node-appwrite";
import type { AuthContext } from "@fairlx/mcp-server";

import type { AgentContext, AgentHarness, AgentPluginConnection, McpConfig } from "../types";
import { executeAgentJob } from "./job-runner";

export type AgentJobScheduleParams = {
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

const inFlight = new Map<string, Promise<void>>();

export function scheduleAgentJob(params: AgentJobScheduleParams): void {
  if (inFlight.has(params.jobId)) return;
  let started = false;
  const task = async () => {
    if (started) return;
    started = true;
    try {
      await executeAgentJob(params);
    } catch (error) {
      console.error("[agent] job failed", params.jobId, error);
    } finally {
      inFlight.delete(params.jobId);
    }
  };
  inFlight.set(params.jobId, Promise.resolve());
  try {
    after(() => task());
  } catch {
    setTimeout(() => {
      void task();
    }, 0);
  }
  setTimeout(() => {
    void task();
  }, 300);
}

import { Query, type Databases } from "node-appwrite";
import type { AuthContext } from "@fairlx/mcp-server";

import { DATABASE_ID, WORK_ITEMS_ID } from "@/config";
import { notifyProjectChannels } from "@/features/integrations/lib/notify-channels";

import type { AgentContext, AgentContextWorkItem, AgentHarness, AgentRun, McpConfig } from "../types";
import type { SecurityFinding } from "../plugins/security";
import { callMcpServerTool, ensurePersonalMcp } from "./mcp-bridge";
import { matchWorkItem } from "./work-item-key";

export { matchWorkItem } from "./work-item-key";

async function lookupWorkItemByKey(
  databases: Databases | undefined,
  key: string,
): Promise<AgentContextWorkItem | undefined> {
  if (!databases || !key.trim()) return undefined;
  try {
    const result = await databases.listDocuments(DATABASE_ID, WORK_ITEMS_ID, [
      Query.equal("key", key.trim()),
      Query.limit(1),
    ]);
    const doc = result.documents[0] as
      | { $id: string; key?: string; title?: string; projectId?: string; workspaceId?: string }
      | undefined;
    if (!doc) return undefined;
    return {
      id: doc.$id,
      key: doc.key,
      title: doc.title || key,
      projectId: doc.projectId,
      workspaceId: doc.workspaceId,
    };
  } catch {
    return undefined;
  }
}

function mcpCtx(params: {
  userId: string;
  mcp: McpConfig;
  harness: AgentHarness;
  databases?: Databases;
  mcpAuth?: AuthContext;
  runs?: AgentRun[];
}) {
  return {
    userId: params.userId,
    mcp: ensurePersonalMcp(params.mcp),
    harness: params.harness,
    databases: params.databases,
    auth: params.mcpAuth,
    runs: params.runs,
  };
}

export async function commentMailedWorkItem(params: {
  databases?: Databases;
  context: AgentContext;
  mcp: McpConfig;
  harness: AgentHarness;
  userId: string;
  mcpAuth?: AuthContext;
  runs?: AgentRun[];
  workItemKey: string;
  to: string;
  subject: string;
}): Promise<{ commented: boolean; workItemId?: string }> {
  const fromContext = matchWorkItem(params.context.workItems, params.workItemKey);
  const item = fromContext ?? (await lookupWorkItemByKey(params.databases, params.workItemKey));
  if (!item) return { commented: false };
  try {
    await callMcpServerTool({
      server: "fairlx",
      tool: "fairlx_comment_add",
      args: {
        workItemId: item.id,
        content: `Mailed client (${params.to}): ${params.subject}`,
      },
      ctx: mcpCtx(params),
    });
    return { commented: true, workItemId: item.id };
  } catch (error) {
    console.error("[agent] failed to comment after mail", error);
    return { commented: false, workItemId: item.id };
  }
}

function findingPriority(severity: SecurityFinding["severity"]): "LOW" | "MEDIUM" | "HIGH" | "URGENT" {
  if (severity === "critical") return "URGENT";
  if (severity === "high") return "HIGH";
  if (severity === "medium") return "MEDIUM";
  return "LOW";
}

export async function publishSecurityFindings(params: {
  databases?: Databases;
  mcp: McpConfig;
  harness: AgentHarness;
  userId: string;
  mcpAuth?: AuthContext;
  runs?: AgentRun[];
  projectId?: string;
  workspaceId?: string;
  repoLabel: string;
  findings: SecurityFinding[];
}): Promise<{ bugs: Array<{ title: string }>; notified: boolean }> {
  const verified = params.findings.filter((finding) => finding.verified && finding.path).slice(0, 5);
  const bugs: Array<{ title: string }> = [];
  const projectId = params.projectId;
  if (projectId && verified.length) {
    for (const finding of verified) {
      const title = `[sec] ${finding.title} in ${finding.path}`;
      try {
        await callMcpServerTool({
          server: "fairlx",
          tool: "fairlx_work_item_create",
          args: {
            projectId,
            title,
            type: "BUG",
            priority: findingPriority(finding.severity),
            description: `${finding.category} (${finding.severity}) in ${params.repoLabel}:${finding.path}\n\n${finding.evidence}`,
          },
          ctx: mcpCtx(params),
        });
        bugs.push({ title });
      } catch (error) {
        console.error("[agent] failed to create security bug", error);
      }
    }
  }

  let notified = false;
  if (params.databases && projectId && verified.length) {
    try {
      await notifyProjectChannels(params.databases, {
        projectId,
        workspaceId: params.workspaceId,
        title: `Security review: ${verified.length} finding(s) in ${params.repoLabel}`,
        body: verified.map((finding) => `${finding.severity}: ${finding.title} (${finding.path})`).join("\n"),
      });
      notified = true;
    } catch (error) {
      console.error("[agent] failed to notify security findings", error);
    }
  }

  return { bugs, notified };
}

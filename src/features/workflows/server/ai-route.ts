import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { Databases, Query } from "node-appwrite";
import { z } from "zod";

import { getMember } from "@/features/members/utils";
import {
  DATABASE_ID,
  WORKFLOWS_ID,
  WORKFLOW_STATUSES_ID,
  WORKFLOW_TRANSITIONS_ID,
} from "@/config";
import { sessionMiddleware } from "@/lib/session-middleware";

import { WorkflowAI } from "../lib/workflow-ai";
import {
  WorkflowAIContext,
  WorkflowAIAnswer,
  WorkflowAIResponse,
  WorkflowAIAction,
} from "../types/ai-context";
import {
  Workflow,
  WorkflowStatus,
  WorkflowTransition,
} from "../types";

// Schema for getting AI context
const getWorkflowAIContextSchema = z.object({
  workflowId: z.string(),
  workspaceId: z.string(),
});

// Schema for asking questions
const askWorkflowQuestionSchema = z.object({
  workflowId: z.string(),
  workspaceId: z.string(),
  question: z.string().min(3).max(5000),
});

// Schema for AI status creation
const aiCreateStatusSchema = z.object({
  workflowId: z.string(),
  workspaceId: z.string(),
  prompt: z.string().min(5).max(5000),
  autoExecute: z.boolean().optional().default(false),
});

// Schema for AI transition creation
const aiCreateTransitionSchema = z.object({
  workflowId: z.string(),
  workspaceId: z.string(),
  prompt: z.string().min(5).max(5000),
  autoExecute: z.boolean().optional().default(false),
});

// Schema for AI workflow template generation
const aiGenerateWorkflowSchema = z.object({
  workflowId: z.string(),
  workspaceId: z.string(),
  prompt: z.string().min(10).max(5000),
});

// Schema for AI workflow analysis
const aiAnalyzeWorkflowSchema = z.object({
  workflowId: z.string(),
  workspaceId: z.string(),
});

/**
 * Helper to build workflow context for AI
 */
async function buildWorkflowContext(
  databases: Databases,
  workflowId: string
): Promise<WorkflowAIContext | null> {
  try {
    // Get workflow
    const workflow = await databases.getDocument(
      DATABASE_ID,
      WORKFLOWS_ID,
      workflowId
    ) as Workflow;

    // Get statuses
    const statusesResponse = await databases.listDocuments(
      DATABASE_ID,
      WORKFLOW_STATUSES_ID,
      [Query.equal("workflowId", workflowId), Query.orderAsc("position")]
    );

    // Get transitions
    const transitionsResponse = await databases.listDocuments(
      DATABASE_ID,
      WORKFLOW_TRANSITIONS_ID,
      [Query.equal("workflowId", workflowId)]
    );

    const statuses = statusesResponse.documents as WorkflowStatus[];
    const transitions = transitionsResponse.documents as WorkflowTransition[];

    // Build status map for transition names
    const statusMap = new Map(statuses.map((s: WorkflowStatus) => [s.$id, s]));

    // Calculate workflow issues
    let orphanedCount = 0;
    let unreachableCount = 0;
    let deadEndCount = 0;

    for (const status of statuses) {
      const hasIncoming = transitions.some((t: WorkflowTransition) => t.toStatusId === status.$id);
      const hasOutgoing = transitions.some((t: WorkflowTransition) => t.fromStatusId === status.$id);

      if (!status.isInitial && !hasIncoming && !hasOutgoing) {
        orphanedCount++;
      } else if (!status.isInitial && !hasIncoming && hasOutgoing) {
        unreachableCount++;
      } else if (!status.isFinal && hasIncoming && !hasOutgoing) {
        deadEndCount++;
      }
    }

    return {
      workflow: {
        id: workflow.$id,
        name: workflow.name,
        description: workflow.description || undefined,
      },
      statuses: statuses.map((s: WorkflowStatus) => ({
        id: s.$id,
        name: s.name,
        key: s.key,
        statusType: s.statusType,
        isInitial: s.isInitial,
        isFinal: s.isFinal,
        color: s.color,
        position: s.position,
      })),
      transitions: transitions.map((t: WorkflowTransition) => ({
        id: t.$id,
        fromStatus: statusMap.get(t.fromStatusId)?.key || t.fromStatusId,
        toStatus: statusMap.get(t.toStatusId)?.key || t.toStatusId,
        name: t.name || undefined,
        requiresApproval: t.requiresApproval ?? false,
        allowedRoles: t.allowedRoles,
        allowedTeams: t.allowedTeams,
      })),
      summary: {
        totalStatuses: statuses.length,
        totalTransitions: transitions.length,
        initialStatuses: statuses.filter((s: WorkflowStatus) => s.isInitial).length,
        finalStatuses: statuses.filter((s: WorkflowStatus) => s.isFinal).length,
        orphanedStatuses: orphanedCount,
        unreachableStatuses: unreachableCount,
        deadEndStatuses: deadEndCount,
      },
    };
  } catch {
    return null;
  }
}

const app = new Hono()
  // Get AI context for a workflow
  .get(
    "/context",
    sessionMiddleware,
    zValidator("query", getWorkflowAIContextSchema),
    async (c) => {
      try {
        const user = c.get("user");
        const databases = c.get("databases");
        const { workflowId, workspaceId } = c.req.valid("query");

        // Verify workspace membership
        const member = await getMember({
          databases,
          workspaceId,
          userId: user.$id,
        });

        if (!member) {
          return c.json({ error: "Unauthorized" }, 401);
        }

        const context = await buildWorkflowContext(databases, workflowId);
        if (!context) {
          return c.json({ error: "Failed to build workflow context" }, 500);
        }

        return c.json({ data: context });
      } catch {
        return c.json({ error: "Failed to fetch workflow context" }, 500);
      }
    }
  )

  // Ask a question about the workflow
  .post(
    "/ask",
    sessionMiddleware,
    zValidator("json", askWorkflowQuestionSchema),
    async (c) => {
      try {
        const user = c.get("user");
        const databases = c.get("databases");
        const { workflowId, workspaceId, question } = c.req.valid("json");

        // Verify workspace membership
        const member = await getMember({
          databases,
          workspaceId,
          userId: user.$id,
        });

        if (!member) {
          return c.json({ error: "Unauthorized" }, 401);
        }

        // Initialize AI
        const workflowAI = new WorkflowAI();

        if (!workflowAI.isConfigured()) {
          return c.json(
            { error: "AI features require GEMINI_API_KEY to be configured" },
            400
          );
        }

        // Build context
        const context = await buildWorkflowContext(databases, workflowId);
        if (!context) {
          return c.json({ error: "Failed to build workflow context" }, 500);
        }

        // Get AI answer
        const answer = await workflowAI.answerWorkflowQuestion(question, context);

        // Extract potential JSON action from the answer
        let action: WorkflowAIAction | undefined = undefined;
        try {
          const jsonMatch = answer.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.actionType === "suggest_workflow") {
              action = {
                type: "suggest_workflow",
                data: parsed.data,
              };
            }
          }
        } catch {
          // Ignore parse errors, just return text answer
        }

        const response: WorkflowAIAnswer = {
          question,
          answer: answer.replace(/\{[\s\S]*\}/, "").trim(), // Strip JSON from text answer
          timestamp: new Date().toISOString(),
          contextUsed: {
            statusesCount: context.summary.totalStatuses,
            transitionsCount: context.summary.totalTransitions,
          },
          action,
        };

        return c.json({ data: response });
      } catch {
        return c.json({ error: "Failed to get AI response" }, 500);
      }
    }
  )

  // Suggest a status based on prompt
  .post(
    "/suggest-status",
    sessionMiddleware,
    zValidator("json", aiCreateStatusSchema),
    async (c) => {
      try {
        const user = c.get("user");
        const databases = c.get("databases");
        const { workflowId, workspaceId, prompt } = c.req.valid("json");

        // Verify workspace membership
        const member = await getMember({
          databases,
          workspaceId,
          userId: user.$id,
        });

        if (!member) {
          return c.json({ error: "Unauthorized" }, 401);
        }

        // Initialize AI
        const workflowAI = new WorkflowAI();

        if (!workflowAI.isConfigured()) {
          return c.json(
            { error: "AI features require GEMINI_API_KEY to be configured" },
            400
          );
        }

        // Build context
        const context = await buildWorkflowContext(databases, workflowId);
        if (!context) {
          return c.json({ error: "Failed to build workflow context" }, 500);
        }

        // Get AI suggestion
        const suggestion = await workflowAI.suggestStatus(prompt, context);

        if (!suggestion) {
          return c.json({ 
            error: "Could not generate a valid status suggestion" 
          }, 400);
        }

        const response: WorkflowAIResponse = {
          success: true,
          message: `Suggested status: ${suggestion.name}`,
          action: {
            type: "create_status",
            data: suggestion,
          },
          status: suggestion,
        };

        return c.json({ data: response });
      } catch {
        return c.json({ error: "Failed to generate status suggestion" }, 500);
      }
    }
  )

  // Suggest a transition based on prompt
  .post(
    "/suggest-transition",
    sessionMiddleware,
    zValidator("json", aiCreateTransitionSchema),
    async (c) => {
      try {
        const user = c.get("user");
        const databases = c.get("databases");
        const { workflowId, workspaceId, prompt } = c.req.valid("json");

        // Verify workspace membership
        const member = await getMember({
          databases,
          workspaceId,
          userId: user.$id,
        });

        if (!member) {
          return c.json({ error: "Unauthorized" }, 401);
        }

        // Initialize AI
        const workflowAI = new WorkflowAI();

        if (!workflowAI.isConfigured()) {
          return c.json(
            { error: "AI features require GEMINI_API_KEY to be configured" },
            400
          );
        }

        // Build context
        const context = await buildWorkflowContext(databases, workflowId);
        if (!context) {
          return c.json({ error: "Failed to build workflow context" }, 500);
        }

        // Get AI suggestion
        const suggestion = await workflowAI.suggestTransition(prompt, context);

        if (!suggestion) {
          return c.json({ 
            error: "Could not generate a valid transition suggestion. Make sure the statuses exist." 
          }, 400);
        }

        const response: WorkflowAIResponse = {
          success: true,
          message: `Suggested transition: ${suggestion.fromStatusKey} → ${suggestion.toStatusKey}`,
          action: {
            type: "create_transition",
            data: suggestion,
          },
          transition: suggestion,
        };

        return c.json({ data: response });
      } catch {
        return c.json({ error: "Failed to generate transition suggestion" }, 500);
      }
    }
  )

  // Generate a workflow template
  .post(
    "/generate-workflow",
    sessionMiddleware,
    zValidator("json", aiGenerateWorkflowSchema),
    async (c) => {
      try {
        const user = c.get("user");
        const databases = c.get("databases");
        const { workspaceId, prompt } = c.req.valid("json");

        // Verify workspace membership
        const member = await getMember({
          databases,
          workspaceId,
          userId: user.$id,
        });

        if (!member) {
          return c.json({ error: "Unauthorized" }, 401);
        }

        // Initialize AI
        const workflowAI = new WorkflowAI();

        if (!workflowAI.isConfigured()) {
          return c.json(
            { error: "AI features require GEMINI_API_KEY to be configured" },
            400
          );
        }

        // Get AI suggestion
        const suggestion = await workflowAI.generateWorkflowTemplate(prompt);

        if (!suggestion) {
          return c.json({ 
            error: "Could not generate a valid workflow template" 
          }, 400);
        }

        const response: WorkflowAIResponse = {
          success: true,
          message: `Generated workflow: ${suggestion.name}`,
          action: {
            type: "suggest_workflow",
            data: suggestion,
          },
          workflow: suggestion,
        };

        return c.json({ data: response });
      } catch {
        return c.json({ error: "Failed to generate workflow template" }, 500);
      }
    }
  )

  // Analyze workflow and suggest improvements
  .post(
    "/analyze",
    sessionMiddleware,
    zValidator("json", aiAnalyzeWorkflowSchema),
    async (c) => {
      try {
        const user = c.get("user");
        const databases = c.get("databases");
        const { workflowId, workspaceId } = c.req.valid("json");

        // Verify workspace membership
        const member = await getMember({
          databases,
          workspaceId,
          userId: user.$id,
        });

        if (!member) {
          return c.json({ error: "Unauthorized" }, 401);
        }

        // Initialize AI
        const workflowAI = new WorkflowAI();

        if (!workflowAI.isConfigured()) {
          return c.json(
            { error: "AI features require GEMINI_API_KEY to be configured" },
            400
          );
        }

        // Build context
        const context = await buildWorkflowContext(databases, workflowId);
        if (!context) {
          return c.json({ error: "Failed to build workflow context" }, 500);
        }

        // Get AI analysis
        const analysis = await workflowAI.analyzeWorkflow(context);

        const response: WorkflowAIAnswer = {
          question: "Analyze workflow",
          answer: analysis,
          timestamp: new Date().toISOString(),
          contextUsed: {
            statusesCount: context.summary.totalStatuses,
            transitionsCount: context.summary.totalTransitions,
          },
          action: {
            type: "analyze_workflow",
          },
        };

        return c.json({ data: response });
      } catch {
        return c.json({ error: "Failed to analyze workflow" }, 500);
      }
    }
  );

export default app;

import { Hono } from "hono";
import type { Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

import { sessionMiddleware } from "@/lib/session-middleware";
import { createAdminClient } from "@/lib/appwrite";

import type { AgentAiConfigStored, AgentModel } from "../types";
import {
  defaultAiStoredConfig,
  defaultMcpConfig,
  mergePlatformAiConfig,
  toPublicAiConfig,
} from "../lib/defaults";
import { toPublicMcpConfig } from "../lib/public-mcp";
import { AgentEncryptionRequiredError } from "../lib/secrets";
import {
  getAiDocument,
  getMcpDocument,
  mergeMcpSecrets,
  mergeProviderSecrets,
  parseAiConfig,
  parseMcpConfig,
  upsertAiConfig,
  upsertMcpConfig,
} from "../lib/store";
import { loadAgentContext } from "../lib/context";
import {
  deleteUserRuns,
  getOrCreateHarness,
  resetHarness,
  upsertHarness,
} from "../lib/harness";
import { createRun, deleteRun, getRun, listRuns, updateRun } from "../lib/runs";
import { cancelAgentTurn } from "../lib/runtime";
import { isAgentTurnInFlight, scheduleAgentTurn } from "../lib/schedule-turn";
import { ensurePersonalMcp } from "../lib/mcp-bridge";
import { searchAgentIndex } from "../lib/search";
import { parseGitStaging, parseChatMeta } from "../lib/git-staging";

const mcpServerSchema = z
  .object({
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
    env: z.record(z.string()).optional(),
    url: z.string().optional(),
    headers: z.record(z.string()).optional(),
    transport: z.enum(["stdio", "sse", "http"]).optional(),
    disabled: z.boolean().optional(),
  })
  .passthrough();

const mcpConfigSchema = z
  .object({
    mcpServers: z.record(mcpServerSchema),
  })
  .passthrough();

const providerTypeSchema = z.enum([
  "anthropic",
  "azure",
  "google",
  "openai",
  "openrouter",
  "xai",
  "ollama",
  "custom",
]);

const providerSchema = z.object({
  id: z.string().min(1),
  provider: providerTypeSchema,
  displayName: z.string().min(1),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  extra: z.record(z.unknown()).optional(),
  isEnabled: z.boolean().optional().default(true),
  isPlatform: z.boolean().optional().default(false),
});

const modelSchema = z.object({
  id: z.string().min(1),
  providerId: z.string().min(1),
  modelId: z.string().min(1),
  displayName: z.string().min(1),
  role: z.enum(["default", "flash", "custom"]).optional(),
  isEnabled: z.boolean().optional().default(true),
  isPlatform: z.boolean().optional().default(false),
  toolCalling: z.boolean().optional(),
  vision: z.boolean().optional(),
  maxInputTokens: z.number().int().positive().optional(),
  maxOutputTokens: z.number().int().positive().optional(),
});

const aiConfigSchema = z.object({
  mode: z.enum(["auto", "manual"]),
  selectedModelId: z.string().optional(),
  providers: z.array(providerSchema),
  models: z.array(modelSchema),
});

const selectSchema = z.object({
  mode: z.enum(["auto", "manual"]),
  selectedModelId: z.string().optional(),
});

const createRunSchema = z.object({
  prompt: z.string().trim().min(1).max(8000),
  workspaceId: z.string().optional(),
  projectId: z.string().optional(),
});

const sendMessageSchema = z.object({
  content: z.string().trim().min(1).max(8000),
});

const patchRunSchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
  workspaceId: z.string().optional(),
  projectId: z.string().optional(),
});

const skillSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  description: z.string().max(500).optional().default(""),
  instructions: z.string().max(4000).optional().default(""),
  enabled: z.boolean(),
  createdAt: z.string().optional().default(""),
});

const automationSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  description: z.string().max(500).optional().default(""),
  trigger: z.string().max(500).optional().default(""),
  action: z.string().max(2000).optional().default(""),
  enabled: z.boolean(),
  createdAt: z.string().optional().default(""),
});

const knowledgeSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(160),
  content: z.string().max(8000).optional().default(""),
  source: z.string().max(500).optional().default(""),
  createdAt: z.string().optional().default(""),
});

const workPatternSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  instructions: z.string().max(4000).optional().default(""),
  enabled: z.boolean(),
  createdAt: z.string().optional().default(""),
});

const harnessSchema = z.object({
  skills: z.array(skillSchema).optional(),
  automations: z.array(automationSchema).optional(),
  knowledge: z.array(knowledgeSchema).optional(),
  workPatterns: z.array(workPatternSchema).optional(),
  gitStaging: z
    .object({
      items: z.array(
        z.object({
          id: z.string(),
          path: z.string(),
          summary: z.string().optional().default(""),
          status: z.enum(["unstaged", "staged", "committed"]),
          repoId: z.string().optional(),
          branch: z.string().optional(),
          content: z.string().optional(),
          createdAt: z.string().optional().default(""),
        }),
      ),
      updatedAt: z.string().optional().default(""),
    })
    .optional(),
  chatMeta: z
    .object({
      pinnedRunIds: z.array(z.string()).optional().default([]),
      archivedRunIds: z.array(z.string()).optional().default([]),
    })
    .optional(),
  settings: z
    .object({
      mode: z.enum(["agent", "manual"]).optional(),
      enabledTools: z.array(z.string()).optional(),
      defaultWorkspaceId: z.string().optional(),
      defaultProjectId: z.string().optional(),
      sessionMode: z.enum(["agent", "plan", "debug", "multitask", "ask"]).optional(),
    })
    .optional(),
});

function sessionUser(c: Context) {
  const user = c.get("user");
  return { $id: user.$id, name: user.name, email: user.email };
}

function encryptionErrorResponse(error: unknown, c: Context) {
  if (error instanceof AgentEncryptionRequiredError) {
    return c.json({ error: error.message }, 500);
  }
  return undefined;
}

const app = new Hono()
  .get("/mcp", sessionMiddleware, async (c) => {
    const user = c.get("user");
    const { databases } = await createAdminClient();

    try {
      const existing = await getMcpDocument(databases, user.$id);
      if (!existing) {
        const defaults = defaultMcpConfig();
        try {
          await upsertMcpConfig(databases, user.$id, defaults);
        } catch (error) {
          console.error("[agent] failed to persist default MCP config", error);
        }
        return c.json({ data: toPublicMcpConfig(ensurePersonalMcp(defaults)) });
      }

      return c.json({ data: toPublicMcpConfig(ensurePersonalMcp(parseMcpConfig(existing.configJson))) });
    } catch (error) {
      console.error("[agent] failed to load MCP config", error);
      return c.json({ data: toPublicMcpConfig(ensurePersonalMcp(defaultMcpConfig())) });
    }
  })
  .put("/mcp", sessionMiddleware, zValidator("json", mcpConfigSchema), async (c) => {
    const user = c.get("user");
    const incoming = c.req.valid("json");
    const { databases } = await createAdminClient();

    try {
      const existing = await getMcpDocument(databases, user.$id);
      const previous = existing ? parseMcpConfig(existing.configJson) : defaultMcpConfig();
      const stored = mergeMcpSecrets(incoming, previous);
      await upsertMcpConfig(databases, user.$id, ensurePersonalMcp(stored));
      return c.json({ data: toPublicMcpConfig(ensurePersonalMcp(stored)) });
    } catch (error) {
      console.error("[agent] failed to save MCP config", error);
      return encryptionErrorResponse(error, c) ?? c.json({ error: "Failed to save MCP config." }, 500);
    }
  })
  .get("/ai", sessionMiddleware, async (c) => {
    const user = c.get("user");
    const { databases } = await createAdminClient();

    try {
      const existing = await getAiDocument(databases, user.$id);
      if (!existing) {
        const defaults = defaultAiStoredConfig();
        try {
          await upsertAiConfig(databases, user.$id, defaults);
        } catch (error) {
          console.error("[agent] failed to persist default AI config", error);
        }
        return c.json({ data: toPublicAiConfig(defaults) });
      }

      return c.json({ data: toPublicAiConfig(parseAiConfig(existing)) });
    } catch (error) {
      console.error("[agent] failed to load AI config", error);
      return c.json({ data: toPublicAiConfig(defaultAiStoredConfig()) });
    }
  })
  .put("/ai", sessionMiddleware, zValidator("json", aiConfigSchema), async (c) => {
    const user = c.get("user");
    const incoming = c.req.valid("json");
    const { databases } = await createAdminClient();

    try {
      const existing = await getAiDocument(databases, user.$id);
      const previous = parseAiConfig(existing);
      const providers = mergeProviderSecrets(incoming.providers, previous.providers);
      const models = incoming.models.map((model) => ({
        ...model,
        isEnabled: model.isEnabled ?? true,
        isPlatform: Boolean(model.isPlatform),
      })) as AgentModel[];

      const stored = mergePlatformAiConfig({
        mode: incoming.mode,
        selectedModelId: incoming.selectedModelId,
        providers,
        models,
      } satisfies AgentAiConfigStored);

      await upsertAiConfig(databases, user.$id, stored);
      return c.json({ data: toPublicAiConfig(stored) });
    } catch (error) {
      console.error("[agent] failed to save AI config", error);
      return encryptionErrorResponse(error, c) ?? c.json({ error: "Failed to save model config." }, 500);
    }
  })
  .put("/ai/select", sessionMiddleware, zValidator("json", selectSchema), async (c) => {
    const user = c.get("user");
    const { mode, selectedModelId } = c.req.valid("json");
    const { databases } = await createAdminClient();

    try {
      const existing = await getAiDocument(databases, user.$id);
      const previous = parseAiConfig(existing);
      const stored = mergePlatformAiConfig({
        ...previous,
        mode,
        selectedModelId: mode === "auto" ? previous.selectedModelId : selectedModelId,
      });
      await upsertAiConfig(databases, user.$id, stored);
      return c.json({ data: toPublicAiConfig(stored) });
    } catch (error) {
      console.error("[agent] failed to select model", error);
      return c.json({ error: "Failed to select model." }, 500);
    }
  })
  .get("/runs", sessionMiddleware, async (c) => {
    const user = sessionUser(c);
    const { databases } = await createAdminClient();
    try {
      const data = await listRuns(databases, user.$id);
      return c.json({ data });
    } catch (error) {
      console.error("[agent] failed to list runs", error);
      return c.json({ error: "Failed to list agent runs." }, 500);
    }
  })
  .post("/runs", sessionMiddleware, zValidator("json", createRunSchema), async (c) => {
    const user = sessionUser(c);
    const json = c.req.valid("json");
    const { databases } = await createAdminClient();
    try {
      const harness = await getOrCreateHarness(databases, user.$id);
      const run = await createRun(databases, {
        userId: user.$id,
        prompt: json.prompt,
        mode: harness.settings.mode,
        workspaceId: json.workspaceId || harness.settings.defaultWorkspaceId,
        projectId: json.projectId || harness.settings.defaultProjectId,
      });
      scheduleAgentTurn({ databases, user, run });
      return c.json({ data: run });
    } catch (error) {
      const encrypted = encryptionErrorResponse(error, c);
      if (encrypted) return encrypted;
      console.error("[agent] failed to start run", error);
      return c.json({ error: "Failed to start agent run." }, 500);
    }
  })
  .get("/runs/:runId", sessionMiddleware, async (c) => {
    const user = sessionUser(c);
    const runId = c.req.param("runId");
    const { databases } = await createAdminClient();
    try {
      const run = await getRun(databases, user.$id, runId);
      if (!run) return c.json({ error: "Run not found." }, 404);
      return c.json({ data: run });
    } catch (error) {
      console.error("[agent] failed to get run", error);
      return c.json({ error: "Failed to load agent run." }, 500);
    }
  })
  .patch("/runs/:runId", sessionMiddleware, zValidator("json", patchRunSchema), async (c) => {
    const user = sessionUser(c);
    const runId = c.req.param("runId");
    const json = c.req.valid("json");
    const { databases } = await createAdminClient();
    try {
      const existing = await getRun(databases, user.$id, runId);
      if (!existing) return c.json({ error: "Run not found." }, 404);
      const data = await updateRun(databases, runId, json);
      return c.json({ data });
    } catch (error) {
      console.error("[agent] failed to update run", error);
      return c.json({ error: "Failed to update agent run." }, 500);
    }
  })
  .post("/runs/:runId/messages", sessionMiddleware, zValidator("json", sendMessageSchema), async (c) => {
    const user = sessionUser(c);
    const runId = c.req.param("runId");
    const { content } = c.req.valid("json");
    const { databases } = await createAdminClient();
    try {
      const existing = await getRun(databases, user.$id, runId);
      if (!existing) return c.json({ error: "Run not found." }, 404);
      if (existing.status === "running") {
        return c.json({ error: "Run is already in progress." }, 409);
      }
      const createdAt = new Date().toISOString();
      const run = await updateRun(databases, runId, {
        status: "running",
        error: "",
        messages: [
          ...existing.messages,
          { id: crypto.randomUUID(), role: "user", content, createdAt },
        ],
      });
      scheduleAgentTurn({ databases, user, run });
      return c.json({ data: run });
    } catch (error) {
      const encrypted = encryptionErrorResponse(error, c);
      if (encrypted) return encrypted;
      console.error("[agent] failed to send message", error);
      return c.json({ error: "Failed to send message." }, 500);
    }
  })
  .post("/runs/:runId/continue", sessionMiddleware, async (c) => {
    const user = sessionUser(c);
    const runId = c.req.param("runId");
    const { databases } = await createAdminClient();
    try {
      const existing = await getRun(databases, user.$id, runId);
      if (!existing) return c.json({ error: "Run not found." }, 404);
      if (existing.status === "completed") return c.json({ data: existing });
      if (isAgentTurnInFlight(runId)) return c.json({ data: existing });

      const run =
        existing.status === "running"
          ? existing
          : await updateRun(databases, runId, { status: "running", error: "" });
      scheduleAgentTurn({ databases, user, run });
      return c.json({ data: run });
    } catch (error) {
      console.error("[agent] failed to continue run", error);
      return c.json({ error: "Failed to continue agent run." }, 500);
    }
  })
  .post("/runs/:runId/stop", sessionMiddleware, async (c) => {
    const user = sessionUser(c);
    const runId = c.req.param("runId");
    const { databases } = await createAdminClient();
    try {
      const existing = await getRun(databases, user.$id, runId);
      if (!existing) return c.json({ error: "Run not found." }, 404);
      cancelAgentTurn(runId);
      if (existing.status !== "running") return c.json({ data: existing });
      const data = await updateRun(databases, runId, { status: "stopped" });
      return c.json({ data });
    } catch (error) {
      console.error("[agent] failed to stop run", error);
      return c.json({ error: "Failed to stop agent run." }, 500);
    }
  })
  .delete("/runs/:runId", sessionMiddleware, async (c) => {
    const user = sessionUser(c);
    const runId = c.req.param("runId");
    const { databases } = await createAdminClient();
    try {
      const existing = await getRun(databases, user.$id, runId);
      if (!existing) return c.json({ error: "Run not found." }, 404);
      if (existing.status === "running") {
        cancelAgentTurn(runId);
      }
      await deleteRun(databases, user.$id, runId);
      return c.json({ data: { id: runId } });
    } catch (error) {
      console.error("[agent] failed to delete run", error);
      return c.json({ error: "Failed to delete agent run." }, 500);
    }
  })
  .get("/search", sessionMiddleware, zValidator("query", z.object({
    q: z.string().optional(),
    query: z.string().optional(),
  })), async (c) => {
    const user = sessionUser(c);
    const parsed = c.req.valid("query");
    const query = (parsed.q || parsed.query || "").trim();
    const { databases } = await createAdminClient();
    try {
      const [runs, harness, context, mcpDoc] = await Promise.all([
        listRuns(databases, user.$id, 80),
        getOrCreateHarness(databases, user.$id),
        loadAgentContext(databases, user),
        getMcpDocument(databases, user.$id),
      ]);
      const mcp = ensurePersonalMcp(parseMcpConfig(mcpDoc?.configJson));
      const data = searchAgentIndex({ query, runs, harness, context, mcp, limit: 40 });
      return c.json({ data, query });
    } catch (error) {
      console.error("[agent] failed to search", error);
      return c.json({ error: "Failed to search the Agent harness." }, 500);
    }
  })
  .post("/harness/automations/:automationId/run", sessionMiddleware, async (c) => {
    const user = sessionUser(c);
    const automationId = c.req.param("automationId");
    const { databases } = await createAdminClient();
    try {
      const harness = await getOrCreateHarness(databases, user.$id);
      const automation = harness.automations.find((item) => item.id === automationId);
      if (!automation) return c.json({ error: "Automation not found." }, 404);
      const prompt = [
        `Run automation "${automation.name}".`,
        automation.trigger ? `Trigger: ${automation.trigger}` : "",
        `Action: ${automation.action || automation.description}`,
      ]
        .filter(Boolean)
        .join("\n");
      const run = await createRun(databases, {
        userId: user.$id,
        prompt,
        mode: harness.settings.mode,
        workspaceId: harness.settings.defaultWorkspaceId,
        projectId: harness.settings.defaultProjectId,
      });
      scheduleAgentTurn({ databases, user, run });
      return c.json({ data: run });
    } catch (error) {
      console.error("[agent] failed to run automation", error);
      return c.json({ error: "Failed to run automation." }, 500);
    }
  })
  .get("/harness", sessionMiddleware, async (c) => {
    const user = sessionUser(c);
    const { databases } = await createAdminClient();
    try {
      const data = await getOrCreateHarness(databases, user.$id);
      return c.json({ data });
    } catch (error) {
      console.error("[agent] failed to load harness", error);
      return c.json({ error: "Failed to load agent harness." }, 500);
    }
  })
  .put("/harness", sessionMiddleware, zValidator("json", harnessSchema), async (c) => {
    const user = sessionUser(c);
    const json = c.req.valid("json");
    const { databases } = await createAdminClient();
    try {
      const data = await upsertHarness(databases, user.$id, {
        ...json,
        gitStaging: json.gitStaging ? parseGitStaging(json.gitStaging) : undefined,
        chatMeta: json.chatMeta ? parseChatMeta(json.chatMeta) : undefined,
      });
      return c.json({ data });
    } catch (error) {
      console.error("[agent] failed to save harness", error);
      return c.json({ error: "Failed to save agent harness." }, 500);
    }
  })
  .post("/harness/reset", sessionMiddleware, async (c) => {
    const user = sessionUser(c);
    const { databases } = await createAdminClient();
    try {
      await deleteUserRuns(databases, user.$id);
      const data = await resetHarness(databases, user.$id);
      return c.json({ data });
    } catch (error) {
      console.error("[agent] failed to reset harness", error);
      return c.json({ error: "Failed to reset agent harness." }, 500);
    }
  })
  .get("/context", sessionMiddleware, async (c) => {
    const user = sessionUser(c);
    const { databases } = await createAdminClient();
    try {
      const data = await loadAgentContext(databases, user);
      return c.json({ data });
    } catch (error) {
      console.error("[agent] failed to load context", error);
      return c.json({ error: "Failed to load agent context." }, 500);
    }
  });

export default app;

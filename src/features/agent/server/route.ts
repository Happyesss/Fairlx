import { Hono } from "hono";
import type { Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

import { sessionMiddleware } from "@/lib/session-middleware";
import { createAdminClient } from "@/lib/appwrite";

import type { AgentAiConfigStored, AgentModel, AgentRun } from "../types";
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
import { AGENT_PROMPT_HTTP_MAX } from "../lib/limits";
import {
  MAX_TRANSCRIBE_BYTES,
  TranscribeConfigError,
  TranscribeRequestError,
  transcribeAudioBlob,
} from "../lib/transcribe";
import { audioFilenameForMime } from "../lib/voice-input";
import { cancelAgentTurn } from "../lib/runtime";
import { isAgentTurnInFlight, scheduleAgentTurn } from "../lib/schedule-turn";
import { runNeedsAgentTurn } from "../lib/run-turn";
import { findPendingConfirmation } from "../lib/write-guard";
import { ensurePersonalMcp } from "../lib/mcp-bridge";
import { searchAgentIndex } from "../lib/search";
import { parseGitStaging, parseChatMeta } from "../lib/git-staging";
import { briefingFromAgentContext, createMultiAgentEngine, agentContextToInjected } from "../lib/multi-agent";
import { emitToUser } from "@/lib/socket";
import { isPersonalSessionMode } from "../lib/session-context";
import { compileTrainedPersonalPrompt } from "../lib/personal-compile";
import { runPersonalSelfTrain } from "../lib/personal-self-train";
import {
  getPersonalAgent,
  resetPersonalAgent,
  upsertPersonalAgent,
} from "../lib/personal-agent-store";
import { syncTrainingDraftFromRun, syncTrainingDraftFromRuns } from "../lib/personal-training-sync";
import {
  findActiveTrainingRun,
  isPersonalPersonaRole,
  mergeAnswers,
  personaFocus,
  personaLabel,
  profileIsTrained,
  questionsForRole,
  requiredAnswersMissing,
  suggestedPersonaRole,
  trainingKickoffPrompt,
  trainingProgress,
} from "../lib/personal-training";
import { PLUGIN_CATALOG, toPublicPlugin } from "../plugins/catalog";
import { buildPluginConnection, upsertPluginList } from "../plugins/connect";
import {
  applyOauthTokensToSecrets,
  buildMailAuthorizeUrl,
  decodeOauthState,
  encodeOauthState,
  exchangeMailOauthCode,
  isMailOauthCatalog,
  lookupMailFromAddress,
  mailOauthStatus,
  resolveOauthClient,
} from "../plugins/oauth";
import { getAgentJob, listAgentJobs, updateAgentJob } from "../lib/jobs";
import { scheduleAgentJob } from "../lib/schedule-job";
import { buildAgentMcpAuth } from "../lib/agent-auth";

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
  prompt: z.string().trim().min(1).max(AGENT_PROMPT_HTTP_MAX),
  workspaceId: z.string().optional(),
  projectId: z.string().optional(),
});

const sendMessageSchema = z.object({
  content: z.string().trim().min(1).max(AGENT_PROMPT_HTTP_MAX),
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
      sessionMode: z.enum(["agent", "personal", "plan", "debug", "multitask", "ask"]).optional(),
      permissionType: z.enum(["staged", "all_access"]).optional(),
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
      if (isPersonalSessionMode(harness.settings.sessionMode)) {
        const profile = await getPersonalAgent(databases, user.$id);
        if (!profileIsTrained(profile)) {
          return c.json({ error: "Personal Agent is not trained yet.", code: "personal_untrained" }, 409);
        }
      }
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
      if (existing.kind !== "training") {
        const harness = await getOrCreateHarness(databases, user.$id);
        if (isPersonalSessionMode(harness.settings.sessionMode)) {
          const profile = await getPersonalAgent(databases, user.$id);
          if (!profileIsTrained(profile)) {
            return c.json({ error: "Personal Agent is not trained yet.", code: "personal_untrained" }, 409);
          }
        }
      }
      if (existing.status === "running") {
        return c.json({ error: "Run is already in progress." }, 409);
      }
      if (existing.status === "awaiting_confirmation") {
        return c.json({ error: "Accept or deny the pending action first." }, 409);
      }
      const createdAt = new Date().toISOString();
      const events =
        existing.status === "awaiting_plugin"
          ? [
              ...existing.events,
              {
                id: crypto.randomUUID(),
                type: "plugin_connected" as const,
                title: "Continued without connecting a mail plugin",
                createdAt,
                runId: existing.id,
              },
            ]
          : existing.events;
      const run = await updateRun(databases, runId, {
        status: "running",
        error: "",
        events,
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
      if (existing.kind !== "training") {
        const harness = await getOrCreateHarness(databases, user.$id);
        if (isPersonalSessionMode(harness.settings.sessionMode)) {
          const profile = await getPersonalAgent(databases, user.$id);
          if (!profileIsTrained(profile)) {
            return c.json({ error: "Personal Agent is not trained yet.", code: "personal_untrained" }, 409);
          }
        }
      }
      if (existing.status === "awaiting_confirmation") return c.json({ data: existing });
      if (existing.status === "completed") return c.json({ data: existing });
      if (isAgentTurnInFlight(runId)) return c.json({ data: existing });
      if (findPendingConfirmation(existing.events ?? [], existing.messages ?? [])) return c.json({ data: existing });
      if (existing.status !== "awaiting_plugin" && !runNeedsAgentTurn(existing)) return c.json({ data: existing });

      const events =
        existing.status === "awaiting_plugin"
          ? [
              ...existing.events,
              {
                id: crypto.randomUUID(),
                type: "plugin_connected" as const,
                title: "Continued without connecting a mail plugin",
                createdAt: new Date().toISOString(),
                runId: existing.id,
              },
            ]
          : existing.events;
      const run = await updateRun(databases, runId, { status: "running", error: "", events });
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
      if (existing.status !== "running" && existing.status !== "awaiting_confirmation") {
        return c.json({ data: existing });
      }
      const data = await updateRun(databases, runId, { status: "stopped" });
      if (data.kind === "training") {
        try {
          const context = await loadAgentContext(databases, user);
          const harness = await getOrCreateHarness(databases, user.$id);
          const profile = await getPersonalAgent(databases, user.$id);
          const role = profile?.personaRole ?? suggestedPersonaRole(context, harness.settings.defaultWorkspaceId);
          await syncTrainingDraftFromRun(databases, user.$id, profile, data, role);
        } catch (error) {
          console.error("[agent] failed to persist training draft on stop", error);
        }
      }
      return c.json({ data });
    } catch (error) {
      console.error("[agent] failed to stop run", error);
      return c.json({ error: "Failed to stop agent run." }, 500);
    }
  })
  .post("/runs/:runId/confirm", sessionMiddleware, async (c) => {
    const user = sessionUser(c);
    const runId = c.req.param("runId");
    const { databases } = await createAdminClient();
    try {
      const existing = await getRun(databases, user.$id, runId);
      if (!existing) return c.json({ error: "Run not found." }, 404);
      if (existing.status !== "awaiting_confirmation") {
        return c.json({ error: "Nothing is waiting for approval." }, 409);
      }
      if (isAgentTurnInFlight(runId)) return c.json({ data: existing });
      const run = await updateRun(databases, runId, { status: "running", error: "" });
      scheduleAgentTurn({
        databases,
        user,
        run: { ...existing, status: "running" },
        resume: { decision: "accept" },
      });
      return c.json({ data: run });
    } catch (error) {
      console.error("[agent] failed to confirm run", error);
      return c.json({ error: "Failed to accept the action." }, 500);
    }
  })
  .post("/runs/:runId/deny", sessionMiddleware, async (c) => {
    const user = sessionUser(c);
    const runId = c.req.param("runId");
    const { databases } = await createAdminClient();
    try {
      const existing = await getRun(databases, user.$id, runId);
      if (!existing) return c.json({ error: "Run not found." }, 404);
      if (existing.status !== "awaiting_confirmation") {
        return c.json({ error: "Nothing is waiting for approval." }, 409);
      }
      if (isAgentTurnInFlight(runId)) return c.json({ data: existing });
      const run = await updateRun(databases, runId, { status: "running", error: "" });
      scheduleAgentTurn({
        databases,
        user,
        run: { ...existing, status: "running" },
        resume: { decision: "deny" },
      });
      return c.json({ data: run });
    } catch (error) {
      console.error("[agent] failed to deny run", error);
      return c.json({ error: "Failed to deny the action." }, 500);
    }
  })
  .delete("/runs/:runId", sessionMiddleware, async (c) => {
    const user = sessionUser(c);
    const runId = c.req.param("runId");
    const { databases } = await createAdminClient();
    try {
      const existing = await getRun(databases, user.$id, runId);
      if (!existing) return c.json({ error: "Run not found." }, 404);
      if (existing.status === "running" || existing.status === "awaiting_confirmation") {
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
      return c.json({ data: { ...data, plugins: data.plugins.map(toPublicPlugin) } });
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
  .get("/plugins", sessionMiddleware, async (c) => {
    const user = sessionUser(c);
    const { databases } = await createAdminClient();
    try {
      const harness = await getOrCreateHarness(databases, user.$id);
      return c.json({
        data: {
          catalog: PLUGIN_CATALOG,
          connected: harness.plugins.map(toPublicPlugin),
          oauth: mailOauthStatus(),
        },
      });
    } catch (error) {
      console.error("[agent] failed to list plugins", error);
      return c.json({ error: "Failed to list plugins." }, 500);
    }
  })
  .post(
    "/plugins",
    sessionMiddleware,
    zValidator(
      "json",
      z.object({
        catalogId: z.string().min(1),
        displayName: z.string().optional(),
        fields: z.record(z.string()).optional(),
        runId: z.string().optional(),
      }),
    ),
    async (c) => {
      const user = sessionUser(c);
      const json = c.req.valid("json");
      const { databases } = await createAdminClient();
      try {
        const harness = await getOrCreateHarness(databases, user.$id);
        const connection = buildPluginConnection(json);
        const data = await upsertHarness(databases, user.$id, {
          plugins: upsertPluginList(harness.plugins, connection),
        });
        if (json.runId) {
          const existing = await getRun(databases, user.$id, json.runId);
          if (existing?.status === "awaiting_plugin") {
            const run = await updateRun(databases, json.runId, {
              status: "running",
              error: "",
              events: [
                ...existing.events,
                {
                  id: crypto.randomUUID(),
                  type: "plugin_connected",
                  title: `Connected ${connection.displayName}`,
                  createdAt: new Date().toISOString(),
                  runId: existing.id,
                },
              ],
            });
            scheduleAgentTurn({ databases, user, run });
          }
        }
        return c.json({ data: { connected: data.plugins.map(toPublicPlugin) } });
      } catch (error) {
        console.error("[agent] failed to connect plugin", error);
        return encryptionErrorResponse(error, c) ?? c.json({ error: "Failed to connect plugin." }, 500);
      }
    },
  )
  .get("/plugins/oauth/start", sessionMiddleware, async (c) => {
    const user = sessionUser(c);
    const catalogId = c.req.query("catalogId") || "";
    const runId = c.req.query("runId") || undefined;
    const from = c.req.query("from") || undefined;
    if (!isMailOauthCatalog(catalogId)) {
      return c.json({ error: "OAuth is only available for Outlook and Gmail." }, 400);
    }
    const { databases } = await createAdminClient();
    try {
      const harness = await getOrCreateHarness(databases, user.$id);
      const existing = harness.plugins.find((plugin) => plugin.catalogId === catalogId);
      const client = resolveOauthClient(catalogId, existing);
      const state = encodeOauthState({
        userId: user.$id,
        catalogId,
        runId,
        from,
        nonce: crypto.randomUUID(),
      });
      return c.redirect(buildMailAuthorizeUrl({ catalogId, clientId: client.clientId, state }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start OAuth.";
      return c.json({ error: message }, 400);
    }
  })
  .get("/plugins/oauth/callback", sessionMiddleware, async (c) => {
    const user = sessionUser(c);
    const errorParam = c.req.query("error");
    const code = c.req.query("code") || "";
    const stateRaw = c.req.query("state") || "";
    const failRedirect = (message: string, runId?: string) => {
      const dest = runId ? `/agent/workflow?runId=${encodeURIComponent(runId)}` : "/agent/integrations";
      const url = new URL(dest, "http://localhost");
      url.searchParams.set("pluginError", message);
      return c.redirect(`${url.pathname}${url.search}`);
    };
    if (errorParam) return failRedirect(errorParam);
    let state;
    try {
      state = decodeOauthState(stateRaw);
    } catch {
      return failRedirect("Invalid OAuth state.");
    }
    if (state.userId !== user.$id) return failRedirect("OAuth user mismatch.");
    if (!code) return failRedirect("Missing OAuth code.", state.runId);
    const { databases } = await createAdminClient();
    try {
      const harness = await getOrCreateHarness(databases, user.$id);
      const existing = harness.plugins.find((plugin) => plugin.catalogId === state.catalogId);
      const oauthClient = resolveOauthClient(state.catalogId, existing);
      const tokens = await exchangeMailOauthCode({
        catalogId: state.catalogId,
        code,
        clientId: oauthClient.clientId,
        clientSecret: oauthClient.clientSecret,
      });
      const from =
        state.from ||
        existing?.secrets?.from ||
        (await lookupMailFromAddress({ catalogId: state.catalogId, accessToken: tokens.accessToken }));
      const catalog = PLUGIN_CATALOG.find((item) => item.id === state.catalogId);
      const connection = {
        id: existing?.id || crypto.randomUUID(),
        catalogId: state.catalogId,
        displayName: catalog?.name || state.catalogId,
        capabilities: catalog?.capabilities ?? (["email.send"] as const),
        status: "connected" as const,
        authKind: "oauth" as const,
        secrets: applyOauthTokensToSecrets(existing?.secrets, tokens, from),
        createdAt: existing?.createdAt || new Date().toISOString(),
      };
      await upsertHarness(databases, user.$id, {
        plugins: upsertPluginList(harness.plugins, connection),
      });
      if (state.runId) {
        const existingRun = await getRun(databases, user.$id, state.runId);
        if (existingRun?.status === "awaiting_plugin") {
          const run = await updateRun(databases, state.runId, {
            status: "running",
            error: "",
            events: [
              ...existingRun.events,
              {
                id: crypto.randomUUID(),
                type: "plugin_connected",
                title: `Connected ${connection.displayName}`,
                createdAt: new Date().toISOString(),
                runId: existingRun.id,
              },
            ],
          });
          scheduleAgentTurn({ databases, user, run });
        }
        return c.redirect(`/agent/workflow?runId=${encodeURIComponent(state.runId)}`);
      }
      return c.redirect("/agent/integrations");
    } catch (error) {
      const message = error instanceof Error ? error.message : "OAuth connect failed.";
      return failRedirect(message.slice(0, 180), state.runId);
    }
  })
  .delete("/plugins/:pluginId", sessionMiddleware, async (c) => {
    const user = sessionUser(c);
    const pluginId = c.req.param("pluginId");
    const { databases } = await createAdminClient();
    try {
      const harness = await getOrCreateHarness(databases, user.$id);
      const data = await upsertHarness(databases, user.$id, {
        plugins: harness.plugins.filter((plugin) => plugin.id !== pluginId && plugin.catalogId !== pluginId),
      });
      return c.json({ data: { connected: data.plugins.map(toPublicPlugin) } });
    } catch (error) {
      console.error("[agent] failed to disconnect plugin", error);
      return c.json({ error: "Failed to disconnect plugin." }, 500);
    }
  })
  .get("/jobs", sessionMiddleware, async (c) => {
    const user = sessionUser(c);
    const { databases } = await createAdminClient();
    try {
      const data = await listAgentJobs(databases, user.$id);
      return c.json({ data });
    } catch (error) {
      console.error("[agent] failed to list jobs", error);
      return c.json({ error: "Failed to list agent jobs." }, 500);
    }
  })
  .get("/jobs/:jobId", sessionMiddleware, async (c) => {
    const user = sessionUser(c);
    const jobId = c.req.param("jobId");
    const { databases } = await createAdminClient();
    try {
      const data = await getAgentJob(databases, user.$id, jobId);
      if (!data) return c.json({ error: "Job not found." }, 404);
      return c.json({ data });
    } catch (error) {
      console.error("[agent] failed to get job", error);
      return c.json({ error: "Failed to load agent job." }, 500);
    }
  })
  .post("/jobs/:jobId/retry", sessionMiddleware, async (c) => {
    const user = sessionUser(c);
    const jobId = c.req.param("jobId");
    const { databases } = await createAdminClient();
    try {
      const job = await getAgentJob(databases, user.$id, jobId);
      if (!job) return c.json({ error: "Job not found." }, 404);
      if (job.status !== "completed") {
        await updateAgentJob(databases, job.id, { status: "queued", error: "" });
      }
      const [context, harness, mcpDoc] = await Promise.all([
        loadAgentContext(databases, user),
        getOrCreateHarness(databases, user.$id),
        getMcpDocument(databases, user.$id),
      ]);
      const mcp = ensurePersonalMcp(parseMcpConfig(mcpDoc?.configJson));
      const stubRun: AgentRun = {
        id: job.runId || job.id,
        userId: user.$id,
        title: job.kind,
        prompt: "",
        status: "running",
        mode: "agent",
        projectId: typeof job.payload.projectId === "string" ? job.payload.projectId : undefined,
        messages: [],
        events: [],
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      };
      const mcpAuth = await buildAgentMcpAuth({ databases, userId: user.$id, context, run: stubRun });
      scheduleAgentJob({
        databases,
        userId: user.$id,
        jobId: job.id,
        context,
        plugins: harness.plugins,
        mcp,
        mcpAuth,
        harness,
        projectId: stubRun.projectId || mcpAuth.projectId,
        workspaceId: mcpAuth.workspaceId,
      });
      return c.json({ data: { ...job, status: job.status === "completed" ? job.status : "queued" } });
    } catch (error) {
      console.error("[agent] failed to retry job", error);
      return c.json({ error: "Failed to resume agent job." }, 500);
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
  })
  .get("/briefing", sessionMiddleware, async (c) => {
    const user = sessionUser(c);
    const { databases } = await createAdminClient();
    try {
      const context = await loadAgentContext(databases, user);
      const profile = await getPersonalAgent(databases, user.$id);
      const workspaceId = c.req.query("workspaceId") || undefined;
      const projectId = c.req.query("projectId") || undefined;
      const personaRole = profile && profileIsTrained(profile) ? profile.personaRole : undefined;
      const data = briefingFromAgentContext(context, { workspaceId, projectId, personaRole });
      return c.json({ data });
    } catch (error) {
      console.error("[agent] failed to build briefing", error);
      return c.json({ error: "Failed to build daily briefing." }, 500);
    }
  })
  .post(
    "/autonomous",
    sessionMiddleware,
    zValidator(
      "json",
      z.object({
        prompt: z.string().trim().min(1).max(AGENT_PROMPT_HTTP_MAX),
        workspaceId: z.string().optional(),
        projectId: z.string().optional(),
        personaRole: z.enum(["tech_lead", "frontend", "qa", "pm"]).optional(),
      }),
    ),
    async (c) => {
      const user = sessionUser(c);
      const { prompt, workspaceId, projectId, personaRole } = c.req.valid("json");
      const { databases } = await createAdminClient();
      try {
        const context = await loadAgentContext(databases, user);
        const injected = agentContextToInjected(context, { workspaceId, projectId, personaRole });
        const engine = createMultiAgentEngine();
        const data = await engine.runGoal({
          userId: user.$id,
          prompt,
          workspaceId: workspaceId || injected.workspaceId,
          projectId: projectId || injected.projectId,
          personaRole,
          workspaceRole: injected.workspaceRole,
          context: injected,
        });
        emitToUser(user.$id, {
          notificationId: data.parent.id,
          type: "agent_run_completed",
          title: data.parent.status === "completed" ? "Task complete & verified!" : "Autonomous run update",
          message: data.decision?.reason || data.parent.title,
          workspaceId: workspaceId || injected.workspaceId || "",
          createdAt: new Date().toISOString(),
        });
        return c.json({ data });
      } catch (error) {
        console.error("[agent] autonomous run failed", error);
        return c.json({ error: "Failed to start the autonomous run." }, 500);
      }
    },
  )
  .get("/personal", sessionMiddleware, async (c) => {
    const user = sessionUser(c);
    const { databases } = await createAdminClient();
    try {
      const context = await loadAgentContext(databases, user);
      const harness = await getOrCreateHarness(databases, user.$id);
      const suggestedRole = suggestedPersonaRole(context, harness.settings.defaultWorkspaceId);
      let profile = await getPersonalAgent(databases, user.$id);
      const runs = await listRuns(databases, user.$id, 40);
      try {
        profile = await syncTrainingDraftFromRuns(
          databases,
          user.$id,
          profile,
          runs,
          profile?.personaRole ?? suggestedRole,
        );
      } catch (error) {
        console.error("[agent] failed to overlay training draft", error);
      }
      const role = profile?.personaRole ?? suggestedRole;
      const progress = trainingProgress(profile?.answers, role);
      const active = findActiveTrainingRun(runs);
      return c.json({
        data: {
          profile,
          progress,
          activeTrainingRunId: active?.id ?? null,
          suggestedRole,
          suggestedRoleLabel: personaLabel(suggestedRole),
          suggestedRoleFocus: personaFocus(suggestedRole),
          roles: (["tech_lead", "frontend", "qa", "pm"] as const).map((id) => ({
            id,
            label: personaLabel(id),
            focus: personaFocus(id),
          })),
        },
      });
    } catch (error) {
      console.error("[agent] failed to load personal agent", error);
      return c.json({ error: "Failed to load personal agent." }, 500);
    }
  })
  .get(
    "/personal/questions",
    sessionMiddleware,
    zValidator(
      "query",
      z.object({
        personaRole: z.enum(["tech_lead", "frontend", "qa", "pm"]).optional(),
      }),
    ),
    async (c) => {
    const roleParam = c.req.valid("query").personaRole;
    const user = sessionUser(c);
    const { databases } = await createAdminClient();
    try {
      const context = await loadAgentContext(databases, user);
      const harness = await getOrCreateHarness(databases, user.$id);
      const profile = await getPersonalAgent(databases, user.$id);
      const personaRole = isPersonalPersonaRole(roleParam)
        ? roleParam
        : profile?.personaRole ?? suggestedPersonaRole(context, harness.settings.defaultWorkspaceId);
      const questions = questionsForRole(personaRole);
      return c.json({
        data: {
          personaRole,
          label: personaLabel(personaRole),
          focus: personaFocus(personaRole),
          questions,
          previousAnswers: profile?.answers ?? [],
        },
      });
    } catch (error) {
      console.error("[agent] failed to load training questions", error);
      return c.json({ error: "Failed to load training questions." }, 500);
    }
  })
  .post(
    "/personal/compile",
    sessionMiddleware,
    zValidator(
      "json",
      z.object({
        personaRole: z.enum(["tech_lead", "frontend", "qa", "pm"]),
        jobTitle: z.string().trim().max(160).optional(),
        workspaceId: z.string().optional(),
        projectId: z.string().optional(),
        answers: z
          .array(
            z.object({
              questionId: z.string().min(1),
              answer: z.string().max(4000),
            }),
          )
          .min(1)
          .max(24),
      }),
    ),
    async (c) => {
      const user = sessionUser(c);
      const json = c.req.valid("json");
      const { databases } = await createAdminClient();
      try {
        const context = await loadAgentContext(databases, user);
        const harness = await getOrCreateHarness(databases, user.$id);
        const profile = await getPersonalAgent(databases, user.$id);
        const questions = questionsForRole(json.personaRole);
        const answers = mergeAnswers(questions, profile?.answers, json.answers);
        const missing = requiredAnswersMissing(answers, questions);
        if (missing.length) {
          return c.json({ error: "Answer every required question in a full sentence.", missing }, 400);
        }
        const workspace =
          context.workspaces.find((item) => item.id === (json.workspaceId || harness.settings.defaultWorkspaceId)) ??
          context.workspaces[0];
        const compiled = await compileTrainedPersonalPrompt({
          databases,
          userId: user.$id,
          userName: user.name || user.email || "this user",
          context,
          personaRole: json.personaRole,
          jobTitle: json.jobTitle,
          workspaceRole: workspace?.role,
          workspaceId: workspace?.id,
          projectId: json.projectId || harness.settings.defaultProjectId,
          answers,
        });
        return c.json({ data: { ...compiled, answers, personaRole: json.personaRole } });
      } catch (error) {
        console.error("[agent] failed to compile personal prompt", error);
        return c.json({ error: "Failed to compile the personal agent prompt." }, 500);
      }
    },
  )
  .put(
    "/personal",
    sessionMiddleware,
    zValidator(
      "json",
      z.object({
        personaRole: z.enum(["tech_lead", "frontend", "qa", "pm"]),
        jobTitle: z.string().trim().max(160).optional(),
        compiledPrompt: z.string().trim().min(80).max(65000),
        answers: z
          .array(
            z.object({
              questionId: z.string().min(1),
              question: z.string().min(1),
              answer: z.string().max(4000),
            }),
          )
          .min(1)
          .max(24),
      }),
    ),
    async (c) => {
      const user = sessionUser(c);
      const json = c.req.valid("json");
      const { databases } = await createAdminClient();
      try {
        const context = await loadAgentContext(databases, user);
        const harness = await getOrCreateHarness(databases, user.$id);
        const workspace =
          context.workspaces.find((item) => item.id === harness.settings.defaultWorkspaceId) ?? context.workspaces[0];
        const data = await upsertPersonalAgent(databases, user.$id, {
          personaRole: json.personaRole,
          jobTitle: json.jobTitle,
          workspaceRole: workspace?.role,
          status: "trained",
          answers: json.answers,
          compiledPrompt: json.compiledPrompt,
        });
        return c.json({ data });
      } catch (error) {
        console.error("[agent] failed to save personal agent", error);
        return encryptionErrorResponse(error, c) ?? c.json({ error: "Failed to save personal agent." }, 500);
      }
    },
  )
  .post("/personal/start", sessionMiddleware, async (c) => {
    const user = sessionUser(c);
    const { databases } = await createAdminClient();
    try {
      const harness = await upsertHarness(databases, user.$id, {
        settings: { sessionMode: "personal", mode: "agent" },
      });
      const runs = await listRuns(databases, user.$id, 40);
      const active = findActiveTrainingRun(runs);
      if (active) return c.json({ data: active });
      const run = await createRun(databases, {
        userId: user.$id,
        prompt: trainingKickoffPrompt(),
        title: "Train Personal Agent",
        kind: "training",
        mode: "agent",
        workspaceId: harness.settings.defaultWorkspaceId,
        projectId: harness.settings.defaultProjectId,
        messages: [],
      });
      return c.json({ data: run });
    } catch (error) {
      const encrypted = encryptionErrorResponse(error, c);
      if (encrypted) return encrypted;
      console.error("[agent] failed to start personal training chat", error);
      return c.json({ error: "Failed to start the training chat." }, 500);
    }
  })
  .post("/personal/self-train", sessionMiddleware, async (c) => {
    const user = sessionUser(c);
    const { databases } = await createAdminClient();
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const emit = (event: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        };
        try {
          await runPersonalSelfTrain({
            databases,
            user,
            emit,
          });
        } catch (error) {
          const encrypted = error instanceof AgentEncryptionRequiredError;
          emit({
            error: encrypted
              ? error.message
              : error instanceof Error
                ? error.message
                : "Failed to self-train the personal agent.",
            percent: 0,
          });
          console.error("[agent] failed to self-train personal agent", error);
        } finally {
          controller.close();
        }
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
        Connection: "keep-alive",
      },
    });
  })
  .post(
    "/transcribe",
    sessionMiddleware,
    zValidator("form", z.object({ file: z.instanceof(File) })),
    async (c) => {
      const { file } = c.req.valid("form");
      if (!file.size) {
        return c.json({ error: "Didn't catch any audio. Try again." }, 400);
      }
      if (file.size > MAX_TRANSCRIBE_BYTES) {
        return c.json({ error: "Recording is too long. Keep it under about a minute." }, 400);
      }
      const mime = file.type || "audio/webm";
      if (mime && !mime.startsWith("audio/") && mime !== "application/octet-stream" && mime !== "video/webm") {
        return c.json({ error: "Voice input only accepts audio recordings." }, 400);
      }
      try {
        const text = await transcribeAudioBlob(file, file.name || audioFilenameForMime(mime));
        return c.json({ data: { text } });
      } catch (error) {
        if (error instanceof TranscribeConfigError) {
          return c.json({ error: error.message }, 503);
        }
        if (error instanceof TranscribeRequestError) {
          return c.json({ error: error.message }, 502);
        }
        console.error("[agent] transcription failed", error);
        return c.json({ error: "Couldn't transcribe audio." }, 500);
      }
    },
  )
  .post("/personal/reset", sessionMiddleware, async (c) => {
    const user = sessionUser(c);
    const { databases } = await createAdminClient();
    try {
      const runs = await listRuns(databases, user.$id, 200);
      for (const run of runs) {
        if (run.kind !== "training") continue;
        cancelAgentTurn(run.id);
        await deleteRun(databases, user.$id, run.id);
      }
      await resetPersonalAgent(databases, user.$id);
      return c.json({ data: null });
    } catch (error) {
      const encrypted = encryptionErrorResponse(error, c);
      if (encrypted) return encrypted;
      console.error("[agent] failed to reset personal agent", error);
      return c.json({ error: "Failed to reset the personal agent." }, 500);
    }
  });

export default app;

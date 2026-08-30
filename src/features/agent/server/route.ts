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
        return c.json({ data: toPublicMcpConfig(defaults) });
      }

      return c.json({ data: toPublicMcpConfig(parseMcpConfig(existing.configJson)) });
    } catch (error) {
      console.error("[agent] failed to load MCP config", error);
      return c.json({ data: toPublicMcpConfig(defaultMcpConfig()) });
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
      await upsertMcpConfig(databases, user.$id, stored);
      return c.json({ data: toPublicMcpConfig(stored) });
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
  });

export default app;

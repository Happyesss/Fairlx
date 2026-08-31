import { ID, Query, type Databases } from "node-appwrite";

import { AGENT_AI_CONFIGS_ID, AGENT_MCP_CONFIGS_ID, DATABASE_ID } from "@/config";

import type {
  AgentAiConfigStored,
  AgentProviderInput,
  AgentProviderStored,
  McpConfig,
  McpServerConfig,
} from "../types";
import {
  defaultAiStoredConfig,
  defaultMcpConfig,
  mergePlatformAiConfig,
  parseJson,
} from "./defaults";
import { isMaskedSecret } from "./mask";
import { encryptSecret } from "./secrets";

type McpDocument = {
  $id: string;
  userId: string;
  configJson: string;
};

type AiDocument = {
  $id: string;
  userId: string;
  mode: string;
  selectedModelId?: string;
  providersJson: string;
  modelsJson: string;
};

function asRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === "string") result[key] = entry;
  }
  return result;
}

function mergeSecretMap(
  incoming: Record<string, string> | undefined,
  previous: Record<string, string> | undefined
): Record<string, string> | undefined {
  const nextEntries = incoming ?? {};
  const keys = Object.keys(nextEntries);
  if (keys.length === 0 && !previous) return undefined;

  const merged: Record<string, string> = {};
  for (const key of keys) {
    const value = nextEntries[key] ?? "";
    if (isMaskedSecret(value)) {
      if (previous?.[key]) merged[key] = previous[key]!;
      continue;
    }
    merged[key] = encryptSecret(value);
  }
  return Object.keys(merged).length > 0 ? merged : undefined;
}

export function mergeMcpSecrets(incoming: McpConfig, previous: McpConfig): McpConfig {
  const mcpServers: Record<string, McpServerConfig> = {};

  for (const [name, server] of Object.entries(incoming.mcpServers ?? {})) {
    const prevServer = previous.mcpServers?.[name];
    mcpServers[name] = {
      ...server,
      env: mergeSecretMap(asRecord(server.env), asRecord(prevServer?.env)),
      headers: mergeSecretMap(asRecord(server.headers), asRecord(prevServer?.headers)),
    };
  }

  return {
    ...incoming,
    mcpServers,
  };
}

export function mergeProviderSecrets(
  incoming: AgentProviderInput[],
  previous: AgentProviderStored[]
): AgentProviderStored[] {
  const previousById = new Map(previous.map((provider) => [provider.id, provider]));

  return incoming.map((provider) => {
    const prev = previousById.get(provider.id);
    const incomingKey = provider.apiKey;
    const next: AgentProviderStored = {
      id: provider.id,
      provider: provider.provider,
      displayName: provider.displayName,
      baseUrl: provider.baseUrl,
      extra: provider.extra,
      isEnabled: provider.isEnabled ?? true,
      isPlatform: Boolean(provider.isPlatform),
      apiKeyEncrypted: prev?.apiKeyEncrypted,
      apiKeyLast4: prev?.apiKeyLast4,
    };

    if (typeof incomingKey === "string" && !isMaskedSecret(incomingKey)) {
      next.apiKeyEncrypted = encryptSecret(incomingKey);
      next.apiKeyLast4 = incomingKey.slice(-4);
    }

    return next;
  });
}

export async function getMcpDocument(databases: Databases, userId: string) {
  const result = await databases.listDocuments(DATABASE_ID, AGENT_MCP_CONFIGS_ID, [
    Query.equal("userId", userId),
    Query.limit(1),
  ]);
  return (result.documents[0] as unknown as McpDocument | undefined) ?? null;
}

export async function getAiDocument(databases: Databases, userId: string) {
  const result = await databases.listDocuments(DATABASE_ID, AGENT_AI_CONFIGS_ID, [
    Query.equal("userId", userId),
    Query.limit(1),
  ]);
  return (result.documents[0] as unknown as AiDocument | undefined) ?? null;
}

export function parseMcpConfig(raw: string | undefined | null): McpConfig {
  const parsed = parseJson<McpConfig>(raw, defaultMcpConfig());
  if (!parsed.mcpServers || typeof parsed.mcpServers !== "object") {
    return defaultMcpConfig();
  }
  return parsed;
}

export function parseAiConfig(doc: AiDocument | null): AgentAiConfigStored {
  if (!doc) return defaultAiStoredConfig();
  const providers = parseJson<AgentProviderStored[]>(doc.providersJson, []);
  const models = parseJson(doc.modelsJson, defaultAiStoredConfig().models);
  return mergePlatformAiConfig({
    mode: doc.mode === "manual" ? "manual" : "auto",
    selectedModelId: doc.selectedModelId,
    providers: Array.isArray(providers) ? providers : [],
    models: Array.isArray(models) ? models : defaultAiStoredConfig().models,
  });
}

export async function upsertMcpConfig(
  databases: Databases,
  userId: string,
  config: McpConfig
) {
  const existing = await getMcpDocument(databases, userId);
  const payload = { userId, configJson: JSON.stringify(config) };

  if (!existing) {
    return databases.createDocument(DATABASE_ID, AGENT_MCP_CONFIGS_ID, ID.unique(), payload);
  }

  return databases.updateDocument(DATABASE_ID, AGENT_MCP_CONFIGS_ID, existing.$id, payload);
}

export async function upsertAiConfig(
  databases: Databases,
  userId: string,
  config: AgentAiConfigStored
) {
  const existing = await getAiDocument(databases, userId);
  const payload = {
    userId,
    mode: config.mode,
    selectedModelId: config.selectedModelId ?? "",
    providersJson: JSON.stringify(config.providers),
    modelsJson: JSON.stringify(config.models),
  };

  if (!existing) {
    return databases.createDocument(DATABASE_ID, AGENT_AI_CONFIGS_ID, ID.unique(), payload);
  }

  return databases.updateDocument(DATABASE_ID, AGENT_AI_CONFIGS_ID, existing.$id, payload);
}

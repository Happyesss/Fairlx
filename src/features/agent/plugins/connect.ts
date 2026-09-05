import type { AgentPluginConnection } from "../types";
import { encryptSecret } from "../lib/secrets";
import { catalogById } from "./catalog";

export type PluginConnectInput = {
  catalogId: string;
  displayName?: string;
  fields?: Record<string, string>;
};

export function buildPluginConnection(input: PluginConnectInput): AgentPluginConnection {
  const catalog = catalogById(input.catalogId);
  if (!catalog) throw new Error("Unknown plugin.");
  const fields = input.fields ?? {};
  const secrets: AgentPluginConnection["secrets"] = {
    from: fields.from || undefined,
    mcpUrl: fields.url || undefined,
    mcpTool: fields.tool || undefined,
    extra: {},
  };
  if (fields.endpoint) secrets.extra = { ...secrets.extra, endpoint: fields.endpoint };
  if (fields.owner) secrets.extra = { ...secrets.extra, owner: fields.owner };
  if (fields.repo) secrets.extra = { ...secrets.extra, repo: fields.repo };
  if (fields.clientId) secrets.extra = { ...secrets.extra, clientId: fields.clientId };
  if (fields.accessToken) secrets.accessTokenEncrypted = encryptSecret(fields.accessToken);
  if (fields.token) secrets.accessTokenEncrypted = encryptSecret(fields.token);
  if (fields.apiKey) secrets.apiKeyEncrypted = encryptSecret(fields.apiKey);
  if (fields.headerAuthorization) secrets.mcpHeadersEncrypted = encryptSecret(fields.headerAuthorization);
  if (fields.clientSecret) secrets.clientSecretEncrypted = encryptSecret(fields.clientSecret);
  if (fields.refreshToken) secrets.refreshTokenEncrypted = encryptSecret(fields.refreshToken);

  const hasCreds = Boolean(
    secrets.refreshTokenEncrypted ||
      secrets.accessTokenEncrypted ||
      secrets.apiKeyEncrypted ||
      secrets.mcpUrl ||
      catalog.auth === "platform",
  );

  return {
    id: crypto.randomUUID(),
    catalogId: catalog.id,
    displayName: input.displayName?.trim() || catalog.name,
    capabilities: catalog.capabilities,
    status: hasCreds ? "connected" : "disconnected",
    authKind: catalog.auth,
    secrets,
    createdAt: new Date().toISOString(),
  };
}

export function upsertPluginList(
  existing: AgentPluginConnection[],
  next: AgentPluginConnection,
): AgentPluginConnection[] {
  const without = existing.filter((plugin) => plugin.catalogId !== next.catalogId);
  return [...without, next];
}

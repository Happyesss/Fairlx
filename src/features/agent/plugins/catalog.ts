import type {
  AgentCapability,
  AgentContext,
  AgentPluginConnection,
  AgentPluginPublic,
  AgentToolEvent,
} from "../types";

export type PluginCatalogAuth = "platform" | "oauth" | "token" | "mcp";

export type PluginCatalogItem = {
  id: string;
  name: string;
  description: string;
  capabilities: AgentCapability[];
  auth: PluginCatalogAuth;
  fields: Array<{
    key: string;
    label: string;
    secret?: boolean;
    placeholder?: string;
  }>;
};

export const PLUGIN_CATALOG: PluginCatalogItem[] = [
  {
    id: "fairlx",
    name: "Fairlx",
    description: "Work items, members, invites, and workflows in this workspace.",
    capabilities: ["members.invite"],
    auth: "platform",
    fields: [],
  },
  {
    id: "github",
    name: "GitHub",
    description: "Read files, commit on a branch, and open pull requests on linked repos.",
    capabilities: ["code.read", "code.write", "security.review"],
    auth: "platform",
    fields: [
      { key: "token", label: "Personal access token with repo scope", secret: true },
      { key: "owner", label: "Owner (if no repo is linked)", placeholder: "acme" },
      { key: "repo", label: "Repository name (if no repo is linked)", placeholder: "app" },
    ],
  },
  {
    id: "outlook",
    name: "Outlook / Microsoft 365",
    description: "Send mail with Microsoft Graph using a delegated access token.",
    capabilities: ["email.send"],
    auth: "token",
    fields: [
      { key: "accessToken", label: "Graph access token", secret: true },
      { key: "from", label: "From address", placeholder: "you@company.com" },
    ],
  },
  {
    id: "gmail",
    name: "Gmail",
    description: "Send mail with the Gmail API.",
    capabilities: ["email.send"],
    auth: "token",
    fields: [
      { key: "accessToken", label: "Gmail OAuth access token", secret: true },
      { key: "from", label: "From address", placeholder: "you@gmail.com" },
    ],
  },
  {
    id: "resend",
    name: "Resend / HTTP mail",
    description: "Send mail via Resend or a compatible JSON HTTP endpoint.",
    capabilities: ["email.send"],
    auth: "token",
    fields: [
      { key: "apiKey", label: "API key", secret: true },
      { key: "from", label: "From address", placeholder: "agent@yourdomain.com" },
      { key: "endpoint", label: "Endpoint (optional)", placeholder: "https://api.resend.com/emails" },
    ],
  },
  {
    id: "mail-mcp",
    name: "Mail MCP",
    description: "Remote HTTP MCP server that exposes a send-mail tool (Outlook MCP, etc.).",
    capabilities: ["email.send"],
    auth: "mcp",
    fields: [
      { key: "url", label: "MCP URL" },
      { key: "headerAuthorization", label: "Authorization header (optional)", secret: true },
      { key: "tool", label: "Tool name", placeholder: "send_email" },
    ],
  },
  {
    id: "slack",
    name: "Slack / Discord",
    description: "Notify a connected project channel.",
    capabilities: ["chat.notify"],
    auth: "platform",
    fields: [],
  },
  {
    id: "security",
    name: "Security review",
    description: "Isolated source review. Never exploits production. Shannon can plug in later behind the same interface.",
    capabilities: ["security.review"],
    auth: "platform",
    fields: [],
  },
];

export function catalogById(id: string): PluginCatalogItem | undefined {
  return PLUGIN_CATALOG.find((item) => item.id === id);
}

export function inferCapabilities(query: string): AgentCapability[] {
  const caps = new Set<AgentCapability>();
  if (/\b(mail|email|outlook|gmail|inbox|smtp)\b/i.test(query)) caps.add("email.send");
  if (/\b(invite|add .*member|join link|share link)\b/i.test(query)) caps.add("members.invite");
  if (/\b(slack|discord|notify channel)\b/i.test(query)) caps.add("chat.notify");
  if (/\b(security|vulnerab|xss|ssrf|pentest|shannon|cve)\b/i.test(query)) caps.add("security.review");
  if (/\b(pr\b|pull request|commit|edit the code|open a pr|patch the repo)\b/i.test(query)) {
    caps.add("code.read");
    caps.add("code.write");
  } else if (/\b(repo|repository|read the (code|file)|github file)\b/i.test(query)) {
    caps.add("code.read");
  }
  return Array.from(caps);
}

export function pluginHasCapability(plugin: AgentPluginConnection, capability: AgentCapability): boolean {
  return plugin.status === "connected" && plugin.capabilities.includes(capability);
}

export function hasCapability(
  plugins: AgentPluginConnection[],
  context: AgentContext,
  capability: AgentCapability,
): boolean {
  if (capability === "members.invite") return true;
  if (capability === "chat.notify") {
    return context.integrations.some((item) => /slack|discord/i.test(item.provider ?? ""));
  }
  if (capability === "code.read" || capability === "code.write") {
    if (context.githubRepos.length > 0) return true;
  }
  if (capability === "security.review") {
    if (context.githubRepos.length > 0) return true;
  }
  return plugins.some((plugin) => pluginHasCapability(plugin, capability));
}

export function missingCapabilities(
  query: string,
  plugins: AgentPluginConnection[],
  context: AgentContext,
): AgentCapability[] {
  return inferCapabilities(query).filter((cap) => !hasCapability(plugins, context, cap));
}

export function catalogForCapability(capability: AgentCapability): PluginCatalogItem[] {
  return PLUGIN_CATALOG.filter(
    (item) =>
      item.capabilities.includes(capability) &&
      (item.auth !== "platform" || item.fields.length > 0),
  );
}

export function toPublicPlugin(plugin: AgentPluginConnection): AgentPluginPublic {
  return {
    id: plugin.id,
    catalogId: plugin.catalogId,
    displayName: plugin.displayName,
    capabilities: plugin.capabilities,
    status: plugin.status,
    authKind: plugin.authKind,
    hasSecret: Boolean(
      plugin.secrets?.accessTokenEncrypted ||
        plugin.secrets?.apiKeyEncrypted ||
        plugin.secrets?.mcpHeadersEncrypted,
    ),
    from: plugin.secrets?.from,
    mcpUrl: plugin.secrets?.mcpUrl,
    createdAt: plugin.createdAt,
  };
}

export type AgentPendingPlugin = {
  capability: AgentCapability;
  catalogIds: string[];
  summary: string;
};

export function pendingPluginFromEvent(event: AgentToolEvent | undefined): AgentPendingPlugin | undefined {
  if (!event || event.type !== "plugin_required") return undefined;
  const payload = event.payload;
  if (!payload || typeof payload !== "object") return undefined;
  const data = payload as Partial<AgentPendingPlugin>;
  if (!data.capability || !Array.isArray(data.catalogIds)) return undefined;
  return {
    capability: data.capability,
    catalogIds: data.catalogIds,
    summary: data.summary || `Connect a plugin for ${data.capability}.`,
  };
}

export function findPendingPlugin(events: AgentToolEvent[]): AgentPendingPlugin | undefined {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i]!;
    if (event.type === "plugin_required") return pendingPluginFromEvent(event);
    if (event.type === "plugin_connected") return undefined;
  }
  return undefined;
}

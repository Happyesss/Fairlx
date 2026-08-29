import { Models } from "node-appwrite";

export type IntegrationProvider =
  | "slack"
  | "discord"
  | "mcp_custom"
  | "gitlab"
  | "bitbucket";

export type ProjectIntegration = Models.Document & {
  projectId: string;
  workspaceId: string;
  provider: IntegrationProvider;
  enabled: boolean;
  /** Encrypted bot/user token when applicable */
  accessToken?: string | null;
  refreshToken?: string | null;
  /** Slack team id / Discord guild id */
  externalTeamId?: string | null;
  /** Default channel id */
  channelId?: string | null;
  channelName?: string | null;
  /** Discord incoming webhook URL (or Slack webhook fallback) */
  webhookUrl?: string | null;
  /** JSON blob for provider-specific settings (custom MCP URLs, etc.) */
  configJson?: string | null;
  createdBy?: string | null;
};

export type McpApiToken = Models.Document & {
  /** When set, token is project-scoped. When absent, token is workspace-scoped. */
  projectId?: string | null;
  workspaceId: string;
  name: string;
  /** Hashed token (sha256 hex) — plaintext shown once on create */
  tokenHash: string;
  tokenPrefix: string;
  createdBy: string;
  lastUsedAt?: string | null;
  organizationId?: string | null;
  scopes?: string[] | null;
  expiresAt?: string | null;
  isRevoked?: boolean | null;
};

export type CustomMcpServerConfig = {
  name: string;
  url: string;
  headers?: Record<string, string>;
};

export type AgentVcsInfo = {
  provider: "github" | "gitlab" | "bitbucket";
  owner: string;
  repo: string;
  defaultBranch: string;
  cloneUrl: string;
};

export type AgentContextPack = {
  workItemId: string;
  workItemKey: string;
  title: string;
  description?: string | null;
  projectId: string;
  workspaceId: string;
  suggestedBranch: string;
  /** Primary VCS (GitHub → GitLab → Bitbucket). */
  vcs?: AgentVcsInfo | null;
  /** @deprecated Prefer `vcs`; kept when provider is github for older clients. */
  github?: AgentVcsInfo | null;
  mcp: {
    fairlxUrl: string;
    instructions: string;
  };
  customMcps: CustomMcpServerConfig[];
  prompts: {
    claude: string;
    codex: string;
  };
};

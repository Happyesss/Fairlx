import { z } from "zod";

export const upsertIntegrationSchema = z.object({
  projectId: z.string().min(1),
  workspaceId: z.string().min(1),
  provider: z.enum(["slack", "discord", "mcp_custom", "gitlab", "bitbucket"]),
  enabled: z.boolean().optional(),
  channelId: z.string().optional().nullable(),
  channelName: z.string().optional().nullable(),
  webhookUrl: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
  accessToken: z.string().optional().nullable(),
  externalTeamId: z.string().optional().nullable(),
  configJson: z.string().optional().nullable(),
});

export const createMcpTokenSchema = z.object({
  projectId: z.string().min(1).optional(),
  workspaceId: z.string().min(1),
  name: z.string().min(1).max(100),
  organizationId: z.string().min(1).optional(),
  scopes: z.array(z.string().min(1)).max(32).optional(),
  expiresAt: z.string().datetime().optional(),
});

export const agentContextSchema = z.object({
  workItemId: z.string().min(1),
  projectId: z.string().min(1),
});

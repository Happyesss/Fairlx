import { Hono } from "hono";
import { ID, Query } from "node-appwrite";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

import { sessionMiddleware } from "@/lib/session-middleware";
import { createAdminClient } from "@/lib/appwrite";
import {
  DATABASE_ID,
  PROJECT_INTEGRATIONS_ID,
  MCP_API_TOKENS_ID,
  PROJECTS_ID,
  WORK_ITEMS_ID,
  GITHUB_REPOS_ID,
} from "@/config";
import { encryptToken } from "@/features/github-integration/lib/encryption";
import { requireProjectAuth } from "@/lib/middleware/project-auth";
import { ProjectPermissionKey } from "@/lib/permissions/types";
import {
  agentContextSchema,
  createMcpTokenSchema,
  upsertIntegrationSchema,
} from "../schemas";
import { ProjectIntegration, McpApiToken } from "../types";
import {
  decryptIntegrationToken,
  generateMcpToken,
  getAppBaseUrl,
  getProjectIntegration,
  listProjectIntegrations,
  parseCustomMcps,
  resolveProjectVcs,
  suggestedBranchName,
} from "../lib/helpers";

const app = new Hono()
  /**
   * GET /api/integrations?projectId=
   */
  .get(
    "/",
    sessionMiddleware,
    zValidator("query", z.object({ projectId: z.string() })),
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");
      const { projectId } = c.req.valid("query");

      const auth = await requireProjectAuth(
        databases,
        user.$id,
        projectId,
        ProjectPermissionKey.VIEW_PROJECT
      );
      if (!auth.success) return c.json({ error: auth.error }, auth.code);

      const docs = await listProjectIntegrations(databases, projectId);
      const safe = docs.map((d) => ({
        ...d,
        accessToken: d.accessToken ? "[redacted]" : null,
        refreshToken: d.refreshToken ? "[redacted]" : null,
        hasAccessToken: !!d.accessToken,
      }));

      return c.json({ data: safe });
    }
  )

  /**
   * POST /api/integrations — upsert Slack/Discord/MCP custom config
   */
  .post("/", sessionMiddleware, zValidator("json", upsertIntegrationSchema), async (c) => {
    const { databases: adminDb } = await createAdminClient();
    const user = c.get("user");
    const data = c.req.valid("json");

    const auth = await requireProjectAuth(
      adminDb,
      user.$id,
      data.projectId,
      ProjectPermissionKey.EDIT_SETTINGS
    );
    if (!auth.success) return c.json({ error: auth.error }, auth.code);

    const existing = await getProjectIntegration(adminDb, data.projectId, data.provider);

    let encryptedToken: string | null | undefined = undefined;
    if (data.accessToken) {
      try {
        encryptedToken = encryptToken(data.accessToken);
      } catch {
        encryptedToken = data.accessToken;
      }
    }

    const payload: Record<string, unknown> = {
      projectId: data.projectId,
      workspaceId: data.workspaceId,
      provider: data.provider,
      enabled: data.enabled ?? true,
      channelId: data.channelId || null,
      channelName: data.channelName || null,
      webhookUrl: data.webhookUrl || null,
      externalTeamId: data.externalTeamId || null,
      configJson: data.configJson || null,
      createdBy: user.$id,
    };
    if (encryptedToken !== undefined) {
      payload.accessToken = encryptedToken;
    }

    if (existing) {
      const updated = await adminDb.updateDocument<ProjectIntegration>(
        DATABASE_ID,
        PROJECT_INTEGRATIONS_ID,
        existing.$id,
        payload
      );
      return c.json({ data: { ...updated, accessToken: updated.accessToken ? "[redacted]" : null } });
    }

    const created = await adminDb.createDocument<ProjectIntegration>(
      DATABASE_ID,
      PROJECT_INTEGRATIONS_ID,
      ID.unique(),
      payload
    );
    return c.json({ data: { ...created, accessToken: created.accessToken ? "[redacted]" : null } }, 201);
  })

  /**
   * DELETE /api/integrations/:id
   */
  .delete("/:id", sessionMiddleware, async (c) => {
    const { databases: adminDb } = await createAdminClient();
    const user = c.get("user");
    const id = c.req.param("id");

    const doc = await adminDb.getDocument<ProjectIntegration>(
      DATABASE_ID,
      PROJECT_INTEGRATIONS_ID,
      id
    );

    const auth = await requireProjectAuth(
      adminDb,
      user.$id,
      doc.projectId,
      ProjectPermissionKey.EDIT_SETTINGS
    );
    if (!auth.success) return c.json({ error: auth.error }, auth.code);

    await adminDb.deleteDocument(DATABASE_ID, PROJECT_INTEGRATIONS_ID, id);
    return c.json({ success: true });
  })

  /**
   * GET /api/integrations/slack/oauth/start?projectId=&workspaceId=
   */
  .get(
    "/slack/oauth/start",
    sessionMiddleware,
    zValidator(
      "query",
      z.object({ projectId: z.string(), workspaceId: z.string() })
    ),
    async (c) => {
      const clientId = process.env.SLACK_CLIENT_ID;
      if (!clientId) {
        return c.json({ error: "SLACK_CLIENT_ID is not configured" }, 500);
      }

      const { projectId, workspaceId } = c.req.valid("query");
      const user = c.get("user");
      const databases = c.get("databases");

      const auth = await requireProjectAuth(
        databases,
        user.$id,
        projectId,
        ProjectPermissionKey.EDIT_SETTINGS
      );
      if (!auth.success) return c.json({ error: auth.error }, auth.code);

      const redirectUri = `${getAppBaseUrl()}/api/integrations/slack/oauth/callback`;
      const state = Buffer.from(
        JSON.stringify({ projectId, workspaceId, userId: user.$id })
      ).toString("base64url");

      const scopes = [
        "chat:write",
        "channels:read",
        "commands",
        "links:read",
        "links:write",
        "incoming-webhook",
      ].join(",");

      const url = new URL("https://slack.com/oauth/v2/authorize");
      url.searchParams.set("client_id", clientId);
      url.searchParams.set("scope", scopes);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("state", state);

      return c.json({ data: { url: url.toString() } });
    }
  )

  /**
   * GET /api/integrations/slack/oauth/callback
   */
  .get("/slack/oauth/callback", async (c) => {
    const code = c.req.query("code");
    const stateRaw = c.req.query("state");
    const error = c.req.query("error");

    if (error || !code || !stateRaw) {
      return c.redirect(`/welcome?slack=error`);
    }

    let state: { projectId: string; workspaceId: string; userId: string };
    try {
      state = JSON.parse(Buffer.from(stateRaw, "base64url").toString("utf8"));
    } catch {
      return c.redirect(`/welcome?slack=error`);
    }

    const clientId = process.env.SLACK_CLIENT_ID;
    const clientSecret = process.env.SLACK_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return c.redirect(
        `/workspaces/${state.workspaceId}/projects/${state.projectId}/settings?tab=integrations&slack=missing_env`
      );
    }

    const redirectUri = `${getAppBaseUrl()}/api/integrations/slack/oauth/callback`;
    const tokenRes = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });
    const tokenJson = (await tokenRes.json()) as {
      ok: boolean;
      error?: string;
      access_token?: string;
      team?: { id: string; name: string };
      incoming_webhook?: { channel: string; channel_id: string; url: string };
    };

    if (!tokenJson.ok || !tokenJson.access_token) {
      console.error("[Slack OAuth] failed:", tokenJson.error);
      return c.redirect(
        `/workspaces/${state.workspaceId}/projects/${state.projectId}/settings?tab=integrations&slack=error`
      );
    }

    const { databases: adminDb } = await createAdminClient();
    const existing = await getProjectIntegration(adminDb, state.projectId, "slack");

    let encrypted: string;
    try {
      encrypted = encryptToken(tokenJson.access_token);
    } catch {
      encrypted = tokenJson.access_token;
    }

    const payload = {
      projectId: state.projectId,
      workspaceId: state.workspaceId,
      provider: "slack" as const,
      enabled: true,
      accessToken: encrypted,
      externalTeamId: tokenJson.team?.id || null,
      channelId: tokenJson.incoming_webhook?.channel_id || null,
      channelName: tokenJson.incoming_webhook?.channel || null,
      webhookUrl: tokenJson.incoming_webhook?.url || null,
      createdBy: state.userId,
    };

    if (existing) {
      await adminDb.updateDocument(DATABASE_ID, PROJECT_INTEGRATIONS_ID, existing.$id, payload);
    } else {
      await adminDb.createDocument(DATABASE_ID, PROJECT_INTEGRATIONS_ID, ID.unique(), payload);
    }

    return c.redirect(
      `/workspaces/${state.workspaceId}/projects/${state.projectId}/settings?tab=integrations&slack=connected`
    );
  })

  /**
   * POST /api/integrations/slack/events — slash commands + link unfurl
   */
  .post("/slack/events", async (c) => {
    const contentType = c.req.header("content-type") || "";
    const { databases: adminDb } = await createAdminClient();

    // URL verification (JSON)
    if (contentType.includes("application/json")) {
      const body = await c.req.json<{
        type?: string;
        challenge?: string;
        event?: {
          type: string;
          links?: Array<{ url: string }>;
          channel: string;
          message_ts: string;
        };
        team_id?: string;
      }>();

      if (body.type === "url_verification" && body.challenge) {
        return c.json({ challenge: body.challenge });
      }

      // Link unfurl
      if (body.event?.type === "link_shared" && body.event.links?.length) {
        const link = body.event.links[0].url;
        const match = link.match(/\/workspaces\/([^/]+)\/tasks\/([^/?#]+)/);
        if (match) {
          const [, , taskId] = match;
          try {
            const item = await adminDb.getDocument(DATABASE_ID, WORK_ITEMS_ID, taskId);
            // Find slack integration for this project to get token
            const integrations = await adminDb.listDocuments<ProjectIntegration>(
              DATABASE_ID,
              PROJECT_INTEGRATIONS_ID,
              [
                Query.equal("projectId", item.projectId as string),
                Query.equal("provider", "slack"),
                Query.limit(1),
              ]
            );
            const slack = integrations.documents[0];
            const token = decryptIntegrationToken(slack?.accessToken);
            if (token) {
              await fetch("https://slack.com/api/chat.unfurl", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  channel: body.event.channel,
                  ts: body.event.message_ts,
                  unfurls: {
                    [link]: {
                      title: `${item.key}: ${item.title}`,
                      text: (item.description as string) || "Fairlx work item",
                      color: "#4F46E5",
                    },
                  },
                }),
              });
            }
          } catch (err) {
            console.warn("[Slack] unfurl failed:", err);
          }
        }
      }

      return c.json({ ok: true });
    }

    // Slash command (form-urlencoded)
    const form = await c.req.parseBody();
    const command = String(form.command || "");
    const text = String(form.text || "").trim();
    const teamId = String(form.team_id || "");
    const channelId = String(form.channel_id || "");

    if (command === "/fairlx" && text.toLowerCase().startsWith("create ")) {
      const title = text.slice(7).trim();
      if (!title) {
        return c.json({
          response_type: "ephemeral",
          text: "Usage: `/fairlx create <title>`",
        });
      }

      // Resolve project from Slack team mapping
      const integrations = await adminDb.listDocuments<ProjectIntegration>(
        DATABASE_ID,
        PROJECT_INTEGRATIONS_ID,
        [
          Query.equal("provider", "slack"),
          Query.equal("externalTeamId", teamId),
          Query.limit(1),
        ]
      );
      const slack = integrations.documents[0];
      if (!slack) {
        return c.json({
          response_type: "ephemeral",
          text: "No Fairlx project is linked to this Slack workspace.",
        });
      }

      const project = await adminDb.getDocument(DATABASE_ID, PROJECTS_ID, slack.projectId);
      const keyBase = ((project.name as string) || "ITEM")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 4) || "ITEM";

      const existing = await adminDb.listDocuments(DATABASE_ID, WORK_ITEMS_ID, [
        Query.equal("projectId", slack.projectId),
        Query.limit(1),
        Query.orderDesc("$createdAt"),
      ]);
      const nextNum = (existing.total || 0) + 1;

      const workItem = await adminDb.createDocument(DATABASE_ID, WORK_ITEMS_ID, ID.unique(), {
        workspaceId: slack.workspaceId,
        projectId: slack.projectId,
        title,
        key: `${keyBase}-${nextNum}`,
        type: "TASK",
        status: "TODO",
        priority: "MEDIUM",
        assigneeIds: [],
        reporterId: slack.createdBy || "slack",
      });

      return c.json({
        response_type: "in_channel",
        text: `Created *${workItem.key}*: ${title}${channelId ? ` (from <#${channelId}>)` : ""}`,
      });
    }

    return c.json({
      response_type: "ephemeral",
      text: "Fairlx Slack commands: `/fairlx create <title>`",
    });
  })

  /**
   * POST /api/integrations/discord/interactions — Discord slash (application commands)
   * Also supports simple webhook-style connect via POST body for channel webhook.
   */
  .post("/discord/interactions", async (c) => {
    const body = await c.req.json<{
      type?: number;
      data?: { name?: string; options?: Array<{ name: string; value: string }> };
      guild_id?: string;
      channel_id?: string;
      token?: string;
    }>();

    // Discord PING
    if (body.type === 1) {
      return c.json({ type: 1 });
    }

    // APPLICATION_COMMAND
    if (body.type === 2 && body.data?.name === "fairlx") {
      const { databases: adminDb } = await createAdminClient();
      const sub = body.data.options?.[0];
      if (sub?.name === "create" && sub.value) {
        const integrations = await adminDb.listDocuments<ProjectIntegration>(
          DATABASE_ID,
          PROJECT_INTEGRATIONS_ID,
          [
            Query.equal("provider", "discord"),
            Query.equal("externalTeamId", body.guild_id || ""),
            Query.limit(1),
          ]
        );
        let discord = integrations.documents[0];
        if (!discord && body.channel_id) {
          const byChannel = await adminDb.listDocuments<ProjectIntegration>(
            DATABASE_ID,
            PROJECT_INTEGRATIONS_ID,
            [
              Query.equal("provider", "discord"),
              Query.equal("channelId", body.channel_id),
              Query.limit(1),
            ]
          );
          discord = byChannel.documents[0];
        }

        if (!discord) {
          return c.json({
            type: 4,
            data: { content: "No Fairlx project linked to this Discord server.", flags: 64 },
          });
        }

        const title = String(sub.value);
        const project = await adminDb.getDocument(DATABASE_ID, PROJECTS_ID, discord.projectId);
        const keyBase = ((project.name as string) || "ITEM")
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "")
          .slice(0, 4) || "ITEM";
        const count = await adminDb.listDocuments(DATABASE_ID, WORK_ITEMS_ID, [
          Query.equal("projectId", discord.projectId),
          Query.limit(1),
        ]);
        const workItem = await adminDb.createDocument(DATABASE_ID, WORK_ITEMS_ID, ID.unique(), {
          workspaceId: discord.workspaceId,
          projectId: discord.projectId,
          title,
          key: `${keyBase}-${(count.total || 0) + 1}`,
          type: "TASK",
          status: "TODO",
          priority: "MEDIUM",
          assigneeIds: [],
          reporterId: discord.createdBy || "discord",
        });

        return c.json({
          type: 4,
          data: { content: `Created **${workItem.key}**: ${title}` },
        });
      }
    }

    return c.json({ type: 4, data: { content: "Unknown command", flags: 64 } });
  })

  /**
   * MCP API tokens
   */
  .get(
    "/mcp/tokens",
    sessionMiddleware,
    zValidator("query", z.object({ projectId: z.string() })),
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");
      const { projectId } = c.req.valid("query");

      const auth = await requireProjectAuth(
        databases,
        user.$id,
        projectId,
        ProjectPermissionKey.EDIT_SETTINGS
      );
      if (!auth.success) return c.json({ error: auth.error }, auth.code);

      const { databases: adminDb } = await createAdminClient();
      try {
        const tokens = await adminDb.listDocuments<McpApiToken>(
          DATABASE_ID,
          MCP_API_TOKENS_ID,
          [Query.equal("projectId", projectId), Query.limit(50)]
        );
        return c.json({
          data: tokens.documents.map((t) => ({
            $id: t.$id,
            name: t.name,
            tokenPrefix: t.tokenPrefix,
            createdBy: t.createdBy,
            lastUsedAt: t.lastUsedAt,
            $createdAt: t.$createdAt,
          })),
        });
      } catch {
        return c.json({ data: [] });
      }
    }
  )

  .post("/mcp/tokens", sessionMiddleware, zValidator("json", createMcpTokenSchema), async (c) => {
    const { databases: adminDb } = await createAdminClient();
    const user = c.get("user");
    const data = c.req.valid("json");

    const auth = await requireProjectAuth(
      adminDb,
      user.$id,
      data.projectId,
      ProjectPermissionKey.EDIT_SETTINGS
    );
    if (!auth.success) return c.json({ error: auth.error }, auth.code);

    const generated = generateMcpToken();
    const doc = await adminDb.createDocument<McpApiToken>(
      DATABASE_ID,
      MCP_API_TOKENS_ID,
      ID.unique(),
      {
        projectId: data.projectId,
        workspaceId: data.workspaceId,
        name: data.name,
        tokenHash: generated.hash,
        tokenPrefix: generated.prefix,
        createdBy: user.$id,
      }
    );

    return c.json(
      {
        data: {
          $id: doc.$id,
          name: doc.name,
          tokenPrefix: doc.tokenPrefix,
          /** Shown once */
          token: generated.plaintext,
        },
      },
      201
    );
  })

  .delete("/mcp/tokens/:id", sessionMiddleware, async (c) => {
    const { databases: adminDb } = await createAdminClient();
    const user = c.get("user");
    const id = c.req.param("id");

    const doc = await adminDb.getDocument<McpApiToken>(DATABASE_ID, MCP_API_TOKENS_ID, id);
    const auth = await requireProjectAuth(
      adminDb,
      user.$id,
      doc.projectId,
      ProjectPermissionKey.EDIT_SETTINGS
    );
    if (!auth.success) return c.json({ error: auth.error }, auth.code);

    await adminDb.deleteDocument(DATABASE_ID, MCP_API_TOKENS_ID, id);
    return c.json({ success: true });
  })

  /**
   * Agent context pack for Claude / Codex
   */
  .get(
    "/agent-context",
    sessionMiddleware,
    zValidator("query", agentContextSchema),
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");
      const { workItemId, projectId } = c.req.valid("query");

      const auth = await requireProjectAuth(
        databases,
        user.$id,
        projectId,
        ProjectPermissionKey.VIEW_TASKS
      );
      if (!auth.success) return c.json({ error: auth.error }, auth.code);

      const { databases: adminDb } = await createAdminClient();
      const workItem = await adminDb.getDocument(DATABASE_ID, WORK_ITEMS_ID, workItemId);
      if (workItem.projectId !== projectId) {
        return c.json({ error: "Work item not in project" }, 400);
      }

      const repos = await adminDb.listDocuments(DATABASE_ID, GITHUB_REPOS_ID, [
        Query.equal("projectId", projectId),
        Query.limit(1),
      ]);
      const repo = repos.documents[0];

      const mcpCustom = await getProjectIntegration(adminDb, projectId, "mcp_custom");
      const customMcps = parseCustomMcps(mcpCustom);

      const base = getAppBaseUrl();
      const mcpUrl = `${base}/api/integrations/mcp/rpc`;
      const branch = suggestedBranchName(
        String(workItem.key || workItemId.slice(0, 8)),
        String(workItem.title || workItem.name || "work-item")
      );

      const vcs = await resolveProjectVcs(
        adminDb,
        projectId,
        repo
          ? {
              owner: String(repo.owner),
              repositoryName: String(repo.repositoryName || repo.name || ""),
              branch: repo.branch ? String(repo.branch) : undefined,
            }
          : null
      );
      const github = vcs?.provider === "github" ? vcs : null;

      const providerLabel =
        vcs?.provider === "gitlab"
          ? "GitLab"
          : vcs?.provider === "bitbucket"
            ? "Bitbucket"
            : "GitHub";

      const claudePrompt = [
        `Work on Fairlx work item ${workItem.key}: ${workItem.title || workItem.name}`,
        workItem.description ? `Description:\n${workItem.description}` : "",
        vcs
          ? `Clone ${vcs.cloneUrl} (${providerLabel}), create branch \`${branch}\` from ${vcs.defaultBranch}, implement the change, commit, and push.`
          : "Connect GitHub, GitLab, or Bitbucket in project Integrations before pushing code.",
        `Use Fairlx MCP at ${mcpUrl} (Authorization: Bearer <mcp-token>) to update status and add comments.`,
        `Suggested branch name: ${branch}`,
      ]
        .filter(Boolean)
        .join("\n\n");

      const codexPrompt = claudePrompt.replace("Fairlx MCP", "Fairlx MCP tools");

      return c.json({
        data: {
          workItemId,
          workItemKey: workItem.key,
          title: workItem.title || workItem.name,
          description: workItem.description,
          projectId,
          workspaceId: workItem.workspaceId,
          suggestedBranch: branch,
          vcs,
          github,
          mcp: {
            fairlxUrl: mcpUrl,
            instructions:
              "Add this MCP server in Claude Code / Codex with a project MCP API token from Integrations.",
          },
          customMcps,
          prompts: { claude: claudePrompt, codex: codexPrompt },
        },
      });
    }
  );

export default app;

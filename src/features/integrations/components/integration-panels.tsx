"use client";

import { useMemo, useState } from "react";
import { Loader2, Copy, Check, Trash2, Bot } from "lucide-react";
import { FaSlack, FaDiscord, FaGitlab, FaBitbucket } from "react-icons/fa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import {
  useCreateMcpToken,
  useDeleteIntegration,
  useDeleteMcpToken,
  useMcpTokens,
  useProjectIntegrations,
  useSlackOAuthStart,
  useUpsertIntegration,
} from "../api/use-integrations";
import { parseVcsConfig, serializeVcsConfig } from "../lib/vcs-config";

interface IntegrationPanelsProps {
  projectId: string;
  isAdmin: boolean;
  provider: "slack" | "discord" | "mcp" | "gitlab" | "bitbucket";
  onBack: () => void;
}

export function IntegrationPanels({
  projectId,
  isAdmin,
  provider,
  onBack,
}: IntegrationPanelsProps) {
  const workspaceId = useWorkspaceId();
  const { data, isLoading } = useProjectIntegrations(projectId);
  const upsert = useUpsertIntegration();
  const remove = useDeleteIntegration();
  const slackOAuth = useSlackOAuthStart();
  const { data: tokensData } = useMcpTokens(projectId);
  const createToken = useCreateMcpToken();
  const deleteToken = useDeleteMcpToken();

  const rawIntegrations = data?.data;
  const integrations = useMemo(
    () => rawIntegrations || [],
    [rawIntegrations]
  );
  const slack = useMemo(
    () => integrations.find((i) => i.provider === "slack"),
    [integrations]
  );
  const discord = useMemo(
    () => integrations.find((i) => i.provider === "discord"),
    [integrations]
  );
  const mcpCustom = useMemo(
    () => integrations.find((i) => i.provider === "mcp_custom"),
    [integrations]
  );
  const gitlab = useMemo(
    () => integrations.find((i) => i.provider === "gitlab"),
    [integrations]
  );
  const bitbucket = useMemo(
    () => integrations.find((i) => i.provider === "bitbucket"),
    [integrations]
  );

  const gitlabCfg = useMemo(
    () => parseVcsConfig("gitlab", (gitlab?.configJson as string) || null),
    [gitlab]
  );
  const bitbucketCfg = useMemo(
    () => parseVcsConfig("bitbucket", (bitbucket?.configJson as string) || null),
    [bitbucket]
  );

  const [discordWebhook, setDiscordWebhook] = useState("");
  const [discordGuildId, setDiscordGuildId] = useState("");
  const [discordChannelId, setDiscordChannelId] = useState("");
  const [mcpConfig, setMcpConfig] = useState(
    () =>
      (mcpCustom?.configJson as string) ||
      JSON.stringify(
        { servers: [{ name: "example", url: "https://mcp.example.com" }] },
        null,
        2
      )
  );
  const [tokenName, setTokenName] = useState("Claude Code");
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [glBaseUrl, setGlBaseUrl] = useState("");
  const [glOwner, setGlOwner] = useState("");
  const [glRepo, setGlRepo] = useState("");
  const [glBranch, setGlBranch] = useState("main");
  const [glToken, setGlToken] = useState("");

  const [bbOwner, setBbOwner] = useState("");
  const [bbRepo, setBbRepo] = useState("");
  const [bbBranch, setBbBranch] = useState("main");
  const [bbToken, setBbToken] = useState("");

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (provider === "slack") {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          ← Back
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FaSlack className="size-4" /> Slack
            </CardTitle>
            <CardDescription>
              Connect Slack via OAuth to post work-item updates and use slash commands.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {slack && (
              <div className="flex items-center justify-between text-sm">
                <span>
                  {String(slack.channelName || slack.externalTeamId || "Connected")}{" "}
                  {slack.enabled ? "(enabled)" : "(disabled)"}
                </span>
                <Switch
                  checked={!!slack.enabled}
                  disabled={!isAdmin}
                  onCheckedChange={(enabled) =>
                    upsert.mutate({
                      projectId,
                      workspaceId,
                      provider: "slack",
                      enabled,
                    })
                  }
                />
              </div>
            )}
            {isAdmin && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={slackOAuth.isPending}
                  onClick={() => slackOAuth.mutate({ projectId, workspaceId })}
                >
                  {slack ? "Reconnect Slack" : "Connect Slack"}
                </Button>
                {slack && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => remove.mutate({ id: String(slack.$id), projectId })}
                  >
                    Disconnect
                  </Button>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Slash command: <code>/fairlx create Fix login bug</code>. Point Slack Event
              Subscriptions to <code>/api/integrations/slack/events</code>.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (provider === "discord") {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          ← Back
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FaDiscord className="size-4" /> Discord
            </CardTitle>
            <CardDescription>
              Channel webhook for outbound updates; optional guild/channel for slash commands.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {discord && (
              <div className="flex items-center justify-between text-sm">
                <span>Connected {discord.enabled ? "(enabled)" : "(disabled)"}</span>
                <Switch
                  checked={!!discord.enabled}
                  disabled={!isAdmin}
                  onCheckedChange={(enabled) =>
                    upsert.mutate({
                      projectId,
                      workspaceId,
                      provider: "discord",
                      enabled,
                      webhookUrl: (discord.webhookUrl as string) || undefined,
                      externalTeamId: (discord.externalTeamId as string) || undefined,
                      channelId: (discord.channelId as string) || undefined,
                    })
                  }
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Incoming webhook URL</Label>
              <Input
                placeholder="https://discord.com/api/webhooks/..."
                value={discordWebhook || (discord?.webhookUrl as string) || ""}
                onChange={(e) => setDiscordWebhook(e.target.value)}
                disabled={!isAdmin}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Guild ID (optional)</Label>
                <Input
                  value={discordGuildId || (discord?.externalTeamId as string) || ""}
                  onChange={(e) => setDiscordGuildId(e.target.value)}
                  disabled={!isAdmin}
                />
              </div>
              <div className="space-y-2">
                <Label>Channel ID (optional)</Label>
                <Input
                  value={discordChannelId || (discord?.channelId as string) || ""}
                  onChange={(e) => setDiscordChannelId(e.target.value)}
                  disabled={!isAdmin}
                />
              </div>
            </div>
            {isAdmin && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={upsert.isPending}
                  onClick={() =>
                    upsert.mutate({
                      projectId,
                      workspaceId,
                      provider: "discord",
                      enabled: true,
                      webhookUrl:
                        discordWebhook || (discord?.webhookUrl as string) || null,
                      externalTeamId:
                        discordGuildId ||
                        (discord?.externalTeamId as string) ||
                        null,
                      channelId:
                        discordChannelId || (discord?.channelId as string) || null,
                    })
                  }
                >
                  Save Discord
                </Button>
                {discord && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() =>
                      remove.mutate({ id: String(discord.$id), projectId })
                    }
                  >
                    Disconnect
                  </Button>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Interactions endpoint: <code>/api/integrations/discord/interactions</code>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (provider === "gitlab") {
    const owner = glOwner || gitlabCfg?.owner || "";
    const repo = glRepo || gitlabCfg?.repo || "";
    const branch = glBranch || gitlabCfg?.defaultBranch || "main";
    const baseUrl = glBaseUrl || gitlabCfg?.baseUrl || "https://gitlab.com";

    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          ← Back
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FaGitlab className="size-4" /> GitLab
            </CardTitle>
            <CardDescription>
              Connect a GitLab project with a personal access token (read_repository +
              write_repository). Used when GitHub is not linked for agent clone/push.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {gitlab && (
              <div className="flex items-center justify-between text-sm">
                <span>
                  {gitlabCfg
                    ? `${gitlabCfg.owner}/${gitlabCfg.repo}`
                    : "Connected"}{" "}
                  {gitlab.enabled ? "(enabled)" : "(disabled)"}
                  {gitlab.hasAccessToken ? " · token set" : ""}
                </span>
                <Switch
                  checked={!!gitlab.enabled}
                  disabled={!isAdmin}
                  onCheckedChange={(enabled) =>
                    upsert.mutate({
                      projectId,
                      workspaceId,
                      provider: "gitlab",
                      enabled,
                      configJson: gitlab.configJson as string,
                    })
                  }
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>GitLab base URL</Label>
              <Input
                placeholder="https://gitlab.com"
                value={baseUrl}
                onChange={(e) => setGlBaseUrl(e.target.value)}
                disabled={!isAdmin}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Namespace / owner</Label>
                <Input
                  placeholder="my-group"
                  value={owner}
                  onChange={(e) => setGlOwner(e.target.value)}
                  disabled={!isAdmin}
                />
              </div>
              <div className="space-y-2">
                <Label>Project / repo</Label>
                <Input
                  placeholder="my-project"
                  value={repo}
                  onChange={(e) => setGlRepo(e.target.value)}
                  disabled={!isAdmin}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Default branch</Label>
              <Input
                value={branch}
                onChange={(e) => setGlBranch(e.target.value)}
                disabled={!isAdmin}
              />
            </div>
            <div className="space-y-2">
              <Label>Personal access token</Label>
              <Input
                type="password"
                placeholder={
                  gitlab?.hasAccessToken ? "•••••••• (leave blank to keep)" : "glpat-…"
                }
                value={glToken}
                onChange={(e) => setGlToken(e.target.value)}
                disabled={!isAdmin}
              />
            </div>
            {isAdmin && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={upsert.isPending || !owner || !repo}
                  onClick={() =>
                    upsert.mutate({
                      projectId,
                      workspaceId,
                      provider: "gitlab",
                      enabled: true,
                      configJson: serializeVcsConfig({
                        provider: "gitlab",
                        baseUrl,
                        owner,
                        repo,
                        defaultBranch: branch,
                      }),
                      ...(glToken ? { accessToken: glToken } : {}),
                    })
                  }
                >
                  Save GitLab
                </Button>
                {gitlab && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() =>
                      remove.mutate({ id: String(gitlab.$id), projectId })
                    }
                  >
                    Disconnect
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (provider === "bitbucket") {
    const owner = bbOwner || bitbucketCfg?.owner || "";
    const repo = bbRepo || bitbucketCfg?.repo || "";
    const branch = bbBranch || bitbucketCfg?.defaultBranch || "main";

    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          ← Back
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FaBitbucket className="size-4" /> Bitbucket
            </CardTitle>
            <CardDescription>
              Connect a Bitbucket Cloud repo with an app password / access token. Used
              when GitHub and GitLab are not linked for agent clone/push.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {bitbucket && (
              <div className="flex items-center justify-between text-sm">
                <span>
                  {bitbucketCfg
                    ? `${bitbucketCfg.owner}/${bitbucketCfg.repo}`
                    : "Connected"}{" "}
                  {bitbucket.enabled ? "(enabled)" : "(disabled)"}
                  {bitbucket.hasAccessToken ? " · token set" : ""}
                </span>
                <Switch
                  checked={!!bitbucket.enabled}
                  disabled={!isAdmin}
                  onCheckedChange={(enabled) =>
                    upsert.mutate({
                      projectId,
                      workspaceId,
                      provider: "bitbucket",
                      enabled,
                      configJson: bitbucket.configJson as string,
                    })
                  }
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Workspace</Label>
                <Input
                  placeholder="my-workspace"
                  value={owner}
                  onChange={(e) => setBbOwner(e.target.value)}
                  disabled={!isAdmin}
                />
              </div>
              <div className="space-y-2">
                <Label>Repository slug</Label>
                <Input
                  placeholder="my-repo"
                  value={repo}
                  onChange={(e) => setBbRepo(e.target.value)}
                  disabled={!isAdmin}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Default branch</Label>
              <Input
                value={branch}
                onChange={(e) => setBbBranch(e.target.value)}
                disabled={!isAdmin}
              />
            </div>
            <div className="space-y-2">
              <Label>App password / access token</Label>
              <Input
                type="password"
                placeholder={
                  bitbucket?.hasAccessToken
                    ? "•••••••• (leave blank to keep)"
                    : "App password"
                }
                value={bbToken}
                onChange={(e) => setBbToken(e.target.value)}
                disabled={!isAdmin}
              />
            </div>
            {isAdmin && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={upsert.isPending || !owner || !repo}
                  onClick={() =>
                    upsert.mutate({
                      projectId,
                      workspaceId,
                      provider: "bitbucket",
                      enabled: true,
                      configJson: serializeVcsConfig({
                        provider: "bitbucket",
                        owner,
                        repo,
                        defaultBranch: branch,
                      }),
                      ...(bbToken ? { accessToken: bbToken } : {}),
                    })
                  }
                >
                  Save Bitbucket
                </Button>
                {bitbucket && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() =>
                      remove.mutate({ id: String(bitbucket.$id), projectId })
                    }
                  >
                    Disconnect
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // MCP
  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}>
        ← Back
      </Button>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="size-4" /> Fairlx MCP + Custom servers
          </CardTitle>
          <CardDescription>
            Issue MCP API tokens for Claude Code / Codex. Optionally store additional MCP URLs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border p-3 text-xs space-y-1">
            <p className="font-medium text-sm">Fairlx MCP endpoint</p>
            <code className="break-all">
              {typeof window !== "undefined"
                ? `${window.location.origin}/api/integrations/mcp/rpc`
                : "/api/integrations/mcp/rpc"}
            </code>
          </div>

          <div className="space-y-2">
            <Label>Create API token</Label>
            <div className="flex gap-2">
              <Input
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
                disabled={!isAdmin}
              />
              <Button
                size="sm"
                disabled={!isAdmin || createToken.isPending}
                onClick={async () => {
                  const res = await createToken.mutateAsync({
                    projectId,
                    workspaceId,
                    name: tokenName,
                  });
                  setNewToken(res.data.token);
                }}
              >
                Create
              </Button>
            </div>
            {newToken && (
              <div className="rounded-md bg-amber-500/10 border border-amber-500/20 p-2 text-xs">
                <p className="font-medium mb-1">Copy now — shown once</p>
                <div className="flex items-center gap-2">
                  <code className="break-all flex-1">{newToken}</code>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="shrink-0"
                    onClick={async () => {
                      await navigator.clipboard.writeText(newToken);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                  >
                    {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  </Button>
                </div>
              </div>
            )}
            <ul className="space-y-1">
              {(tokensData?.data || []).map((t) => (
                <li
                  key={String(t.$id)}
                  className="flex items-center justify-between text-xs border rounded-md px-2 py-1.5"
                >
                  <span>
                    {String(t.name)} · <code>{String(t.tokenPrefix)}…</code>
                  </span>
                  {isAdmin && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() =>
                        deleteToken.mutate({ id: String(t.$id), projectId })
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <Label>Custom MCP servers (JSON)</Label>
            <Textarea
              rows={6}
              className="font-mono text-xs"
              value={mcpConfig}
              onChange={(e) => setMcpConfig(e.target.value)}
              disabled={!isAdmin}
            />
            {isAdmin && (
              <Button
                size="sm"
                onClick={() => {
                  JSON.parse(mcpConfig);
                  upsert.mutate({
                    projectId,
                    workspaceId,
                    provider: "mcp_custom",
                    enabled: true,
                    configJson: mcpConfig,
                  });
                }}
              >
                Save custom MCPs
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

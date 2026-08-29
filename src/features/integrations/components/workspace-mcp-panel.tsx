"use client";

import { useState } from "react";
import { Bot, Copy, Check, Trash2, Key, Terminal, ShieldCheck, Sparkles, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  useCreateMcpToken,
  useDeleteMcpToken,
  useMcpTokens,
} from "../api/use-integrations";
import { McpPlatformGuide } from "./mcp-platform-guide";

interface WorkspaceMcpPanelProps {
  workspaceId: string;
}

export function WorkspaceMcpPanel({ workspaceId }: WorkspaceMcpPanelProps) {
  const { data: tokensData, isLoading } = useMcpTokens(undefined, workspaceId);
  const createToken = useCreateMcpToken();
  const deleteToken = useDeleteMcpToken();

  const [tokenName, setTokenName] = useState("Claude Code");
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const tokens = (tokensData?.data || []).filter((t) => !t.projectId);

  const baseUrl =
    typeof window !== "undefined" ? window.location.origin : "";
  const mcpUrl = `${baseUrl}/api/mcp`;

  const copyToClipboard = async (text: string, type: string) => {
    await navigator.clipboard.writeText(text);
    if (type === "url") {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } else if (type === "token") {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <Card className="border border-border shadow-none">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center size-9 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Bot className="size-5" />
              </div>
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  Model Context Protocol (MCP)
                  <Badge variant="secondary" className="text-[11px] font-normal gap-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 border-0">
                    <Sparkles className="size-3" /> Workspace Level
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  Connect AI agents like Claude Code, Cursor, Windsurf, or Codex to your entire Fairlx workspace.
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Endpoint box */}
          <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Terminal className="size-3.5" /> Streamable HTTP MCP Endpoint
              </Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={() => copyToClipboard(mcpUrl, "url")}
              >
                {copiedUrl ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                {copiedUrl ? "Copied" : "Copy URL"}
              </Button>
            </div>
            <code className="block rounded-md bg-background border px-3 py-2 text-xs font-mono break-all text-foreground">
              {mcpUrl}
            </code>
          </div>

          {/* Key capability info */}
          <div className="flex items-start gap-2.5 text-xs text-muted-foreground rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
            <ShieldCheck className="size-4 text-blue-500 mt-0.5 shrink-0" />
            <p>
              <strong>Workspace Scope:</strong> Tokens generated here grant access across <em>all projects</em> in this workspace that your user account has permissions for. Write and delete tools follow your project role on every call. Explicit token scopes, if set, can only further restrict access.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Token Generation Card */}
      <Card className="border border-border shadow-none">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="size-4 text-primary" />
            <CardTitle className="text-base">Workspace API Tokens</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Generate and manage authentication tokens for your AI assistants.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Create Token Row */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Generate New Token</Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
                placeholder="Token name (e.g., Claude Code, Cursor Workstation)"
                className="h-9 text-sm"
              />
              <Button
                size="sm"
                disabled={createToken.isPending || !tokenName.trim()}
                onClick={async () => {
                  const res = await createToken.mutateAsync({
                    workspaceId,
                    name: tokenName.trim(),
                  });
                  setNewToken(res.data.token);
                }}
                className="h-9 gap-1.5 shrink-0"
              >
                {createToken.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Key className="size-3.5" />}
                Generate Token
              </Button>
            </div>
          </div>

          {/* New Token Banner */}
          {newToken && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <Key className="size-3.5" /> Copy Your Token Now
                </p>
                <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-700 dark:text-amber-400">
                  Shown Once
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                For security reasons, this token will never be displayed again. Store it securely.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <code className="flex-1 rounded-md bg-background border border-amber-500/20 px-3 py-2 text-xs font-mono break-all select-all font-semibold">
                  {newToken}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 h-9 gap-1.5 bg-background border-amber-500/30 hover:bg-amber-500/10"
                  onClick={() => copyToClipboard(newToken, "token")}
                >
                  {copiedToken ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                  {copiedToken ? "Copied!" : "Copy"}
                </Button>
              </div>
            </div>
          )}

          {/* Active Tokens List */}
          <div className="space-y-3">
            <Label className="text-xs font-medium text-muted-foreground">
              Active Tokens ({tokens.length})
            </Label>
            {isLoading ? (
              <div className="flex items-center justify-center py-6 text-xs text-muted-foreground gap-2">
                <Loader2 className="size-4 animate-spin" /> Loading tokens...
              </div>
            ) : tokens.length === 0 ? (
              <div className="text-center py-6 rounded-lg border border-dashed text-xs text-muted-foreground">
                No workspace MCP tokens created yet. Generate one above to connect your AI agent.
              </div>
            ) : (
              <ul className="divide-y divide-border rounded-lg border">
                {tokens.map((t) => (
                  <li
                    key={String(t.$id)}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 text-xs hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <span className="font-medium text-foreground">{String(t.name)}</span>
                      <code className="text-muted-foreground font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded">
                        {String(t.tokenPrefix)}…
                      </code>
                      <Badge variant="secondary" className="w-fit text-[10px] font-normal bg-blue-500/10 text-blue-600 dark:text-blue-400 border-0">
                        workspace
                      </Badge>
                      {typeof t.$createdAt === "string" && (
                        <span className="text-[11px] text-muted-foreground">
                          Created {format(new Date(t.$createdAt), "MMM d, yyyy")}
                        </span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 self-end sm:self-auto gap-1"
                      disabled={deleteToken.isPending}
                      onClick={() =>
                        deleteToken.mutate({
                          id: String(t.$id),
                          workspaceId,
                        })
                      }
                    >
                      <Trash2 className="size-3.5" />
                      Revoke
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Step-by-Step Platform Guides */}
      <McpPlatformGuide mcpUrl={mcpUrl} token={newToken} scope="workspace" />
    </div>
  );
}


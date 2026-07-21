"use client";

import { useMemo, useState } from "react";
import { Copy, Bot, Terminal, AlertCircle, Check } from "lucide-react";
import { FaGithub, FaGitlab, FaBitbucket } from "react-icons/fa";
import { toast } from "sonner";
import Link from "next/link";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useAgentContext } from "../api/use-integrations";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";

interface StartWithAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workItemId: string;
  projectId: string;
}

export function StartWithAgentDialog({
  open,
  onOpenChange,
  workItemId,
  projectId,
}: StartWithAgentDialogProps) {
  const workspaceId = useWorkspaceId();
  const { data, isLoading, error } = useAgentContext(workItemId, projectId, open);
  const pack = data?.data;
  const vcs = pack?.vcs || pack?.github || null;
  const [copied, setCopied] = useState<string | null>(null);

  const claudeCli = useMemo(() => {
    if (!pack) return "";
    return `# Suggested Claude Code flow
# 1) Ensure Fairlx MCP is configured (Integrations → MCP token)
# 2) Clone & branch
git clone ${vcs?.cloneUrl || "<connect-vcs-first>"}
cd ${vcs?.repo || "repo"}
git checkout -b ${pack.suggestedBranch}

# 3) Paste this prompt into Claude Code:
`;
  }, [pack, vcs]);

  const codexCli = useMemo(() => {
    if (!pack) return "";
    return `# Suggested Codex flow
git clone ${vcs?.cloneUrl || "<connect-vcs-first>"}
cd ${vcs?.repo || "repo"}
git checkout -b ${pack.suggestedBranch}
# Then run Codex with the prompt below
`;
  }, [pack, vcs]);

  const copy = async (key: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success("Copied");
    setTimeout(() => setCopied(null), 1500);
  };

  const providerLabel =
    vcs?.provider === "gitlab"
      ? "GitLab"
      : vcs?.provider === "bitbucket"
        ? "Bitbucket"
        : "GitHub";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="size-5" />
            Start with Claude / Codex
          </DialogTitle>
          <DialogDescription>
            Context pack for local Claude Code or OpenAI Codex. Agents use Fairlx MCP to update
            this work item and push to a branch named after the key.
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <p className="text-sm text-muted-foreground py-8 text-center">Loading context…</p>
        )}

        {error && (
          <div className="flex items-start gap-2 text-sm text-destructive">
            <AlertCircle className="size-4 mt-0.5" />
            {(error as Error).message}
          </div>
        )}

        {pack && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{pack.workItemKey}</Badge>
              <Badge variant="outline">branch: {pack.suggestedBranch}</Badge>
              {vcs ? (
                <Badge className="bg-emerald-600/10 text-emerald-700 border-emerald-600/20">
                  {vcs.provider === "gitlab" ? (
                    <FaGitlab className="size-3 mr-1" />
                  ) : vcs.provider === "bitbucket" ? (
                    <FaBitbucket className="size-3 mr-1" />
                  ) : (
                    <FaGithub className="size-3 mr-1" />
                  )}
                  {providerLabel}: {vcs.owner}/{vcs.repo}
                </Badge>
              ) : (
                <Badge variant="destructive">No VCS connected</Badge>
              )}
            </div>

            {!vcs && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                Connect GitHub, GitLab, or Bitbucket so agents can clone and push.
                <div className="mt-2">
                  <Button asChild size="sm" variant="outline">
                    <Link
                      href={`/workspaces/${workspaceId}/projects/${projectId}/settings?tab=integrations`}
                    >
                      Open Integrations
                    </Link>
                  </Button>
                </div>
              </div>
            )}

            <div className="rounded-md border p-3 text-xs space-y-1">
              <p className="font-medium text-sm">Fairlx MCP</p>
              <code className="block break-all">{pack.mcp.fairlxUrl}</code>
              <p className="text-muted-foreground">{pack.mcp.instructions}</p>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2"
                onClick={() => copy("mcp", pack.mcp.fairlxUrl)}
              >
                {copied === "mcp" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                <span className="ml-1">Copy MCP URL</span>
              </Button>
            </div>

            <Tabs defaultValue="claude">
              <TabsList>
                <TabsTrigger value="claude">Claude Code</TabsTrigger>
                <TabsTrigger value="codex">Codex</TabsTrigger>
              </TabsList>
              <TabsContent value="claude" className="space-y-2">
                <pre className="text-[11px] bg-muted/50 rounded-md p-3 overflow-x-auto whitespace-pre-wrap">
                  {claudeCli}
                  {pack.prompts.claude}
                </pre>
                <Button
                  size="sm"
                  onClick={() => copy("claude", `${claudeCli}${pack.prompts.claude}`)}
                >
                  <Terminal className="size-3.5 mr-1.5" />
                  {copied === "claude" ? "Copied" : "Copy Claude prompt"}
                </Button>
              </TabsContent>
              <TabsContent value="codex" className="space-y-2">
                <pre className="text-[11px] bg-muted/50 rounded-md p-3 overflow-x-auto whitespace-pre-wrap">
                  {codexCli}
                  {pack.prompts.codex}
                </pre>
                <Button
                  size="sm"
                  onClick={() => copy("codex", `${codexCli}${pack.prompts.codex}`)}
                >
                  <Terminal className="size-3.5 mr-1.5" />
                  {copied === "codex" ? "Copied" : "Copy Codex prompt"}
                </Button>
              </TabsContent>
            </Tabs>

            {pack.customMcps?.length > 0 && (
              <div className="text-xs text-muted-foreground">
                Custom MCP servers configured:{" "}
                {pack.customMcps.map((s) => s.name).join(", ")}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

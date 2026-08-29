"use client";

import { useState } from "react";
import {
  Copy,
  Check,
  Code2,
  CheckCircle2,
} from "lucide-react";
import { SiClaude, SiGooglegemini } from "react-icons/si";
import { VscVscode, VscCopilot } from "react-icons/vsc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

export function CursorIcon({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M11.5 2.05a1 1 0 0 1 1 0l9 5.2a1 1 0 0 1 .5.87v10.4a1 1 0 0 1-.5.86l-9 5.2a1 1 0 0 1-1 0l-9-5.2a1 1 0 0 1-.5-.86V8.12a1 1 0 0 1 .5-.87l9-5.2zM12 4.09 4.8 8.25 12 12.4l7.2-4.15L12 4.09zm-8 5.73v7.4l7 4.04V13.8l-7-3.98zm9 11.44 7-4.04v-7.4l-7 3.98v7.46z" />
    </svg>
  );
}

interface McpPlatformGuideProps {
  mcpUrl: string;
  token?: string | null;
  scope?: "workspace" | "project";
}

export function McpPlatformGuide({
  mcpUrl,
  token,
  scope = "workspace",
}: McpPlatformGuideProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const activeToken = token || `<YOUR_${scope.toUpperCase()}_TOKEN>`;

  const antigravityJson = JSON.stringify(
    {
      mcpServers: {
        fairlx: {
          url: mcpUrl,
          headers: {
            Authorization: `Bearer ${activeToken}`,
          },
        },
      },
    },
    null,
    2
  );

  const vscodeJson = JSON.stringify(
    {
      mcpServers: {
        fairlx: {
          url: mcpUrl,
          headers: {
            Authorization: `Bearer ${activeToken}`,
          },
        },
      },
    },
    null,
    2
  );

  const cursorJson = JSON.stringify(
    {
      mcpServers: {
        fairlx: {
          url: mcpUrl,
          headers: {
            Authorization: `Bearer ${activeToken}`,
          },
        },
      },
    },
    null,
    2
  );

  const claudeCliCommand = `claude mcp add --transport http fairlx "${mcpUrl}" --header "Authorization: Bearer ${activeToken}"`;

  return (
    <Card className="border border-border shadow-none">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <Code2 className="size-4 text-primary" />
          <CardTitle className="text-base">Step-by-Step Setup Guides</CardTitle>
        </div>
        <CardDescription className="text-xs">
          Select your development environment below for tailored setup instructions.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="antigravity" className="w-full">
          <div className="overflow-x-auto -mx-1 px-1 pb-1">
            <TabsList className="relative flex w-fit gap-1 rounded-xl border border-border bg-muted/20 p-1 h-auto mb-4">
              <TabsTrigger
                value="antigravity"
                className="text-xs px-3 py-1.5 gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                <SiGooglegemini className="size-3.5 text-[#1A73E8] dark:text-[#8AB4F8]" />
                Google Antigravity
              </TabsTrigger>
              <TabsTrigger
                value="vscode"
                className="text-xs px-3 py-1.5 gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                <VscVscode className="size-3.5 text-[#007ACC] dark:text-[#2488E5]" />
                VS Code (Copilot)
              </TabsTrigger>
              <TabsTrigger
                value="cursor"
                className="text-xs px-3 py-1.5 gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                <CursorIcon className="size-3.5 text-foreground" />
                Cursor / Windsurf
              </TabsTrigger>
              <TabsTrigger
                value="claude-cli"
                className="text-xs px-3 py-1.5 gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                <SiClaude className="size-3.5 text-[#D97757]" />
                Claude Code (CLI)
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ANTIGRAVITY GUIDE */}
          <TabsContent value="antigravity" className="space-y-4 mt-0">
            <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center size-7 rounded-md bg-[#1A73E8]/10 text-[#1A73E8] dark:text-[#8AB4F8] shrink-0">
                  <SiGooglegemini className="size-4" />
                </div>
                <span>
                  <strong>Google Antigravity IDE & CLI</strong> — Full native support for workspace tools, task search, sprints, and documentation.
                </span>
              </div>
              <Badge variant="secondary" className="text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 border-0">
                Native MCP
              </Badge>
            </div>

            <div className="space-y-4 text-xs">
              {/* Step 1 */}
              <div className="flex gap-3">
                <div className="flex items-center justify-center size-6 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold shrink-0 text-xs">
                  1
                </div>
                <div className="space-y-1 flex-1">
                  <p className="font-semibold text-foreground">Generate Your Token</p>
                  <p className="text-muted-foreground">
                    Use the <strong>API Tokens</strong> card above to generate a new token and copy it.
                    {token && (
                      <span className="inline-flex items-center gap-1 ml-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                        <CheckCircle2 className="size-3" /> Token applied to snippet below
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-3">
                <div className="flex items-center justify-center size-6 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold shrink-0 text-xs">
                  2
                </div>
                <div className="space-y-1.5 flex-1">
                  <p className="font-semibold text-foreground">Create Configuration File</p>
                  <p className="text-muted-foreground">
                    Create or update the configuration file in your workspace or global folder:
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="bg-muted px-2 py-1 rounded text-[11px] font-mono border">
                      .agents/mcp_config.json
                    </code>
                    <span className="text-[11px] text-muted-foreground">(workspace root) or</span>
                    <code className="bg-muted px-2 py-1 rounded text-[11px] font-mono border">
                      ~/.gemini/config/mcp_config.json
                    </code>
                    <span className="text-[11px] text-muted-foreground">(global)</span>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-3">
                <div className="flex items-center justify-center size-6 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold shrink-0 text-xs">
                  3
                </div>
                <div className="space-y-2 flex-1">
                  <p className="font-semibold text-foreground">Paste Configuration</p>
                  <p className="text-muted-foreground">
                    Paste the following JSON structure into your config file:
                  </p>
                  <div className="relative">
                    <pre className="rounded-lg bg-muted p-3 text-[11px] font-mono overflow-x-auto text-foreground border">
                      {antigravityJson}
                    </pre>
                    <Button
                      size="sm"
                      variant="outline"
                      className="absolute top-2 right-2 h-7 text-xs gap-1 bg-background/80 backdrop-blur"
                      onClick={() => copyToClipboard(antigravityJson, "antigravity")}
                    >
                      {copiedKey === "antigravity" ? (
                        <Check className="size-3 text-emerald-500" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                      {copiedKey === "antigravity" ? "Copied!" : "Copy JSON"}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex gap-3">
                <div className="flex items-center justify-center size-6 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold shrink-0 text-xs">
                  4
                </div>
                <div className="space-y-1 flex-1">
                  <p className="font-semibold text-foreground">Verify & Use</p>
                  <p className="text-muted-foreground">
                    Antigravity will automatically load the Fairlx MCP tools. You can now prompt the assistant with:
                  </p>
                  <div className="p-2 rounded bg-muted/60 font-mono text-[11px] border text-foreground">
                    &quot;List my active sprint tasks in Fairlx and find tickets assigned to me&quot;
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* VS CODE (COPILOT) GUIDE */}
          <TabsContent value="vscode" className="space-y-4 mt-0">
            <div className="flex items-center justify-between p-3 rounded-lg bg-sky-500/5 border border-sky-500/20 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center size-7 rounded-md bg-[#007ACC]/10 text-[#007ACC] dark:text-[#2488E5] shrink-0">
                  <VscVscode className="size-4" />
                </div>
                <span>
                  <strong>Visual Studio Code & GitHub Copilot</strong> — Connect GitHub Copilot Chat to Fairlx via standard VS Code MCP configuration.
                </span>
              </div>
              <Badge variant="secondary" className="text-[10px] bg-sky-500/10 text-sky-600 dark:text-sky-400 border-0 flex items-center gap-1">
                <VscCopilot className="size-3" /> Copilot Ready
              </Badge>
            </div>

            <div className="space-y-4 text-xs">
              {/* Step 1 */}
              <div className="flex gap-3">
                <div className="flex items-center justify-center size-6 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold shrink-0 text-xs">
                  1
                </div>
                <div className="space-y-1 flex-1">
                  <p className="font-semibold text-foreground">Generate Your Token</p>
                  <p className="text-muted-foreground">
                    Create an API token above to authenticate your VS Code editor.
                    {token && (
                      <span className="inline-flex items-center gap-1 ml-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                        <CheckCircle2 className="size-3" /> Token applied to snippet below
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-3">
                <div className="flex items-center justify-center size-6 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold shrink-0 text-xs">
                  2
                </div>
                <div className="space-y-1.5 flex-1">
                  <p className="font-semibold text-foreground">Create .vscode/mcp.json</p>
                  <p className="text-muted-foreground">
                    In your workspace folder, create a directory called <code>.vscode</code> (if it doesn&apos;t exist) and add <code>mcp.json</code>:
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="bg-muted px-2 py-1 rounded text-[11px] font-mono border">
                      .vscode/mcp.json
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[11px] px-2 gap-1"
                      onClick={() => copyToClipboard(".vscode/mcp.json", "vsc-path")}
                    >
                      {copiedKey === "vsc-path" ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                      {copiedKey === "vsc-path" ? "Copied" : "Copy path"}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-3">
                <div className="flex items-center justify-center size-6 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold shrink-0 text-xs">
                  3
                </div>
                <div className="space-y-2 flex-1">
                  <p className="font-semibold text-foreground">Add Server Configuration</p>
                  <p className="text-muted-foreground">
                    Save the following configuration inside <code>.vscode/mcp.json</code>:
                  </p>
                  <div className="relative">
                    <pre className="rounded-lg bg-muted p-3 text-[11px] font-mono overflow-x-auto text-foreground border">
                      {vscodeJson}
                    </pre>
                    <Button
                      size="sm"
                      variant="outline"
                      className="absolute top-2 right-2 h-7 text-xs gap-1 bg-background/80 backdrop-blur"
                      onClick={() => copyToClipboard(vscodeJson, "vscode")}
                    >
                      {copiedKey === "vscode" ? (
                        <Check className="size-3 text-emerald-500" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                      {copiedKey === "vscode" ? "Copied!" : "Copy JSON"}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex gap-3">
                <div className="flex items-center justify-center size-6 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold shrink-0 text-xs">
                  4
                </div>
                <div className="space-y-1 flex-1">
                  <p className="font-semibold text-foreground">Start Copilot Chat</p>
                  <p className="text-muted-foreground">
                    Open GitHub Copilot Chat (<code>Ctrl+Shift+I</code> or <code>Cmd+Shift+I</code>), select Agent Mode, and ask:
                  </p>
                  <div className="p-2 rounded bg-muted/60 font-mono text-[11px] border text-foreground">
                    &quot;@fairlx get context for task AI-12 and summarize the linked documentation&quot;
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* CURSOR / WINDSURF GUIDE */}
          <TabsContent value="cursor" className="space-y-4 mt-0">
            <div className="flex items-center justify-between p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/20 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center size-7 rounded-md bg-foreground/10 text-foreground shrink-0">
                  <CursorIcon className="size-4" />
                </div>
                <span>
                  <strong>Cursor & Windsurf IDE</strong> — Seamless integration with Composer and Agent mode for editing and creating tasks.
                </span>
              </div>
              <Badge variant="secondary" className="text-[10px] bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-0">
                Composer Ready
              </Badge>
            </div>

            <div className="space-y-4 text-xs">
              {/* Step 1 */}
              <div className="flex gap-3">
                <div className="flex items-center justify-center size-6 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold shrink-0 text-xs">
                  1
                </div>
                <div className="space-y-1 flex-1">
                  <p className="font-semibold text-foreground">Generate Your Token</p>
                  <p className="text-muted-foreground">
                    Generate an API token from the section above.
                    {token && (
                      <span className="inline-flex items-center gap-1 ml-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                        <CheckCircle2 className="size-3" /> Token applied to snippet below
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-3">
                <div className="flex items-center justify-center size-6 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold shrink-0 text-xs">
                  2
                </div>
                <div className="space-y-1.5 flex-1">
                  <p className="font-semibold text-foreground">Open Settings or Create .cursor/mcp.json</p>
                  <p className="text-muted-foreground">
                    You can either open <strong>Cursor Settings → Features → MCP</strong>, or create a file in your project:
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="bg-muted px-2 py-1 rounded text-[11px] font-mono border">
                      .cursor/mcp.json
                    </code>
                    <span className="text-[11px] text-muted-foreground">or</span>
                    <code className="bg-muted px-2 py-1 rounded text-[11px] font-mono border">
                      .windsurf/mcp.json
                    </code>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-3">
                <div className="flex items-center justify-center size-6 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold shrink-0 text-xs">
                  3
                </div>
                <div className="space-y-2 flex-1">
                  <p className="font-semibold text-foreground">Save Configuration</p>
                  <p className="text-muted-foreground">
                    Paste the JSON configuration into your file or Cursor MCP settings:
                  </p>
                  <div className="relative">
                    <pre className="rounded-lg bg-muted p-3 text-[11px] font-mono overflow-x-auto text-foreground border">
                      {cursorJson}
                    </pre>
                    <Button
                      size="sm"
                      variant="outline"
                      className="absolute top-2 right-2 h-7 text-xs gap-1 bg-background/80 backdrop-blur"
                      onClick={() => copyToClipboard(cursorJson, "cursor")}
                    >
                      {copiedKey === "cursor" ? (
                        <Check className="size-3 text-emerald-500" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                      {copiedKey === "cursor" ? "Copied!" : "Copy JSON"}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex gap-3">
                <div className="flex items-center justify-center size-6 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold shrink-0 text-xs">
                  4
                </div>
                <div className="space-y-1 flex-1">
                  <p className="font-semibold text-foreground">Verify Connection</p>
                  <p className="text-muted-foreground">
                    Open Cursor Settings → MCP to verify the green status dot next to <strong>fairlx</strong>. You can then ask Composer:
                  </p>
                  <div className="p-2 rounded bg-muted/60 font-mono text-[11px] border text-foreground">
                    &quot;Find backlog items in Fairlx and plan the implementation for the highest priority task&quot;
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* CLAUDE CODE CLI GUIDE */}
          <TabsContent value="claude-cli" className="space-y-4 mt-0">
            <div className="flex items-center justify-between p-3 rounded-lg bg-[#D97757]/5 border border-[#D97757]/20 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center size-7 rounded-md bg-[#D97757]/10 text-[#D97757] shrink-0">
                  <SiClaude className="size-4" />
                </div>
                <span>
                  <strong>Anthropic Claude Code (CLI)</strong> — Direct CLI integration with streamable HTTP transport for terminal workflows.
                </span>
              </div>
              <Badge variant="secondary" className="text-[10px] bg-[#D97757]/10 text-[#D97757] border-0">
                CLI Command
              </Badge>
            </div>

            <div className="space-y-4 text-xs">
              {/* Step 1 */}
              <div className="flex gap-3">
                <div className="flex items-center justify-center size-6 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold shrink-0 text-xs">
                  1
                </div>
                <div className="space-y-1 flex-1">
                  <p className="font-semibold text-foreground">Generate Your Token</p>
                  <p className="text-muted-foreground">
                    Generate an API token from the section above.
                    {token && (
                      <span className="inline-flex items-center gap-1 ml-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                        <CheckCircle2 className="size-3" /> Token applied to command below
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-3">
                <div className="flex items-center justify-center size-6 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold shrink-0 text-xs">
                  2
                </div>
                <div className="space-y-2 flex-1">
                  <p className="font-semibold text-foreground">Register MCP in Terminal</p>
                  <p className="text-muted-foreground">
                    Run the following command in your terminal:
                  </p>
                  <div className="relative">
                    <pre className="rounded-lg bg-muted p-3 text-[11px] font-mono overflow-x-auto text-foreground border">
                      {claudeCliCommand}
                    </pre>
                    <Button
                      size="sm"
                      variant="outline"
                      className="absolute top-2 right-2 h-7 text-xs gap-1 bg-background/80 backdrop-blur"
                      onClick={() => copyToClipboard(claudeCliCommand, "claude")}
                    >
                      {copiedKey === "claude" ? (
                        <Check className="size-3 text-emerald-500" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                      {copiedKey === "claude" ? "Copied!" : "Copy Command"}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-3">
                <div className="flex items-center justify-center size-6 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold shrink-0 text-xs">
                  3
                </div>
                <div className="space-y-1.5 flex-1">
                  <p className="font-semibold text-foreground">Verify Registration</p>
                  <p className="text-muted-foreground">
                    Verify that Fairlx is registered by listing all MCP servers:
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="bg-muted px-2.5 py-1 rounded font-mono text-[11px] border">
                      claude mcp list
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[11px] px-2 gap-1"
                      onClick={() => copyToClipboard("claude mcp list", "claude-list")}
                    >
                      {copiedKey === "claude-list" ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                      {copiedKey === "claude-list" ? "Copied" : "Copy"}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex gap-3">
                <div className="flex items-center justify-center size-6 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold shrink-0 text-xs">
                  4
                </div>
                <div className="space-y-1 flex-1">
                  <p className="font-semibold text-foreground">Launch Claude Code</p>
                  <p className="text-muted-foreground">
                    Start Claude Code in any directory and prompt it:
                  </p>
                  <div className="p-2 rounded bg-muted/60 font-mono text-[11px] border text-foreground">
                    claude &quot;Show me the current sprint overview and create a bug ticket for the login issue&quot;
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

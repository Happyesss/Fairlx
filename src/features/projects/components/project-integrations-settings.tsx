"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  Github, 
  MessageSquare, 
  GitCommit, 
  GitPullRequest, 
  AlertCircle, 
  ChevronRight,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  ExternalLink,
  Puzzle,
  Slack,
  Layers,
  FileText,
  Figma,
  Bot
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { DottedSeparator } from "@/components/dotted-separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  useGetRepository, 
  useUpdateRepositorySettings, 
  useDisconnectRepository
} from "@/features/github-integration/api/use-github";
import { 
  ConnectRepository,
  CodebaseQA,
  CommitHistory 
} from "@/features/github-integration/components";
import { 
  getCommitsCount, 
  readLegacyCommits, 
  saveCommitsToCache, 
  clearLegacyCommits, 
  notifyCommitsUpdated,
  readLegacyCommitsCount,
  COMMIT_CACHE_CHANNEL 
} from "@/features/github-integration/lib/commit-cache";
import { useConfirm } from "@/hooks/use-confirm";

interface ProjectIntegrationsSettingsProps {
  projectId: string;
  isAdmin: boolean;
}

export const ProjectIntegrationsSettings = ({
  projectId,
  isAdmin,
}: ProjectIntegrationsSettingsProps) => {
  const [activeSubView, setActiveSubView] = useState<"list" | "github">("list");
  
  const { data: repository, isLoading: isLoadingRepo } = useGetRepository(projectId);
  const { mutate: updateSettings, isPending: isUpdating } = useUpdateRepositorySettings();
  const { mutate: disconnectRepository, isPending: isDisconnecting } = useDisconnectRepository();

  const [ConfirmDialog, confirm] = useConfirm(
    "Disconnect Repository",
    "Are you sure you want to disconnect this repository? All integration options will be disabled.",
    "destructive"
  );

  // Local settings state
  const [autoFetchCommits, setAutoFetchCommits] = useState(true);
  const [linkCommitsToTasks, setLinkCommitsToTasks] = useState(true);
  const [syncComments, setSyncComments] = useState(true);
  const [allowPrMerge, setAllowPrMerge] = useState(true);
  const [createTasksFromIssues, setCreateTasksFromIssues] = useState(false);

  // Commits count state for Codebase Q&A
  const [commitsCount, setCommitsCount] = useState(0);

  // Sync state with fetched repository settings
  useEffect(() => {
    if (repository) {
      setAutoFetchCommits(repository.autoFetchCommits !== false);
      setLinkCommitsToTasks(repository.linkCommitsToTasks !== false);
      setSyncComments(repository.syncComments !== false);
      setAllowPrMerge(repository.allowPrMerge !== false);
      setCreateTasksFromIssues(!!repository.createTasksFromIssues);
    }
  }, [repository]);

  // Load commits count for Q&A function
  const loadCommitsCount = useCallback(async () => {
    try {
      const count = await getCommitsCount(projectId);
      if (count > 0) {
        setCommitsCount(count);
        return;
      }

      const legacyCommits = readLegacyCommits(projectId);
      if (legacyCommits.length > 0) {
        setCommitsCount(legacyCommits.length);
        await saveCommitsToCache(projectId, legacyCommits);
        clearLegacyCommits(projectId);
        notifyCommitsUpdated(projectId);
        return;
      }

      const legacyCount = readLegacyCommitsCount(projectId);
      setCommitsCount(legacyCount);
    } catch {
      setCommitsCount(0);
    }
  }, [projectId]);

  useEffect(() => {
    loadCommitsCount();
  }, [loadCommitsCount]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleCommitsUpdate = (event: Event) => {
      const projectDetail = (event as CustomEvent<{ projectId?: string }>).detail?.projectId;
      if (projectDetail && projectDetail !== projectId) return;
      loadCommitsCount();
    };

    window.addEventListener("commitsUpdated", handleCommitsUpdate);

    let channel: BroadcastChannel | null = null;
    if ("BroadcastChannel" in window) {
      channel = new BroadcastChannel(COMMIT_CACHE_CHANNEL);
      channel.addEventListener("message", (event: MessageEvent<{ projectId?: string }>) => {
        if (event.data?.projectId && event.data.projectId !== projectId) return;
        loadCommitsCount();
      });
    }

    return () => {
      window.removeEventListener("commitsUpdated", handleCommitsUpdate);
      channel?.close();
    };
  }, [loadCommitsCount, projectId]);

  const hasChanges = repository && (
    autoFetchCommits !== (repository.autoFetchCommits !== false) ||
    linkCommitsToTasks !== (repository.linkCommitsToTasks !== false) ||
    syncComments !== (repository.syncComments !== false) ||
    allowPrMerge !== (repository.allowPrMerge !== false) ||
    createTasksFromIssues !== (!!repository.createTasksFromIssues)
  );

  const handleSaveSettings = () => {
    if (!repository) return;
    updateSettings({
      param: { repositoryId: repository.$id },
      projectId,
      json: {
        autoFetchCommits,
        linkCommitsToTasks,
        syncComments,
        allowPrMerge,
        createTasksFromIssues,
      }
    });
  };

  const handleDisconnect = async () => {
    if (!repository) return;
    const ok = await confirm();
    if (ok) {
      disconnectRepository({
        param: { repositoryId: repository.$id },
        projectId,
      }, {
        onSuccess: () => {
          setActiveSubView("list");
        }
      });
    }
  };

  if (isLoadingRepo) {
    return (
      <div className="flex h-[350px] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (activeSubView === "github") {
    return (
      <div className="space-y-6">
        <ConfirmDialog />
        
        {/* Back Button and Header */}
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setActiveSubView("list")}
            className="rounded-full size-8"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Github className="size-5 animate-pulse" />
              GitHub Integration
            </h3>
            <p className="text-xs text-muted-foreground">
              Configure and interact with the connected repository.
            </p>
          </div>
        </div>

        <DottedSeparator className="my-1" />

        {repository ? (
          <Tabs defaultValue="settings" className="w-full">
            <TabsList className="grid w-full grid-cols-3 max-w-md mb-6 bg-muted/80 p-1 rounded-xl">
              <TabsTrigger value="settings" className="text-xs font-semibold data-[state=active]:bg-background transition-all">
                Settings
              </TabsTrigger>
              <TabsTrigger value="qa" className="text-xs font-semibold data-[state=active]:bg-background transition-all">
                Codebase Q&A
              </TabsTrigger>
              <TabsTrigger value="commits" className="text-xs font-semibold data-[state=active]:bg-background transition-all">
                Commit Insights
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: Settings */}
            <TabsContent value="settings" className="space-y-6">
              <div className="grid gap-6 md:grid-cols-3">
                {/* Repo Status Card */}
                <Card className="md:col-span-1 h-fit bg-card/50 backdrop-blur-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold">Connection Details</CardTitle>
                    <CardDescription className="text-xs">Active repository connection</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-lg bg-muted/50 p-3.5 space-y-2 border">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground font-medium">Repository</span>
                        <span className="font-semibold text-foreground break-all text-right max-w-[150px]">
                          {repository.owner}/{repository.repositoryName}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground font-medium">Branch</span>
                        <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">
                          {repository.branch}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground font-medium">Status</span>
                        <span className="flex items-center gap-1 font-semibold text-green-600 dark:text-green-400">
                          <CheckCircle2 className="size-3.5" />
                          Connected
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        asChild 
                        className="w-full text-xs font-medium"
                      >
                        <a 
                          href={repository.githubUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1.5"
                        >
                          View on GitHub
                          <ExternalLink className="size-3" />
                        </a>
                      </Button>

                      {isAdmin && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleDisconnect}
                          disabled={isDisconnecting}
                          className="w-full text-xs font-medium"
                        >
                          {isDisconnecting ? (
                            <Loader2 className="size-3.5 mr-2 animate-spin" />
                          ) : (
                            "Disconnect Repository"
                          )}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Options Settings Card */}
                <Card className="md:col-span-2 bg-card/50 backdrop-blur-sm">
                  <CardHeader className="pb-3 border-b">
                    <CardTitle className="text-base font-semibold">Integration Options</CardTitle>
                    <CardDescription className="text-xs">
                      Customize the behavior of the GitHub integration for this project.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-6">
                    
                    {/* 1. Comments */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="size-4 text-muted-foreground" />
                          <span className="text-sm font-semibold">Sync Comments</span>
                        </div>
                        <p className="text-xs text-muted-foreground font-normal max-w-lg">
                          Sync comments made on commits and PRs directly to connected work items.
                        </p>
                      </div>
                      <Switch 
                        checked={syncComments}
                        onCheckedChange={setSyncComments}
                        disabled={!isAdmin || isUpdating}
                      />
                    </div>

                    <DottedSeparator />

                    {/* 2. Connecting the commits */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <GitCommit className="size-4 text-muted-foreground" />
                          <span className="text-sm font-semibold">Connect Commits to Tasks</span>
                        </div>
                        <p className="text-xs text-muted-foreground font-normal max-w-lg">
                          Automatically link commits mentioning task keys (e.g. PRJ-123) to their corresponding backlog tasks.
                        </p>
                      </div>
                      <Switch 
                        checked={linkCommitsToTasks}
                        onCheckedChange={setLinkCommitsToTasks}
                        disabled={!isAdmin || isUpdating}
                      />
                    </div>

                    <DottedSeparator />

                    {/* 3. Merging the PR from this application only */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <GitPullRequest className="size-4 text-muted-foreground" />
                          <span className="text-sm font-semibold">Allow PR Merging</span>
                        </div>
                        <p className="text-xs text-muted-foreground font-normal max-w-lg">
                          Allow authorized project members to merge GitHub pull requests directly from Fairlx.
                        </p>
                      </div>
                      <Switch 
                        checked={allowPrMerge}
                        onCheckedChange={setAllowPrMerge}
                        disabled={!isAdmin || isUpdating}
                      />
                    </div>

                    <DottedSeparator />

                    {/* 4. Auto-fetching the commits */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <Loader2 className="size-4 text-muted-foreground" />
                          <span className="text-sm font-semibold">Auto-Fetch Commits</span>
                        </div>
                        <p className="text-xs text-muted-foreground font-normal max-w-lg">
                          Automatically scan the linked branch for new commits periodically and generate AI summaries.
                        </p>
                      </div>
                      <Switch 
                        checked={autoFetchCommits}
                        onCheckedChange={setAutoFetchCommits}
                        disabled={!isAdmin || isUpdating}
                      />
                    </div>

                    <DottedSeparator />

                    {/* 5. Auto-create work items from Issues */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="size-4 text-muted-foreground" />
                          <span className="text-sm font-semibold flex items-center gap-1.5">
                            Sync GitHub Issues
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground font-normal max-w-lg">
                          Automatically create a new work item in the backlog with type <code className="bg-muted px-1 rounded text-[11px] font-mono text-red-500 font-semibold">issue</code> whenever a new issue is opened in the GitHub repository.
                        </p>
                      </div>
                      <Switch 
                        checked={createTasksFromIssues}
                        onCheckedChange={setCreateTasksFromIssues}
                        disabled={!isAdmin || isUpdating}
                      />
                    </div>

                    {isAdmin && (
                      <div className="pt-4 flex justify-end">
                        <Button
                          onClick={handleSaveSettings}
                          disabled={!hasChanges || isUpdating}
                          size="sm"
                          className="px-6 text-xs font-semibold animate-shimmer"
                        >
                          {isUpdating ? (
                            <>
                              <Loader2 className="size-3 mr-2 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            "Save Settings"
                          )}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* TAB 2: Codebase Q&A */}
            <TabsContent value="qa" className="space-y-4 outline-none">
              <Card className="border border-border/80 shadow-md">
                <CardHeader className="pb-3 border-b">
                  <div className="flex items-center gap-2 text-primary">
                    <Bot className="size-5" />
                    <CardTitle className="text-base">Codebase Assistant</CardTitle>
                  </div>
                  <CardDescription className="text-xs">
                    Ask questions in plain English about repository structure, functions, and logic.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <CodebaseQA projectId={projectId} commitsCount={commitsCount} />
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 3: Commit Insights */}
            <TabsContent value="commits" className="space-y-4 outline-none">
              <Card className="border border-border/80 shadow-md">
                <CardHeader className="pb-3 border-b">
                  <div className="flex items-center gap-2 text-primary">
                    <GitCommit className="size-5" />
                    <CardTitle className="text-base">Commit History & Insights</CardTitle>
                  </div>
                  <CardDescription className="text-xs">
                    View active branches commits and trigger AI summary analysis.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <CommitHistory projectId={projectId} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        ) : (
          <Card>
            <CardContent className="pt-6 text-center py-12">
              <AlertCircle className="size-8 text-amber-500 mx-auto mb-3" />
              <p className="text-sm font-medium">Repository connection was disconnected.</p>
              <Button onClick={() => setActiveSubView("list")} variant="outline" size="sm" className="mt-4">
                Back to Integrations
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Dashboard List View
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Puzzle className="size-5 text-blue-600" />
          Project Integrations
        </h3>
        <p className="text-xs text-muted-foreground">
          Manage integrations with third-party tools to connect repositories, notifications, and task pipelines.
        </p>
      </div>

      <DottedSeparator className="my-2" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* GitHub Integration Card */}
        <Card className="flex flex-col justify-between hover:border-blue-500/30 transition-all duration-200 group relative overflow-hidden bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-start">
              <div className="size-10 rounded-lg bg-neutral-900 flex items-center justify-center text-white">
                <Github className="size-5 animate-pulse" />
              </div>
              {repository ? (
                repository.status === "authenticating" || repository.githubUrl === "pending" ? (
                  <span className="bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-amber-500/20 animate-pulse">
                    Pending Link
                  </span>
                ) : (
                  <span className="bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Connected
                  </span>
                )
              ) : (
                <span className="bg-muted text-muted-foreground text-[10px] font-semibold px-2 py-0.5 rounded-full">
                  Disconnected
                </span>
              )}
            </div>
            <CardTitle className="text-sm font-semibold mt-3">GitHub</CardTitle>
            <CardDescription className="text-xs font-normal min-h-[48px] line-clamp-3">
              Track commits, sync pull request reviews, auto-merge branch changes, and auto-convert GitHub issues to backlog tasks.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {repository && repository.status !== "authenticating" && repository.githubUrl !== "pending" ? (
              <Button 
                onClick={() => setActiveSubView("github")}
                variant="secondary" 
                size="sm"
                className="w-full text-xs font-medium mt-2 group-hover:bg-blue-600 group-hover:text-white transition-all duration-200"
              >
                Configure Settings
                <ChevronRight className="size-3.5 ml-1.5 transition-transform group-hover:translate-x-0.5" />
              </Button>
            ) : (
              <div className="mt-2 w-full">
                {isAdmin ? (
                  <ConnectRepository projectId={projectId} canManage={isAdmin} />
                ) : (
                  <Button variant="outline" size="sm" className="w-full text-xs" disabled>
                    Admin Access Required
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Slack (Coming Soon) */}
        <Card className="opacity-60 bg-muted/10 flex flex-col justify-between border-dashed">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-start">
              <div className="size-10 rounded-lg bg-pink-600/10 flex items-center justify-center text-pink-600">
                <Slack className="size-5" />
              </div>
              <span className="bg-muted text-muted-foreground text-[10px] font-medium px-2 py-0.5 rounded-full">
                Coming Soon
              </span>
            </div>
            <CardTitle className="text-sm font-semibold mt-3 text-muted-foreground">Slack</CardTitle>
            <CardDescription className="text-xs font-normal min-h-[48px]">
              Receive project status notifications, ticket updates, and execute shortcuts directly from channels.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Button variant="outline" size="sm" className="w-full text-xs" disabled>
              Unavailable
            </Button>
          </CardContent>
        </Card>

        {/* Linear (Coming Soon) */}
        <Card className="opacity-60 bg-muted/10 flex flex-col justify-between border-dashed">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-start">
              <div className="size-10 rounded-lg bg-purple-600/10 flex items-center justify-center text-purple-600">
                <Layers className="size-5" />
              </div>
              <span className="bg-muted text-muted-foreground text-[10px] font-medium px-2 py-0.5 rounded-full">
                Coming Soon
              </span>
            </div>
            <CardTitle className="text-sm font-semibold mt-3 text-muted-foreground">Linear</CardTitle>
            <CardDescription className="text-xs font-normal min-h-[48px]">
              Sync ticket workflows, issues, and milestones bidirectionally between Linear and Fairlx.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Button variant="outline" size="sm" className="w-full text-xs" disabled>
              Unavailable
            </Button>
          </CardContent>
        </Card>

        {/* Jira (Coming Soon) */}
        <Card className="opacity-60 bg-muted/10 flex flex-col justify-between border-dashed">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-start">
              <div className="size-10 rounded-lg bg-blue-600/10 flex items-center justify-center text-blue-600">
                <FileText className="size-5" />
              </div>
              <span className="bg-muted text-muted-foreground text-[10px] font-medium px-2 py-0.5 rounded-full">
                Coming Soon
              </span>
            </div>
            <CardTitle className="text-sm font-semibold mt-3 text-muted-foreground">Jira Software</CardTitle>
            <CardDescription className="text-xs font-normal min-h-[48px]">
              Import Jira backlogs, map custom workflows, and sync sprints with Fairlx project boards.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Button variant="outline" size="sm" className="w-full text-xs" disabled>
              Unavailable
            </Button>
          </CardContent>
        </Card>

        {/* Figma (Coming Soon) */}
        <Card className="opacity-60 bg-muted/10 flex flex-col justify-between border-dashed">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-start">
              <div className="size-10 rounded-lg bg-amber-600/10 flex items-center justify-center text-amber-600">
                <Figma className="size-5" />
              </div>
              <span className="bg-muted text-muted-foreground text-[10px] font-medium px-2 py-0.5 rounded-full">
                Coming Soon
              </span>
            </div>
            <CardTitle className="text-sm font-semibold mt-3 text-muted-foreground">Figma</CardTitle>
            <CardDescription className="text-xs font-normal min-h-[48px]">
              Embed Figma file previews in specifications and reference live designs directly from tasks.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Button variant="outline" size="sm" className="w-full text-xs" disabled>
              Unavailable
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

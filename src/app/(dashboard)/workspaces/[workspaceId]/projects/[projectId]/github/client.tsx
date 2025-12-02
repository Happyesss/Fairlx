"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { Github, BookOpen, MessageSquare, GitCommit, Loader2, ExternalLink, Settings, FileText } from "lucide-react";

import { PageLoader } from "@/components/page-loader";
import { useProjectId } from "@/features/projects/hooks/use-project-id";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import {
  ConnectRepository,
  CodebaseQA,
  CommitHistory
} from "@/features/github-integration/components";
import { useGetRepository } from "@/features/github-integration";
import {
  getCommitsCount,
  saveCommitsToCache,
  readLegacyCommits,
  readLegacyCommitsCount,
  clearLegacyCommits,
  notifyCommitsUpdated,
  COMMIT_CACHE_CHANNEL,
} from "@/features/github-integration/lib/commit-cache";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";

export const GitHubIntegrationClient = () => {
  const projectId = useProjectId();
  const workspaceId = useWorkspaceId();
  const { data: repository, isLoading } = useGetRepository(projectId);
  const [commitsCount, setCommitsCount] = useState(0);
  const documentationPath = workspaceId
    ? `/workspaces/${workspaceId}/projects/${projectId}/github/documentation`
    : "#";

  const loadCommitsCount = useCallback(async () => {
    try {
      const count = await getCommitsCount(projectId);
      if (count > 0) {
        setCommitsCount(count);
        // console.log(`[CommitsCount] Updated to ${count}`);
        return;
      }

      const legacyCommits = readLegacyCommits(projectId);
      if (legacyCommits.length > 0) {
        setCommitsCount(legacyCommits.length);
        await saveCommitsToCache(projectId, legacyCommits);
        clearLegacyCommits(projectId);
        notifyCommitsUpdated(projectId);
        // console.log(`[CommitsCount] Migrated ${legacyCommits.length} legacy commits`);
        return;
      }

      const legacyCount = readLegacyCommitsCount(projectId);
      setCommitsCount(legacyCount);
      // console.log(`[CommitsCount] Loaded legacy count ${legacyCount}`);
    } catch (error) {
      console.error("Failed to load cached commits count:", error);
      setCommitsCount(0);
    }
  }, [projectId]);

  // Load commits count on mount and when project changes
  useEffect(() => {
    loadCommitsCount();
  }, [loadCommitsCount]);

  // Listen for commits updates
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleCommitsUpdate = (event: Event) => {
      const projectDetail = (event as CustomEvent<{ projectId?: string }>).detail?.projectId;
      if (projectDetail && projectDetail !== projectId) {
        return;
      }

      console.log(`[CommitsCount] Commits updated event received`);
      loadCommitsCount();
    };

    window.addEventListener('commitsUpdated', handleCommitsUpdate);

    let channel: BroadcastChannel | null = null;
    if ("BroadcastChannel" in window) {
      channel = new BroadcastChannel(COMMIT_CACHE_CHANNEL);
      channel.addEventListener('message', (event: MessageEvent<{ projectId?: string }>) => {
        if (event.data?.projectId && event.data.projectId !== projectId) {
          return;
        }

        console.log(`[CommitsCount] Broadcast channel event received`);
        loadCommitsCount();
      });
    }

    return () => {
      window.removeEventListener('commitsUpdated', handleCommitsUpdate);
      channel?.close();
    };
  }, [loadCommitsCount, projectId]);

  if (isLoading) {
    return <PageLoader />;
  }

  // No repository connected - show connection UI
  if (!repository) {
    return (
      <div className="flex flex-col gap-y-6 max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="text-center space-y-3 pt-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/10 via-blue-500/10 to-green-500/10 mb-4">
            <Github className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-400 bg-clip-text text-transparent">
            GitHub Integration
          </h1>
          <p className="text-base text-muted-foreground max-w-2xl mx-auto">
            Connect your GitHub repository to unlock AI-powered code insights
          </p>
        </div>

        {/* Main Connection Flow - n8n Style - Horizontal */}
        <div className="relative py-8">
          {/* Horizontal Connection Lines */}
          <div className="hidden lg:block">
            {/* Line from GitHub to Connect */}
            <div className="absolute top-1/2 left-[20%] w-[13%] h-0.5 bg-gradient-to-r from-blue-500/50 to-purple-500/50 -translate-y-1/2" />
            {/* Line from Connect to AI Processing */}
            <div className="absolute top-1/2 left-[47%] w-[13%] h-0.5 bg-gradient-to-r from-purple-500/50 to-purple-500/50 -translate-y-1/2" />
            {/* Line from AI Processing to Insights */}
            <div className="absolute top-1/2 left-[73%] w-[13%] h-0.5 bg-gradient-to-r from-purple-500/50 to-green-500/50 -translate-y-1/2" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8 items-center">
            {/* Step 1: GitHub Source */}
            <div className="relative flex justify-center lg:justify-end">
              <div className="group relative w-full max-w-sm">
                <div className="absolute -inset-1  rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-300" />
                <Card className="relative border-2 border-blue-500/20 hover:border-blue-500/40 transition-all duration-300 shadow-lg hover:shadow-xl">
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center">
                        <Github className="h-6 w-6 text-blue-500" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">GitHub</CardTitle>
                        <p className="text-xs text-muted-foreground">Source</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      Connect your repository to start
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Connect Button Node */}
            <div className="relative flex justify-center">
              <div className="relative z-20">
                <Card className="border-dashed border-2 border-primary/50 bg-gradient-to-br from-background to-primary/5 shadow-xl hover:shadow-2xl hover:border-primary transition-all duration-300">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base text-center">Connect</CardTitle>
                    <CardDescription className="text-xs text-center">
                      Link repository
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ConnectRepository projectId={projectId} />
                  </CardContent>
                </Card>
                {/* Connection node indicator */}
                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-8 h-8 bg-background border-2 border-primary rounded-full flex items-center justify-center shadow-lg">
                  <div className="w-4 h-4 bg-primary rounded-full animate-pulse" />
                </div>
              </div>
            </div>

            {/* Step 2: AI Processing */}
            <div className="relative flex justify-center">
              <div className="group relative w-full max-w-sm">
                <div className="absolute -inset-1  rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-300" />
                <Card className="relative border-2 border-purple-500/20 hover:border-purple-500/40 transition-all duration-300 shadow-lg hover:shadow-xl">
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 via-purple-500/20 to-purple-500/0 animate-shimmer" />
                        <BookOpen className="h-6 w-6 text-purple-500 relative z-10" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">AI Process</CardTitle>
                        <p className="text-xs text-muted-foreground">Transform</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                        <span>Code Analysis</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                        <span>Documentation</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Step 3: Insights Output */}
            <div className="relative flex justify-center lg:justify-start">
              <div className="group relative w-full max-w-sm">
                <div className="absolute -inset-1  rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-300" />
                <Card className="relative border-2 border-green-500/20 hover:border-green-500/40 transition-all duration-300 shadow-lg hover:shadow-xl">
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center">
                        <MessageSquare className="h-6 w-6 text-green-500" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Insights</CardTitle>
                        <p className="text-xs text-muted-foreground">Output</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        <span>Documentation</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        <span>Q&A</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <Card className="group relative overflow-hidden border-2 hover:border-blue-500/50 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader>
              <div className="relative">
                <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                  <BookOpen className="h-6 w-6 text-blue-500" />
                </div>
                <CardTitle className="text-lg">Auto Documentation</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Automatically generate comprehensive documentation from your codebase using AI
              </p>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden border-2 hover:border-green-500/50 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader>
              <div className="relative">
                <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                  <MessageSquare className="h-6 w-6 text-green-500" />
                </div>
                <CardTitle className="text-lg">Ask Questions</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Ask natural language questions about your codebase and get instant answers
              </p>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden border-2 hover:border-purple-500/50 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader>
              <div className="relative">
                <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                  <GitCommit className="h-6 w-6 text-purple-500" />
                </div>
                <CardTitle className="text-lg">Commit Insights</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Get AI-generated summaries of commits to understand changes quickly
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Repository connected - show full interface
  return (
    <div className="flex flex-col gap-y-8">
      <div className="flex items-center justify-between">

        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            GitHub Integration
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Github className="h-4 w-4" />
              <span className="font-medium text-sm">{repository.repositoryName}</span>
              <span className="text-xs">•</span>
              <span className="text-sm">Branch: {repository.branch}</span>
              <span className="text-xs">•</span>

            </div>
            <a
              href={repository.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
            >
              <ExternalLink className="h-3 w-3" />
              View on GitHub
            </a>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {repository.status === "syncing" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Syncing...</span>
            </div>
          )}

          {repository.status === "error" && (
            <div className="text-sm text-destructive">
              Error: {repository.error}
            </div>
          )}

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="!font-medium" size="xs">
                <Settings className="h-4 w-4 !font-medium" />
                Repository Details
              </Button>
            </SheetTrigger>

            <SheetContent className="w-full sm:max-w-md p-0">
              <SheetHeader className="pb-0 p-6 border-b">
                <SheetTitle className="text-lg font-semibold ">
                  Repository Details
                </SheetTitle>
                <SheetDescription className="text-sm font-normal  text-muted-foreground">
                  View and manage repository connection
                </SheetDescription>
              </SheetHeader>



              <div className="space-y-6 p-6">
                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium text-foreground">Owner</p>
                    <p className="text-sm text-muted-foreground break-words">{repository.owner}</p>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium text-foreground">Repository</p>
                    <p className="text-sm text-muted-foreground break-words">{repository.repositoryName}</p>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium text-foreground">Branch</p>
                    <p className="text-sm text-muted-foreground">{repository.branch}</p>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium text-foreground">GitHub URL</p>
                    <a
                      href={repository.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline break-all block transition-colors"
                    >
                      {repository.githubUrl}
                    </a>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium text-foreground">Connected At</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(repository.$createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium text-foreground">Last Synced</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(repository.lastSyncedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium text-foreground">Status</p>
                    <p className="text-sm text-muted-foreground capitalize">{repository.status}</p>
                  </div>
                </div>


              </div>
              <div className="pt-6 px-6 border-t ">
                <ConnectRepository projectId={projectId} isUpdate />
              </div>
            </SheetContent>
          </Sheet>

          <Button className="!font-medium" variant="outline" size="xs" asChild>
            <Link href={documentationPath} className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Documentation
            </Link>
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <CodebaseQA projectId={projectId} commitsCount={commitsCount} />
        <CommitHistory projectId={projectId} />
      </div>
    </div>
  );
};

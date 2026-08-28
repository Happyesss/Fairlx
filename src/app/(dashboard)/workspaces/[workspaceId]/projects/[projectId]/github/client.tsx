"use client";

import Link from "next/link";
import { Github, BookOpen, GitBranch, GitPullRequest, Loader2, ExternalLink, Settings, FileText, CheckCircle2, ArrowRight } from "lucide-react";

import { PageLoader } from "@/components/page-loader";
import { useProjectId } from "@/features/projects/hooks/use-project-id";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
} from "@/features/github-integration/components";
import { useGetRepository } from "@/features/github-integration";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useProjectPermissions } from "@/hooks/use-project-permissions";

export const GitHubIntegrationClient = () => {
  const projectId = useProjectId();
  const workspaceId = useWorkspaceId();
  const { data: repository, isLoading } = useGetRepository(projectId);
  const { isProjectAdmin } = useProjectPermissions({ projectId, workspaceId });
  const canManageGithub = isProjectAdmin;

  const documentationPath = workspaceId
    ? `/workspaces/${workspaceId}/projects/${projectId}/github/documentation`
    : "#";

  if (isLoading) {
    return <PageLoader />;
  }

  // No repository connected - show connection UI
  if (!repository) {
    return (
      <div className="flex flex-col gap-y-6 max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="text-center space-y-3 pt-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/10 via-blue-500/10 to-green-500/10 mb-4">
            <Github className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            GitHub Integration
          </h1>
          <p className="text-base text-muted-foreground max-w-2xl mx-auto">
            Connect your GitHub repository to generate automated documentation and synchronize issues and commits with your tasks
          </p>
        </div>

        {/* Main Connection Flow */}
        <div className="relative py-8">
          <div className="hidden lg:block">
            {/* Horizontal Connection Lines */}
            <div className="absolute top-1/2 left-[28%] w-[18%] h-0.5 bg-gradient-to-r from-blue-500/50 to-purple-500/50 -translate-y-1/2" />
            <div className="absolute top-1/2 left-[54%] w-[18%] h-0.5 bg-gradient-to-r from-purple-500/50 to-emerald-500/50 -translate-y-1/2" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-center">
            {/* Step 1: Connect Repository */}
            <div className="relative flex justify-center">
              <div className="relative z-20 w-full max-w-sm">
                <Card className="border-dashed border-2 border-primary/50 bg-gradient-to-br from-background to-primary/5 shadow-xl hover:shadow-2xl hover:border-primary transition-all duration-300">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base text-center">Connect</CardTitle>
                    <CardDescription className="text-xs text-center">
                      Link repository
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ConnectRepository projectId={projectId} canManage={canManageGithub} />
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Step 2: Auto Documentation */}
            <div className="relative flex justify-center">
              <div className="group relative w-full max-w-sm">
                <Card className="relative border-2 border-indigo-500/20 hover:border-indigo-500/40 transition-all duration-300 shadow-lg hover:shadow-xl">
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center">
                        <BookOpen className="h-6 w-6 text-indigo-500" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Auto Docs</CardTitle>
                        <p className="text-xs text-muted-foreground">AI Powered</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                        <span>Architecture Manuals</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                        <span>API Specifications</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Step 3: Task Synchronization */}
            <div className="relative flex justify-center">
              <div className="group relative w-full max-w-sm">
                <Card className="relative border-2 border-emerald-500/20 hover:border-emerald-500/40 transition-all duration-300 shadow-lg hover:shadow-xl">
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                        <GitPullRequest className="h-6 w-6 text-emerald-500" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Task Sync</CardTitle>
                        <p className="text-xs text-muted-foreground">Automated</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span>Commits & PRs Linking</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span>GitHub Issues to Backlog</span>
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
          <Card className="group relative overflow-hidden border-2 hover:border-cyan-500/50 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader>
              <div className="relative">
                <div className="w-12 h-12 bg-cyan-500/10 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                  <BookOpen className="h-6 w-6 text-cyan-600" />
                </div>
                <CardTitle className="text-lg">Auto Documentation</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Automatically generate comprehensive documentation and architecture manuals from your codebase using AI
              </p>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden border-2 hover:border-emerald-500/50 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader>
              <div className="relative">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                  <GitPullRequest className="h-6 w-6 text-emerald-600" />
                </div>
                <CardTitle className="text-lg">Task & Issue Sync</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Link GitHub commits, PRs, and issues seamlessly to tasks in your workspace backlog
              </p>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden border-2 hover:border-indigo-500/50 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader>
              <div className="relative">
                <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                  <GitBranch className="h-6 w-6 text-indigo-600" />
                </div>
                <CardTitle className="text-lg">Branch & Release Tracking</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Monitor development branches and tag releases to track deployment milestones
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-4">
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
                <SheetTitle className="text-lg font-semibold">
                  Repository Details
                </SheetTitle>
                <SheetDescription className="text-sm font-normal text-muted-foreground">
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
              <div className="pt-6 px-6 border-t">
                <ConnectRepository projectId={projectId} isUpdate canManage={canManageGithub} />
              </div>
            </SheetContent>
          </Sheet>

          <Button className="!font-medium bg-blue-600 hover:bg-blue-700 text-white border-0" size="xs" asChild>
            <Link href={documentationPath} className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Documentation
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Auto Documentation Card */}
        <Card className="border border-border/80 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600">
                <BookOpen className="size-5" />
              </div>
              <div>
                <CardTitle className="text-base">Auto Documentation</CardTitle>
                <CardDescription className="text-xs">
                  AI-generated technical documentation & architecture manuals
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Analyze your repository structure, technologies, and interfaces to produce comprehensive markdown documentation with export capabilities.
            </p>
            <Button size="sm" className="w-full sm:w-auto" asChild>
              <Link href={documentationPath} className="flex items-center gap-2">
                <FileText className="size-4" />
                View & Generate Documentation
                <ArrowRight className="size-3.5 ml-1" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Repository Status & Connection Card */}
        <Card className="border border-border/80 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-green-500/10 text-green-600">
                <CheckCircle2 className="size-5" />
              </div>
              <div>
                <CardTitle className="text-base">Connection Status</CardTitle>
                <CardDescription className="text-xs">
                  Active synchronization details
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded-lg bg-muted/50 border space-y-1">
                <span className="text-muted-foreground">Repository</span>
                <p className="font-semibold truncate">{repository.owner}/{repository.repositoryName}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-muted/50 border space-y-1">
                <span className="text-muted-foreground">Active Branch</span>
                <p className="font-mono font-semibold truncate">{repository.branch}</p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-2">
              <Badge variant="outline" className="text-green-600 border-green-500/30 bg-green-500/10 gap-1.5 py-1">
                <span className="size-1.5 rounded-full bg-green-500 animate-pulse" />
                Connected
              </Badge>
              <span className="text-xs text-muted-foreground">
                Synced {new Date(repository.lastSyncedAt).toLocaleDateString()}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

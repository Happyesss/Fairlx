"use client";

import { useGetTaskGitHubEvents } from "../api/use-github";
import { GitCommit, GitPullRequest, ExternalLink, Calendar, GitBranch, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader } from "@/components/page-loader";
import { formatDistanceToNow } from "date-fns";

interface TaskGitHubEventsProps {
  taskKey: string;
}

export const TaskGitHubEvents = ({ taskKey }: TaskGitHubEventsProps) => {
  const { data, isLoading, error } = useGetTaskGitHubEvents(taskKey);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <PageLoader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-destructive p-4 border border-destructive/20 rounded-md bg-destructive/5 text-sm">
        <ShieldAlert className="size-4 shrink-0" />
        <span>Failed to load development events: {(error as Error).message}</span>
      </div>
    );
  }

  const commits = data?.commits || [];
  const pullRequests = data?.pullRequests || [];

  if (commits.length === 0 && pullRequests.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed bg-muted/10">
        <GitBranch className="size-12 mx-auto mb-4 opacity-30 stroke-[1.5]" />
        <h3 className="font-semibold text-sm text-foreground">No development events</h3>
        <p className="text-xs max-w-xs mx-auto mt-1">
          Link commits and pull requests by referencing the task key <Badge variant="outline" className="font-mono text-[10px]">{taskKey.toUpperCase()}</Badge> in commit messages or branch names.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pull Requests Section */}
      {pullRequests.length > 0 && (
        <Card className="border-border/50 shadow-none">
          <CardHeader className="py-4 px-5 border-b bg-muted/10">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <GitPullRequest className="size-4 text-purple-500" />
              Pull Requests ({pullRequests.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Linked pull requests for this task.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 divide-y">
            {pullRequests.map((pr) => {
              const stateColorMap = {
                open: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
                merged: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20",
                closed: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20",
              };

              const prState = pr.prState?.toLowerCase() as keyof typeof stateColorMap || "open";

              return (
                <div key={pr.$id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/5 transition-colors">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <a
                        href={pr.prUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-sm text-foreground hover:text-primary hover:underline flex items-center gap-1.5"
                      >
                        {pr.prTitle}
                        <ExternalLink className="size-3 shrink-0 opacity-50" />
                      </a>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span className="font-semibold text-foreground">#{pr.prNumber}</span>
                      <span>in <span className="font-mono text-[11px]">{pr.repoFullName}</span></span>
                      <span className="flex items-center gap-1">
                        <GitBranch className="size-3" />
                        <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">{pr.branchName}</code>
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 self-start sm:self-center">
                    <Badge variant="outline" className={`${stateColorMap[prState]} capitalize text-[10px] px-2 py-0.5`}>
                      {pr.prState}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(pr.processedAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Commits Section */}
      {commits.length > 0 && (
        <Card className="border-border/50 shadow-none">
          <CardHeader className="py-4 px-5 border-b bg-muted/10">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <GitCommit className="size-4 text-blue-500" />
              Commits ({commits.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Linked commits in repository.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 divide-y">
            {commits.map((commit) => (
              <div key={commit.$id} className="p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4 hover:bg-muted/5 transition-colors">
                <div className="flex gap-3 min-w-0 flex-1">
                  <Avatar className="size-7 border">
                    <AvatarFallback className="text-[10px] bg-blue-500/5 text-blue-600">
                      {commit.authorName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <p className="text-sm text-foreground font-medium break-words pr-2">
                      {commit.commitMessage}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span className="font-medium text-foreground">{commit.authorName}</span>
                      <span className="flex items-center gap-1 font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded">
                        <GitBranch className="size-3 text-muted-foreground" />
                        {commit.branchName}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3" />
                        {formatDistanceToNow(new Date(commit.processedAt), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center self-start sm:self-start gap-1">
                  <a
                    href={commit.commitUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-xs bg-muted hover:bg-muted/80 text-blue-600 hover:underline px-2.5 py-1 rounded border hover:border-blue-300 transition-all flex items-center gap-1"
                  >
                    {commit.commitSha.slice(0, 7)}
                    <ExternalLink className="size-2.5 opacity-55" />
                  </a>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

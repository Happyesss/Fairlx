"use client";

import React, { useState, useMemo } from "react";
import { 
  AlertCircle, 
  ExternalLink, 
  Github, 
  Search, 
  ArrowRight,
  Loader
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useGetRepository } from "@/features/github-integration/api/use-github";
import { useGetGitHubIssues } from "@/features/github-integration/api/use-github";
import { useTaskPreviewModal } from "@/features/tasks/hooks/use-task-preview-modal";
import { PopulatedTask } from "@/features/tasks/types";

interface ProjectIssuesViewProps {
  projectId: string;
  tasks?: PopulatedTask[];
}

export function ProjectIssuesView({ projectId, tasks = [] }: ProjectIssuesViewProps) {
  const { data: repository, isLoading: isLoadingRepo } = useGetRepository(projectId);
  const { data: issues, isLoading: isLoadingIssues } = useGetGitHubIssues(projectId, !!repository);
  const { open: openPreview } = useTaskPreviewModal();

  const [searchTerm, setSearchTerm] = useState("");
  const [stateFilter, setStateFilter] = useState<"all" | "open" | "closed">("all");

  const taskMap = useMemo(() => {
    const map = new Map<string, PopulatedTask>();
    tasks.forEach(t => {
      map.set(t.$id, t);
    });
    return map;
  }, [tasks]);

  const filteredIssues = useMemo(() => {
    if (!issues) return [];
    return issues.filter(issue => {
      const matchesSearch = 
        issue.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        issue.number.toString().includes(searchTerm);
      
      const matchesState = 
        stateFilter === "all" || 
        issue.state === stateFilter;

      return matchesSearch && matchesState;
    });
  }, [issues, searchTerm, stateFilter]);

  if (isLoadingRepo || isLoadingIssues) {
    return (
      <div className="h-[350px] w-full flex flex-col items-center justify-center gap-2">
        <Loader className="size-6 animate-spin text-blue-600" />
        <span className="text-sm text-muted-foreground font-medium">Loading GitHub issues...</span>
      </div>
    );
  }

  if (!repository) {
    return (
      <Card className="max-w-md mx-auto mt-8 border border-dashed border-border bg-muted/20">
        <CardContent className="pt-6 text-center space-y-4">
          <div className="size-12 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto text-blue-600">
            <Github className="size-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-lg">No GitHub Repository Connected</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Connect this project to a GitHub repository in Project Settings to sync, view, and track issues live.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const openCount = issues?.filter(i => i.state === "open").length || 0;
  const closedCount = issues?.filter(i => i.state === "closed").length || 0;

  return (
    <div className="space-y-6 p-4">
      {/* Repository Header Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border bg-card/50 shadow-sm backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-foreground/5 flex items-center justify-center text-foreground">
            <Github className="size-5" />
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-base text-foreground">
                {repository.owner}/{repository.repositoryName}
              </h4>
              <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/30">
                Connected
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              Active branch: <span className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded">{repository.branch}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild className="h-8 text-xs gap-1.5">
            <a href={repository.githubUrl} target="_blank" rel="noopener noreferrer">
              View Repository
              <ExternalLink className="size-3" />
            </a>
          </Button>
          {!repository.createTasksFromIssues && (
            <div className="flex items-center gap-1.5 text-amber-500 text-xs bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-500/20">
              <AlertCircle className="size-3.5" />
              <span>Issues auto-import is disabled</span>
            </div>
          )}
        </div>
      </div>

      {/* Metrics and Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* State Tabs */}
        <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border">
          <button
            onClick={() => setStateFilter("all")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              stateFilter === "all" 
                ? "bg-card text-foreground shadow-sm" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All ({issues?.length || 0})
          </button>
          <button
            onClick={() => setStateFilter("open")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              stateFilter === "open" 
                ? "bg-card text-emerald-600 shadow-sm font-semibold" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Open ({openCount})
          </button>
          <button
            onClick={() => setStateFilter("closed")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              stateFilter === "closed" 
                ? "bg-card text-purple-600 shadow-sm font-semibold" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Closed ({closedCount})
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search issues..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      {/* Issues Grid */}
      {filteredIssues.length === 0 ? (
        <div className="h-[200px] w-full flex flex-col items-center justify-center gap-2 border border-dashed rounded-xl bg-muted/10">
          <AlertCircle className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground font-medium">
            {searchTerm ? "No matching issues found" : "No issues synced yet"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredIssues.map((issue) => {
            const mappedTask = issue.task || (issue.taskId ? taskMap.get(issue.taskId) : null);

            return (
              <Card 
                key={issue.$id}
                className="overflow-hidden hover:shadow-md transition-all border border-border bg-card/60 duration-200"
              >
                <CardHeader className="p-4 pb-2 space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        #{issue.number}
                      </span>
                      <Badge 
                        variant="secondary"
                        className={`text-[10px] font-semibold uppercase tracking-wider py-0.5 px-2 ${
                          issue.state === "open"
                            ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                            : "bg-purple-500/10 text-purple-600 border border-purple-500/20"
                        }`}
                      >
                        {issue.state}
                      </Badge>
                    </div>
                    
                    <a 
                      href={issue.htmlUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground transition-colors p-1 hover:bg-muted rounded"
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                  </div>

                  <CardTitle className="text-sm font-semibold leading-snug text-foreground line-clamp-2">
                    {issue.title}
                  </CardTitle>
                </CardHeader>
                
                <CardContent className="p-4 pt-2 space-y-3">
                  {/* Mapping Details */}
                  {mappedTask ? (
                    <div 
                      onClick={() => openPreview(mappedTask.$id)}
                      className="flex items-center justify-between p-2 rounded-lg bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/10 cursor-pointer transition-all duration-200 group"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400 group-hover:underline">
                          {mappedTask.key}
                        </span>
                        <span className="text-[11px] text-muted-foreground max-w-[140px] truncate">
                          {mappedTask.title}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] bg-card uppercase text-muted-foreground font-medium border-border">
                          {mappedTask.status.replace("_", " ")}
                        </Badge>
                        <ArrowRight className="size-3 text-blue-600 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  ) : (
                    <div className="p-2 rounded-lg bg-muted/30 border border-dashed border-border flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground italic">
                        Not linked to active work item
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t pt-2.5">
                    <span>
                      Repo: {issue.repoFullName.split("/")[1] || issue.repoFullName}
                    </span>
                    {issue.processedAt && (
                      <span>
                        Synced: {new Date(issue.processedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

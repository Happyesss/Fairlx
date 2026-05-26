"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useGetMySpaceProjects } from "@/features/my-space/api/use-get-my-space-projects";
import { useCurrentMember } from "@/features/members/hooks/use-current-member";
import { useCurrent } from "@/features/auth/api/use-current";
import {
    Users,
    FileText,
    Settings,
    Briefcase,
    Loader2,
    FolderOpen,
} from "lucide-react";
import Link from "next/link";

// Dynamically import heavy components
const TaskViewSwitcher = dynamic(
    () =>
        import("@/features/tasks/components/task-view-switcher").then(
            (mod) => mod.TaskViewSwitcher
        ),
    {
        ssr: false,
        loading: () => <Skeleton className="h-[400px] w-full" />,
    }
);

const ProjectTeamsList = dynamic(
    () =>
        import(
            "@/features/project-teams/components/project-teams-list"
        ).then((mod) => mod.ProjectTeamsList),
    {
        loading: () => (
            <div className="h-[200px] flex items-center justify-center">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
        ),
    }
);

const DocumentList = dynamic(
    () =>
        import("@/features/project-docs/components/document-list").then(
            (mod) => mod.DocumentList
        ),
    {
        loading: () => (
            <div className="h-[200px] flex items-center justify-center">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
        ),
    }
);

// Top-level tab config
const TOP_TABS = [
    { id: "work", label: "Work", icon: Briefcase },
    { id: "teams", label: "Teams", icon: Users },
    { id: "docs", label: "Docs", icon: FileText },
    { id: "settings", label: "Settings", icon: Settings },
] as const;

type TopTab = (typeof TOP_TABS)[number]["id"];

export const MySpaceClient = () => {
    const [activeTab, setActiveTab] = useState<TopTab>("work");
    const workspaceId = useWorkspaceId();
    const { data: projectsData, isLoading: isLoadingProjects } = useGetMySpaceProjects();
    const { isAdmin: _isAdmin } = useCurrentMember({ workspaceId });
    const { data: user } = useCurrent();

    const projects = projectsData?.documents ?? [];

    const firstName = user?.name ? user.name.trim().split(/\s+/)[0] : "";
    const displayTitle = firstName ? `${firstName}'s Space` : "My Space";

    return (
        <div className="flex flex-col gap-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex gap-x-2 flex-col items-start gap-y-1.5">
                    <p className="text-2xl tracking-tight font-semibold">{displayTitle}</p>
                    <p className="text-sm tracking-normal font-medium text-muted-foreground">
                        Your assigned work across all projects
                    </p>
                </div>
            </div>

            {/* Top-level tabs */}
            <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as TopTab)}
                className="w-full"
            >
                <div className="flex gap-1 border-b border-border pb-0 overflow-x-auto">
                    {TOP_TABS.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${isActive
                                    ? "border-primary text-foreground"
                                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                                    }`}
                            >
                                <Icon className="size-4" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Work Tab — TaskViewSwitcher with all views */}
                <TabsContent value="work" className="mt-4">
                    <TaskViewSwitcher showMyTasksOnly={true} />
                </TabsContent>

                {/* Teams Tab — Grouped by project */}
                <TabsContent value="teams" className="mt-4">
                    {isLoadingProjects ? (
                        <div className="flex items-center justify-center h-48">
                            <Loader2 className="size-5 animate-spin text-muted-foreground" />
                        </div>
                    ) : projects.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <Users className="h-10 w-10 text-muted-foreground/30 mb-3" />
                            <h3 className="text-sm font-medium text-foreground">
                                No project teams
                            </h3>
                            <p className="text-xs text-muted-foreground mt-1">
                                You are not part of any project yet
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {projects.map((project) => (
                                <div key={project.$id} className="space-y-3">
                                    <div className="flex items-center gap-2 px-1">
                                        <div className="size-6 rounded bg-muted flex items-center justify-center text-xs font-semibold">
                                            {project.name?.[0]?.toUpperCase() ?? "P"}
                                        </div>
                                        <h3 className="text-sm font-semibold text-foreground">
                                            {project.name}
                                        </h3>
                                    </div>
                                    <div className="border rounded-lg p-4 bg-card">
                                        <ProjectTeamsList
                                            projectId={project.$id}
                                            canManage={false}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </TabsContent>

                {/* Docs Tab — Grouped by project */}
                <TabsContent value="docs" className="mt-4">
                    {isLoadingProjects ? (
                        <div className="flex items-center justify-center h-48">
                            <Loader2 className="size-5 animate-spin text-muted-foreground" />
                        </div>
                    ) : projects.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <FolderOpen className="h-10 w-10 text-muted-foreground/30 mb-3" />
                            <h3 className="text-sm font-medium text-foreground">
                                No project documents
                            </h3>
                            <p className="text-xs text-muted-foreground mt-1">
                                You are not part of any project yet
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {projects.map((project) => (
                                <div key={project.$id} className="space-y-3">
                                    <div className="flex items-center gap-2 px-1">
                                        <div className="size-6 rounded bg-muted flex items-center justify-center text-xs font-semibold">
                                            {project.name?.[0]?.toUpperCase() ?? "P"}
                                        </div>
                                        <h3 className="text-sm font-semibold text-foreground">
                                            {project.name}
                                        </h3>
                                    </div>
                                    <div className="border rounded-lg p-4 bg-card">
                                        <DocumentList
                                            projectId={project.$id}
                                            workspaceId={project.workspaceId}
                                            readOnly={true}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </TabsContent>

                {/* Settings Tab — Link to personal settings */}
                <TabsContent value="settings" className="mt-4">
                    <div className="border rounded-lg bg-card p-4 sm:p-6 space-y-6">
                        <div>
                            <h3 className="text-lg font-semibold mb-1">Personal Settings</h3>
                            <p className="text-sm text-muted-foreground">
                                Manage your account, profile, and workspace preferences
                            </p>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            <Link
                                href="/profile"
                                className="flex items-start gap-3 p-4 rounded-lg border border-border hover:border-primary/30 hover:bg-primary/5 transition-colors group"
                            >
                                <div className="size-10 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                                    <Users className="size-5 text-blue-500" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium group-hover:text-primary transition-colors">
                                        Profile
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Update your name, avatar, and bio
                                    </p>
                                </div>
                            </Link>

                            <Link
                                href="/profile/accountinfo"
                                className="flex items-start gap-3 p-4 rounded-lg border border-border hover:border-primary/30 hover:bg-primary/5 transition-colors group"
                            >
                                <div className="size-10 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                                    <Settings className="size-5 text-emerald-500" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium group-hover:text-primary transition-colors">
                                        Account
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Email, password, and security settings
                                    </p>
                                </div>
                            </Link>


                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
};

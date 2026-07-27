"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Loader2, Shield } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ProjectPermissionKey } from "@/lib/permissions/types";

import { useProjectId } from "@/features/projects/hooks/use-project-id";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useGetProjectTeams } from "@/features/project-teams/api/use-get-project-teams";
import { useGetProjectRoles } from "@/features/project-members/api/use-get-project-roles";
import { useGetProjectTeamPermissions } from "@/features/project-teams/api/use-get-project-team-permissions";
import { useUpdateProjectTeamPermissions } from "@/features/project-teams/api/use-update-project-team-permissions";
import { useUpdateProjectRole } from "@/features/project-members/api/use-update-project-role";


// Group permissions for better UI
const PERMISSION_GROUPS = [
    {
        title: "Project",
        permissions: [
            { key: ProjectPermissionKey.VIEW_PROJECT, label: "View Project" },
            { key: ProjectPermissionKey.EDIT_SETTINGS, label: "Edit Settings" },
            { key: ProjectPermissionKey.DELETE_PROJECT, label: "Delete Project" },
        ],
    },
    {
        title: "Work Items",
        permissions: [
            { key: ProjectPermissionKey.VIEW_TASKS, label: "View Work Items" },
            { key: ProjectPermissionKey.CREATE_TASKS, label: "Create Work Item" },
            { key: ProjectPermissionKey.EDIT_TASKS, label: "Edit Work Item" },
            { key: ProjectPermissionKey.DELETE_TASKS, label: "Delete Work Item" },
        ],
    },
    {
        title: "Sprints",
        permissions: [
            { key: ProjectPermissionKey.VIEW_SPRINTS, label: "View Sprints" },
            { key: ProjectPermissionKey.CREATE_SPRINTS, label: "Create Sprints" },
            { key: ProjectPermissionKey.EDIT_SPRINTS, label: "Edit Sprints" },
            { key: ProjectPermissionKey.DELETE_SPRINTS, label: "Delete Sprints" },
            { key: ProjectPermissionKey.START_SPRINT, label: "Start Sprint" },
            { key: ProjectPermissionKey.COMPLETE_SPRINT, label: "Complete Sprint" },
        ],
    },
    {
        title: "Members & Teams",
        permissions: [
            { key: ProjectPermissionKey.VIEW_MEMBERS, label: "View Members" },
            { key: ProjectPermissionKey.MANAGE_MEMBERS, label: "Manage Members" },
            { key: ProjectPermissionKey.MANAGE_TEAMS, label: "Manage Teams" },
            { key: ProjectPermissionKey.MANAGE_PERMISSIONS, label: "Manage Permissions" },
        ],
    },
    {
        title: "Documents",
        permissions: [
            { key: ProjectPermissionKey.VIEW_DOCS, label: "View Documents" },
            { key: ProjectPermissionKey.CREATE_DOCS, label: "Create Documents" },
            { key: ProjectPermissionKey.EDIT_DOCS, label: "Edit Documents" },
            { key: ProjectPermissionKey.DELETE_DOCS, label: "Delete Documents" },
        ],
    },
];

export const ProjectPermissionsEditor = () => {
    const projectId = useProjectId();
    const workspaceId = useWorkspaceId();

    const [activeTab, setActiveTab] = useState<"roles" | "teams">("roles");
    const [selectedEntityId, setSelectedEntityId] = useState<string>("");
    const [permissions, setPermissions] = useState<string[]>([]);
    const [hasChanges, setHasChanges] = useState(false);
    const [initialPermissions, setInitialPermissions] = useState<string[]>([]);

    // Queries
    const { data: teamsData, isLoading: isLoadingTeams } = useGetProjectTeams({ projectId });
    const { data: rolesData, isLoading: isLoadingRoles } = useGetProjectRoles({ projectId, workspaceId });

    const teams = useMemo(() => teamsData?.documents ?? [], [teamsData]);
    const roles = useMemo(() => rolesData?.documents ?? [], [rolesData]);

    // Get the active role (for roles tab)
    const activeRole = useMemo(() => {
        if (activeTab === "roles" && selectedEntityId) {
            return roles.find(r => r.$id === selectedEntityId);
        }
        return null;
    }, [activeTab, selectedEntityId, roles]);

    // Check if selected role is "Owner" - Owner should have all permissions and be non-editable
    const isOwnerRole = useMemo(() => {
        return activeRole?.name?.toLowerCase() === "owner";
    }, [activeRole]);

    // Handle initial selection when data loads or tab changes
    useEffect(() => {
        if (activeTab === "roles" && roles.length > 0 && !selectedEntityId) {
            setSelectedEntityId(roles[0].$id);
        } else if (activeTab === "teams" && teams.length > 0 && !selectedEntityId) {
            setSelectedEntityId(teams[0].$id);
        }
    }, [activeTab, roles, teams, selectedEntityId]);

    // Fetch permissions for selected team
    const { 
        data: teamPermissionsData, 
        isLoading: isLoadingTeamPermissions,
        isFetched: teamPermissionsFetched 
    } = useGetProjectTeamPermissions({
        teamId: activeTab === "teams" && selectedEntityId ? selectedEntityId : ""
    });

    // Sync permissions state when selection changes or data loads
    useEffect(() => {
        if (activeTab === "roles" && activeRole) {
            const rolePerms = activeRole.permissions || [];
            setPermissions(rolePerms);
            setInitialPermissions(rolePerms);
            setHasChanges(false);
        } else if (activeTab === "teams" && selectedEntityId && teamPermissionsFetched) {
            const teamPerms = teamPermissionsData || [];
            setPermissions(teamPerms);
            setInitialPermissions(teamPerms);
            setHasChanges(false);
        }
    }, [activeTab, activeRole, teamPermissionsData, selectedEntityId, teamPermissionsFetched]);

    // Mutations
    const { mutate: updateRole, isPending: isUpdatingRole } = useUpdateProjectRole();
    const { mutate: updateTeamPermissions, isPending: isUpdatingTeam } = useUpdateProjectTeamPermissions({ 
        teamId: selectedEntityId || "" 
    });

    const handleTogglePermission = useCallback((key: string) => {
        // Don't allow changes if it's the Owner role
        if (isOwnerRole) return;
        
        setPermissions(prev => {
            const next = prev.includes(key)
                ? prev.filter(k => k !== key)
                : [...prev, key];
            return next;
        });
        setHasChanges(true);
    }, [isOwnerRole]);

    const handleSave = useCallback(() => {
        if (!selectedEntityId) return;
        
        if (activeTab === "roles") {
            updateRole({
                roleId: selectedEntityId,
                json: { permissions }
            }, {
                onSuccess: () => {
                    setHasChanges(false);
                    setInitialPermissions(permissions);
                }
            });
        } else {
            updateTeamPermissions({ permissions }, {
                onSuccess: () => {
                    setHasChanges(false);
                    setInitialPermissions(permissions);
                }
            });
        }
    }, [activeTab, selectedEntityId, permissions, updateRole, updateTeamPermissions]);

    const handleCancel = useCallback(() => {
        setPermissions(initialPermissions);
        setHasChanges(false);
    }, [initialPermissions]);

    const handleTabChange = useCallback((value: string) => {
        // Reset state when switching tabs
        setActiveTab(value as "roles" | "teams");
        setSelectedEntityId("");
        setPermissions([]);
        setHasChanges(false);
        setInitialPermissions([]);
    }, []);

    const handleSelectEntity = useCallback((id: string) => {
        if (hasChanges) {
            // Optionally confirm before switching
            // For now, just warn and switch
        }
        setSelectedEntityId(id);
        setHasChanges(false);
    }, [hasChanges]);

    const isUpdating = isUpdatingRole || isUpdatingTeam;

    if (isLoadingTeams || isLoadingRoles) {
        return (
            <div className="flex justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    // Show loading state when switching entities or loading permissions
    const isLoadingPermissions = activeTab === "teams" && selectedEntityId && isLoadingTeamPermissions;

    return (
        <Card className="h-full border-none shadow-none">
            <CardHeader className="px-0 pt-0">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Permissions & Access Control</CardTitle>
                        <CardDescription>
                            Configure granular permissions for Project Roles and Teams.
                        </CardDescription>
                    </div>
                    {hasChanges && (
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-5">
                            <span className="text-sm text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-500 px-2 py-1 rounded">
                                Unsaved changes
                            </span>
                            <Button variant="outline" size="sm" onClick={handleCancel} disabled={isUpdating}>
                                Cancel
                            </Button>
                            <Button size="sm" onClick={handleSave} disabled={isUpdating}>
                                {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Changes
                            </Button>
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardContent className="px-0">
                <Tabs value={activeTab} onValueChange={handleTabChange}>
                    <TabsList>
                        <TabsTrigger value="roles" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Run by Role</TabsTrigger>
                        <TabsTrigger value="teams" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Run by Team</TabsTrigger>
                    </TabsList>

                    <div className="mt-6">
                        <div className="flex flex-col md:flex-row gap-6">
                            {/* Selector Sidebar */}
                            <div className="w-full md:w-64 space-y-4">
                                <Label>
                                    Select {activeTab === "roles" ? "Role" : "Team"}
                                </Label>
                                <div className="space-y-1">
                                    {activeTab === "roles" ? (
                                        roles.length === 0 ? (
                                            <div className="text-sm text-muted-foreground p-2">No roles found.</div>
                                        ) : (
                                            roles.map(role => (
                                                <button
                                                    key={role.$id}
                                                    onClick={() => handleSelectEntity(role.$id)}
                                                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-between group ${selectedEntityId === role.$id
                                                        ? "bg-blue-600 text-white shadow-md shadow-blue-900/20"
                                                        : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                                                        }`}
                                                >
                                                    <span>{role.name}</span>
                                                    {role.isDefault && (
                                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors ${selectedEntityId === role.$id
                                                            ? "bg-white/20 text-white"
                                                            : "bg-muted text-muted-foreground group-hover:bg-muted-foreground/10"
                                                            }`}>
                                                            Default
                                                        </span>
                                                    )}
                                                </button>
                                            ))
                                        )
                                    ) : (
                                        teams.length === 0 ? (
                                            <div className="text-sm text-muted-foreground p-2">No teams found. Create a team first.</div>
                                        ) : (
                                            teams.map(team => (
                                                <button
                                                    key={team.$id}
                                                    onClick={() => handleSelectEntity(team.$id)}
                                                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${selectedEntityId === team.$id
                                                        ? "bg-blue-600 text-white"
                                                        : "hover:bg-muted text-foreground"
                                                        }`}
                                                >
                                                    {team.name}
                                                </button>
                                            ))
                                        )
                                    )}
                                </div>
                            </div>

                            {/* Permissions Grid */}
                            <div className="flex-1 border rounded-lg p-6 bg-card">
                                {isLoadingPermissions ? (
                                    <div className="flex justify-center items-center h-48">
                                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                    </div>
                                ) : selectedEntityId ? (
                                    <div className="space-y-6">
                                        {/* Owner role warning */}
                                        {isOwnerRole && (
                                            <Alert>
                                                <Shield className="h-4 w-4" />
                                                <AlertDescription>
                                                    Owner role has all permissions and cannot be modified.
                                                </AlertDescription>
                                            </Alert>
                                        )}
                                        
                                        <div className="grid gap-8">
                                            {PERMISSION_GROUPS.map((group) => (
                                                <div key={group.title}>
                                                    <h4 className="font-medium mb-4 pb-2 border-b text-sm text-muted-foreground tracking-tight">
                                                        {group.title}
                                                    </h4>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {group.permissions.map((perm) => (
                                                            <div key={perm.key} className="flex items-start gap-3">
                                                                <Checkbox
                                                                    id={perm.key}
                                                                    checked={permissions.includes(perm.key)}
                                                                    onCheckedChange={() => handleTogglePermission(perm.key)}
                                                                    disabled={isOwnerRole || isUpdating}
                                                                />
                                                                <div className="grid gap-1.5 leading-none">
                                                                    <Label
                                                                        htmlFor={perm.key}
                                                                        className={`text-sm font-medium leading-none ${isOwnerRole ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
                                                                    >
                                                                        {perm.label}
                                                                    </Label>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-muted-foreground">
                                        Select a {activeTab === "roles" ? "role" : "team"} to configure permissions
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </Tabs>
            </CardContent>
        </Card>
    );
};

"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { client } from "@/lib/rpc";
import { ProjectPermissionResult } from "@/features/project-members/types";
import { PROJECT_PERMISSIONS } from "@/lib/project-permissions";
import { ProjectPermissionKey } from "@/lib/permissions/types";

interface UseProjectPermissionsProps {
    projectId: string | null | undefined;
    workspaceId?: string | null;
}

/**
 * Hook to get user's permissions for a specific project.
 * 
 * Usage:
 * ```tsx
 * const { can, isLoading, isProjectAdmin } = useProjectPermissions({ projectId });
 * 
 * if (can("task.create")) {
 *   // Show create button
 * }
 * ```
 * 
 * Permissions = union of role defaults + team add-ons + direct grants.
 * Teams only add powers; they never revoke role defaults.
 */
export const useProjectPermissions = ({ projectId, workspaceId }: UseProjectPermissionsProps) => {
    const { data, isLoading, error } = useQuery<ProjectPermissionResult | null>({
        queryKey: ["project-permissions", projectId, workspaceId],
        queryFn: async () => {
            if (!projectId) return null;

            const response = await client.api["project-members"]["permissions"].$get({
                query: {
                    projectId,
                    ...(workspaceId && { workspaceId }),
                },
            });

            if (!response.ok) {
                return null;
            }

            const json = await response.json();
            return json.data as ProjectPermissionResult;
        },
        enabled: !!projectId,
        staleTime: 5 * 60 * 1000, // 5 minutes — permissions rarely change mid-session
        refetchOnWindowFocus: false, // DISABLED — was causing reads on every alt-tab
    });

    const permissions = useMemo(() => data?.permissions || [], [data]);

    /**
     * Check if user has a specific permission in this project.
     * @param permission - Permission string (e.g., "task.create")
     */
    const can = useCallback(
        (permission: string): boolean => {
            if (isLoading || !data) return false;
            return permissions.includes(permission);
        },
        [permissions, isLoading, data]
    );

    /**
     * Check if user has ALL of the specified permissions.
     */
    const canAll = useCallback(
        (...perms: string[]): boolean => {
            if (isLoading || !data) return false;
            return perms.every((p) => permissions.includes(p));
        },
        [permissions, isLoading, data]
    );

    /**
     * Check if user has ANY of the specified permissions.
     */
    const canAny = useCallback(
        (...perms: string[]): boolean => {
            if (isLoading || !data) return false;
            return perms.some((p) => permissions.includes(p));
        },
        [permissions, isLoading, data]
    );

    return {
        // Core permission check
        can,
        canAll,
        canAny,

        // Convenience permission checks
        canViewProject: can(PROJECT_PERMISSIONS.PROJECT_VIEW),
        canManageProjectSettings: can(PROJECT_PERMISSIONS.PROJECT_SETTINGS_MANAGE),
        canCreateTeams: can(PROJECT_PERMISSIONS.TEAM_CREATE),
        canManageTeams: can(PROJECT_PERMISSIONS.TEAM_MANAGE),
        canInviteMembers: can(PROJECT_PERMISSIONS.MEMBER_INVITE),
        canRemoveMembers: can(PROJECT_PERMISSIONS.MEMBER_REMOVE),
        canCreateTasks: can(PROJECT_PERMISSIONS.TASK_CREATE),
        canUpdateTasks: can(PROJECT_PERMISSIONS.TASK_UPDATE),
        canDeleteTasks: can(PROJECT_PERMISSIONS.TASK_DELETE),
        canAssignTasks: can(PROJECT_PERMISSIONS.TASK_ASSIGN),
        canViewSprints: can(PROJECT_PERMISSIONS.SPRINT_VIEW),
        canCreateSprints: can(PROJECT_PERMISSIONS.SPRINT_CREATE),
        canStartSprints: can(PROJECT_PERMISSIONS.SPRINT_START),
        canCompleteSprints: can(PROJECT_PERMISSIONS.SPRINT_COMPLETE),
        canManageBoard: can(PROJECT_PERMISSIONS.BOARD_MANAGE),
        canCreateComments: can(PROJECT_PERMISSIONS.COMMENT_CREATE),
        canDeleteComments: can(PROJECT_PERMISSIONS.COMMENT_DELETE),
        canManageRoles: canAll(
            PROJECT_PERMISSIONS.ROLE_CREATE,
            PROJECT_PERMISSIONS.ROLE_UPDATE,
            PROJECT_PERMISSIONS.ROLE_DELETE
        ),

        // Metadata
        isLoading,
        error,
        permissions,
        roles: data?.roles || [],
        isProjectAdmin: data?.isProjectAdmin || false,
        
        // New ProjectPermissionKey-based convenience methods
        canViewProjectDocs: can(ProjectPermissionKey.VIEW_DOCS),
        canCreateDocs: can(ProjectPermissionKey.CREATE_DOCS),
        canEditDocs: can(ProjectPermissionKey.EDIT_DOCS),
        canDeleteDocs: can(ProjectPermissionKey.DELETE_DOCS),
        canEditSprintDetails: can(ProjectPermissionKey.EDIT_SPRINTS),
        canDeleteSprintItems: can(ProjectPermissionKey.DELETE_SPRINTS),
        canViewMembers: can(ProjectPermissionKey.VIEW_MEMBERS),
        canManageProjectMembers: can(ProjectPermissionKey.MANAGE_MEMBERS),
        canManageProjectTeams: can(ProjectPermissionKey.MANAGE_TEAMS),
        canManageProjectPermissions: can(ProjectPermissionKey.MANAGE_PERMISSIONS),
        canEditProjectSettings: can(ProjectPermissionKey.EDIT_SETTINGS),
        canDeleteProject: can(ProjectPermissionKey.DELETE_PROJECT),
        
        // Task permissions (using ProjectPermissionKey)
        canViewTasksProject: can(ProjectPermissionKey.VIEW_TASKS),
        canEditTasksProject: can(ProjectPermissionKey.EDIT_TASKS),
        canDeleteTasksProject: can(ProjectPermissionKey.DELETE_TASKS),
        canCreateTasksProject: can(ProjectPermissionKey.CREATE_TASKS),
        
        // Sprint permissions (using ProjectPermissionKey)
        canViewSprintsProject: can(ProjectPermissionKey.VIEW_SPRINTS),
        canCreateSprintsProject: can(ProjectPermissionKey.CREATE_SPRINTS),
        canEditSprintsProject: can(ProjectPermissionKey.EDIT_SPRINTS),
        canDeleteSprintsProject: can(ProjectPermissionKey.DELETE_SPRINTS),
        canStartSprintProject: can(ProjectPermissionKey.START_SPRINT),
        canCompleteSprintProject: can(ProjectPermissionKey.COMPLETE_SPRINT),
        
        // Team permissions (using ProjectPermissionKey)
        canViewTeamsProject: can(ProjectPermissionKey.VIEW_TEAMS),
    };
};

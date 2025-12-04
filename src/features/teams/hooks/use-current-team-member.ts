import { useGetTeamMembers } from "@/features/teams/api/use-get-team-members";
import { useGetCustomRoles } from "@/features/teams/api/use-get-custom-roles";
import { useCurrent } from "@/features/auth/api/use-current";
import { useCurrentMember } from "@/features/members/hooks/use-current-member";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useTeamPermissions } from "./use-team-permissions";
import { PopulatedTeamMember } from "../types";

interface UseCurrentTeamMemberProps {
    teamId: string;
}

export const useCurrentTeamMember = ({ teamId }: UseCurrentTeamMemberProps) => {
    const { data: user } = useCurrent();
    const workspaceId = useWorkspaceId();
    const { isAdmin: isWorkspaceAdmin } = useCurrentMember({ workspaceId });
    const { data: teamMembersData, isLoading: isLoadingMembers } = useGetTeamMembers({ teamId });
    const { data: customRolesData, isLoading: isLoadingRoles } = useGetCustomRoles({ teamId });

    const members = (teamMembersData?.documents || []) as PopulatedTeamMember[];
    const member = user && members.length > 0 ? members.find((m) => m.user.userId === user.$id) || null : null;
    const customRoles = (customRolesData?.data?.documents || []) as import("../types").CustomRole[];

    const permissions = useTeamPermissions(member, customRoles);

    const isLoading = isLoadingMembers || isLoadingRoles;

    if (!user || !teamMembersData) {
        return {
            member: null,
            isLoading: true,
            ...permissions, // Return default permissions (all false) from the hook when member is null
        };
    }

    // Workspace admins have full permissions on all teams, even if they're not team members
    if (isWorkspaceAdmin) {
        return {
            member,
            isLoading,
            permissions: [], // Not used when all permissions are true
            hasPermission: () => true,
            hasAnyPermission: () => true,
            hasAllPermissions: () => true,
            isTeamLead: true,
            canViewTasks: true,
            canCreateTasks: true,
            canEditTasks: true,
            canDeleteTasks: true,
            canAssignTasks: true,
            canViewSprints: true,
            canCreateSprints: true,
            canEditSprints: true,
            canDeleteSprints: true,
            canViewMembers: true,
            canAddMembers: true,
            canRemoveMembers: true,
            canChangeRoles: true,
            canEditSettings: true,
            canDeleteTeam: true,
            canManageRoles: true,
            canViewReports: true,
            canExportData: true,
        };
    }

    return {
        member,
        isLoading,
        ...permissions,
    };
};

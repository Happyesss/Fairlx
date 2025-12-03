import { useGetTeamMembers } from "@/features/teams/api/use-get-team-members";
import { useGetCustomRoles } from "@/features/teams/api/use-get-custom-roles";
import { useCurrent } from "@/features/auth/api/use-current";
import { useTeamPermissions } from "./use-team-permissions";
import { PopulatedTeamMember } from "../types";

interface UseCurrentTeamMemberProps {
    teamId: string;
}

export const useCurrentTeamMember = ({ teamId }: UseCurrentTeamMemberProps) => {
    const { data: user } = useCurrent();
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

    return {
        member,
        isLoading,
        ...permissions,
    };
};

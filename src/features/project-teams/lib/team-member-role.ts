/** Stored team-membership role. Matches the Appwrite enum on project_team_members. */
export type ProjectTeamMemberRole = "lead" | "member";

export function projectTeamMemberRoleFromLabel(teamRole?: string | null): ProjectTeamMemberRole {
    const folded = String(teamRole ?? "").toLowerCase();
    if (folded.includes("lead") || folded === "admin" || folded === "owner") return "lead";
    return "member";
}

import { Models } from "node-appwrite";

// =============================================================================
// PROJECT MEMBER ROLE
// =============================================================================

/**
 * Project Member Role
 * 
 * Determines the user's authority within a project.
 * PROJECT_OWNER > PROJECT_ADMIN > MEMBER > VIEWER
 */
export enum ProjectMemberRole {
    PROJECT_OWNER = "PROJECT_OWNER",   // Full control, cannot be removed
    PROJECT_ADMIN = "PROJECT_ADMIN",   // Manage members, teams, permissions
    MEMBER = "MEMBER",                 // Standard access based on team permissions
    VIEWER = "VIEWER",                 // Read-only access
}

/**
 * Project Member Status
 */
export enum ProjectMemberStatus {
    ACTIVE = "ACTIVE",
    INVITED = "INVITED",
    REMOVED = "REMOVED",
}

// =============================================================================
// PROJECT TEAM
// =============================================================================

/**
 * Project Team
 * 
 * Teams belong ONLY to a project (not workspace).
 * Names are fully custom (e.g., "Design Squad", "DevOps", "Sprint Alpha").
 */
export type ProjectTeam = Models.Document & {
    projectId: string;              // Parent project
    workspaceId: string;            // Parent workspace (required by collection schema)
    name: string;                   // User-defined name (ANY name allowed)
    description?: string;           // Optional description
    color?: string;                 // Badge color for UI
    createdBy: string;              // User who created this team
};

/**
 * Project Team with populated data
 */
export type PopulatedProjectTeam = ProjectTeam & {
    memberCount: number;
    members?: PopulatedProjectTeamMember[];
};

// =============================================================================
// PROJECT TEAM MEMBER
// =============================================================================

/**
 * Project Team Member
 * 
 * Links a user to a team within a project.
 * A user can be in MULTIPLE teams within the same project.
 */
export type ProjectTeamMember = Models.Document & {
    projectId: string;              // Parent project
    teamId: string;                 // Team within project
    userId: string;                 // User's Appwrite ID
    teamRole?: string;              // Optional label (e.g., "Lead", "Reviewer")
    joinedAt?: string;              // When user joined
    addedBy?: string;               // Who added this member
};

/**
 * Populated Project Team Member
 */
export type PopulatedProjectTeamMember = ProjectTeamMember & {
    user: {
        $id: string;
        name: string;
        email: string;
        profileImageUrl?: string;
    };
    team: {
        $id: string;
        name: string;
        color?: string;
    };
};

// =============================================================================
// PROJECT MEMBER (DIRECT MEMBERSHIP)
// =============================================================================

/**
 * Project Member
 * 
 * Direct project membership. REQUIRED to access project.
 * Team membership is optional (for permission refinement).
 */
export type ProjectMember = Models.Document & {
    projectId: string;              // Parent project
    userId: string;                 // User's Appwrite ID
    role: ProjectMemberRole;        // Project-level role
    status: ProjectMemberStatus;    // Membership status
    addedBy: string;                // Who added this member
    addedAt?: string;               // When member was added
    removedAt?: string;             // When member was removed (if REMOVED)
    removedBy?: string;             // Who removed the member
};

/**
 * Populated Project Member
 */
export type PopulatedProjectMember = ProjectMember & {
    user: {
        $id: string;
        name: string;
        email: string;
        profileImageUrl?: string;
    };
    teams: Array<{
        $id: string;
        name: string;
        color?: string;
        teamRole?: string;
    }>;
};

// =============================================================================
// PROJECT PERMISSION
// =============================================================================

/**
 * Project Permission
 * 
 * Assigns a permission to either a team OR a user within a project.
 * Permissions are merged across all assignments.
 */
export type ProjectPermission = Models.Document & {
    projectId: string;              // Parent project
    permissionKey: string;          // Permission identifier (e.g., "task.create")

    // Assignment (one of these will be set)
    assignedToTeamId?: string;      // Team assignment
    assignedToUserId?: string;      // Direct user assignment

    // Metadata
    grantedBy: string;              // Who granted this permission
    grantedAt?: string;             // When permission was granted
};

// =============================================================================
// PROJECT ACCESS RESULT (from resolver)
// =============================================================================

/**
 * Result from resolveUserProjectAccess()
 * 
 * Contains all access information for a user in a project.
 */
export interface ProjectAccessResult {
    projectId: string;
    userId: string;

    // Access control
    hasAccess: boolean;             // Is user a project member?
    role: ProjectMemberRole | null; // User's project role
    isOwner: boolean;               // Is PROJECT_OWNER?
    isAdmin: boolean;               // Is PROJECT_OWNER or PROJECT_ADMIN?

    // Permissions
    permissions: string[];          // Merged permissions from role + teams

    // Team memberships
    teams: Array<{
        teamId: string;
        teamName: string;
        teamRole?: string;
    }>;

    // Routes
    allowedRouteKeys: string[];     // Route keys user can access
}

// =============================================================================
// DTOs
// =============================================================================

export type CreateProjectTeamData = {
    projectId: string;
    name: string;
    description?: string;
    color?: string;
};

export type UpdateProjectTeamData = {
    name?: string;
    description?: string;
    color?: string;
};

export type AddProjectTeamMemberData = {
    projectId: string;
    teamId: string;
    userId: string;
    teamRole?: string;
};

export type AddProjectMemberData = {
    projectId: string;
    userId: string;
    role: ProjectMemberRole;
};

export type UpdateProjectMemberData = {
    role?: ProjectMemberRole;
    status?: ProjectMemberStatus;
};

export type AssignProjectPermissionData = {
    projectId: string;
    permissionKey: string;
    assignedToTeamId?: string;
    assignedToUserId?: string;
};

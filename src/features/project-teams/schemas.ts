import { z } from "zod";
import { ProjectMemberRole, ProjectMemberStatus } from "./types";

// =============================================================================
// PROJECT TEAM SCHEMAS
// =============================================================================

export const createProjectTeamSchema = z.object({
    workspaceId: z.string().min(1, "Workspace ID is required"),
    projectId: z.string().min(1, "Project ID is required"),
    name: z.string().min(1, "Team name is required").max(100, "Team name too long"),
    description: z.string().max(500).optional(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format").optional(),
});

export const updateProjectTeamSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export const getProjectTeamsSchema = z.object({
    projectId: z.string().min(1, "Project ID is required"),
});

export const updateProjectTeamPermissionsSchema = z.object({
    permissions: z.array(z.string()),
});

// =============================================================================
// PROJECT TEAM MEMBER SCHEMAS
// =============================================================================

export const addProjectTeamMemberSchema = z.object({
    projectId: z.string().min(1),
    teamId: z.string().min(1),
    userId: z.string().min(1),
    teamRole: z.string().max(50).optional(),
});

export const removeProjectTeamMemberSchema = z.object({
    projectId: z.string().min(1),
    teamId: z.string().min(1),
    userId: z.string().min(1),
});

export const getProjectTeamMembersSchema = z.object({
    projectId: z.string().min(1),
    teamId: z.string().min(1),
});

// =============================================================================
// PROJECT MEMBER SCHEMAS
// =============================================================================

export const addProjectMemberSchema = z.object({
    projectId: z.string().min(1),
    userId: z.string().min(1),
    role: z.nativeEnum(ProjectMemberRole),
});

export const updateProjectMemberSchema = z.object({
    role: z.nativeEnum(ProjectMemberRole).optional(),
    status: z.nativeEnum(ProjectMemberStatus).optional(),
});

export const getProjectMembersQuerySchema = z.object({
    projectId: z.string().min(1),
    status: z.nativeEnum(ProjectMemberStatus).optional(),
});

// =============================================================================
// PROJECT PERMISSION SCHEMAS
// =============================================================================

export const assignProjectPermissionSchema = z.object({
    projectId: z.string().min(1),
    permissionKey: z.string().min(1),
    assignedToTeamId: z.string().optional(),
    assignedToUserId: z.string().optional(),
}).refine(
    (data) => data.assignedToTeamId || data.assignedToUserId,
    { message: "Either assignedToTeamId or assignedToUserId is required" }
);

export const revokeProjectPermissionSchema = z.object({
    projectId: z.string().min(1),
    permissionKey: z.string().min(1),
    assignedToTeamId: z.string().optional(),
    assignedToUserId: z.string().optional(),
});

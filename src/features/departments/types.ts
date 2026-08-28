import { Models } from "node-appwrite";

// ===============================
// DEPARTMENT TYPES
// ===============================

/**
 * Department - Organizational permission unit
 * 
 * RULES:
 * - Departments belong to an organization (org-level)
 * - Users can belong to multiple departments
 * - Departments OWN org-level permissions
 * - Members gain org access ONLY via department membership
 * - Permissions are UNIONED across all departments a member belongs to
 * 
 * INVARIANTS:
 * - Member without departments has ZERO org permissions
 * - OWNER role bypasses department check (super-role exception)
 * - Permissions never float outside a department
 * 
 * USE CASES:
 * - Engineering dept with WORKSPACE_CREATE permission
 * - Finance dept with BILLING_VIEW, BILLING_MANAGE permissions
 * - HR dept with MEMBERS_VIEW, MEMBERS_MANAGE permissions
 */
export type Department = Models.Document & {
    /** Organization this department belongs to */
    organizationId: string;
    /** Department name (e.g., "Engineering", "Marketing") */
    name: string;
    /** Optional description */
    description?: string;
    /** Color for UI display (hex) */
    color?: string;
    /** User who created the department (not stored on the Appwrite collection) */
    createdBy?: string;
};

/**
 * OrgMemberDepartment - Junction table for many-to-many relationship
 * 
 * Allows org members to belong to multiple departments
 */
export type OrgMemberDepartment = Models.Document & {
    /** Reference to org_members.$id */
    orgMemberId: string;
    /** Reference to departments.$id */
    departmentId: string;
};

/**
 * DepartmentPermission - Permission owned by a department
 * 
 * RULES:
 * - Departments OWN permissions (not users directly)
 * - Users in a department inherit all its permissions
 * - Permissions are UNIONed across all departments a user belongs to
 * - No permission exists without a department owner
 * 
 * AUDIT:
 * - Tracks who granted and when for compliance
 */
export type DepartmentPermission = Models.Document & {
    /** Reference to departments.$id */
    departmentId: string;
    /** Permission key from OrgPermissionKey enum */
    permissionKey: string;
    /** User ID who granted this permission */
    grantedBy: string;
    /** Timestamp when granted */
    grantedAt: string;
};

// ===============================
// DTOs
// ===============================

export type CreateDepartmentDto = {
    name: string;
    description?: string;
    color?: string;
};

export type UpdateDepartmentDto = {
    name?: string;
    description?: string;
    color?: string;
};

export type AssignMemberToDepartmentDto = {
    orgMemberId: string;
};

export type AddDepartmentPermissionDto = {
    permissionKey: string;
};

export type RemoveDepartmentPermissionDto = {
    permissionKey: string;
};

// ===============================
// POPULATED TYPES
// ===============================

export type PopulatedDepartment = Department & {
    memberCount?: number;
};

export type DepartmentWithMembers = Department & {
    members: {
        $id: string;
        orgMemberId: string;
        name: string;
        email: string;
        profileImageUrl?: string | null;
    }[];
};

// ===============================
// PREDEFINED DEPARTMENT COLORS
// ===============================

export const DEPARTMENT_COLORS = [
    "#4F46E5", // Indigo
    "#0EA5E9", // Sky blue
    "#10B981", // Emerald
    "#F59E0B", // Amber
    "#EF4444", // Red
    "#8B5CF6", // Violet
    "#EC4899", // Pink
    "#14B8A6", // Teal
    "#F97316", // Orange
    "#6366F1", // Purple
] as const;

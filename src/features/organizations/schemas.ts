import { z } from "zod";

/**
 * Schema for creating a new organization
 * Used in both:
 * - ORG account signup flow
 * - Personal → Org conversion
 */
export const createOrganizationSchema = z.object({
    name: z.string().trim().min(1, "Organization name is required.").max(128, "Organization name too long."),
    image: z.union([
        z.instanceof(File),
        z.string().transform((value) => (value === "" ? undefined : value)),
    ]).optional(),
});

/**
 * Schema for updating organization settings
 * Only OWNER and ADMIN can update organization
 */
export const updateOrganizationSchema = z.object({
    name: z.string().trim().min(1, "Organization name is required.").max(128, "Organization name too long.").optional(),
    image: z.union([
        z.instanceof(File),
        z.string().transform((value) => (value === "" ? undefined : value)),
    ]).optional(),
    billingSettings: z.string().optional(), // JSON string
});

/**
 * Schema for adding a member to an organization
 */
export const addOrganizationMemberSchema = z.object({
    userId: z.string().min(1, "User ID is required."),
    role: z.enum(["OWNER", "ADMIN", "MEMBER"]).default("MEMBER"),
});

/**
 * Schema for updating member role in organization
 * 
 * WHY no OWNER here: OWNER transfer is a separate, protected operation
 * with additional validation (must maintain ≥1 OWNER)
 */
export const updateOrganizationMemberSchema = z.object({
    role: z.enum(["OWNER", "ADMIN", "MEMBER"]),
});

/**
 * Schema for creating a new org member (with Appwrite user)
 * ORG accounts only - admin creates user account with temp password
 */
export const createOrgMemberSchema = z.object({
    fullName: z.string().trim().min(1, "Full name is required.").max(128, "Name too long."),
    email: z.string().email("Invalid email format."),
    role: z.enum(["OWNER", "ADMIN", "MODERATOR", "MEMBER"]).default("MEMBER"),
});

/**
 * Schema for Personal → Organization conversion
 * 
 * INVARIANTS enforced by this operation:
 * - Must be a PERSONAL account
 * - Conversion is ONE-WAY (irreversible)
 * - All existing workspace IDs preserved
 * - Billing scope switches from user → organization
 */
export const convertToOrganizationSchema = z.object({
    organizationName: z.string().trim().min(1, "Organization name is required.").max(128, "Organization name too long."),
});

/**
 * Schema for bulk role update of organization members
 * Allows admin to change roles of multiple members at once
 */
export const bulkUpdateMemberRolesSchema = z.object({
    userIds: z.array(z.string()).min(1, "At least one member must be selected"),
    role: z.enum(["OWNER", "ADMIN", "MODERATOR", "MEMBER"]),
});

/**
 * Schema for bulk deletion of organization members
 * Allows admin to remove multiple members at once
 */
export const bulkRemoveMembersSchema = z.object({
    userIds: z.array(z.string()).min(1, "At least one member must be selected"),
});

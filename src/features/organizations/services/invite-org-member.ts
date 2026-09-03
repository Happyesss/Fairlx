import { createHash, randomBytes } from "crypto";
import { ID, Query, type Databases } from "node-appwrite";

import { DATABASE_ID, LOGIN_TOKENS_ID, ORGANIZATION_MEMBERS_ID, ORGANIZATIONS_ID } from "@/config";
import { createAdminClient } from "@/lib/appwrite";
import { CK, invalidateCache } from "@/lib/redis";

import { logOrgAudit, OrgAuditAction } from "../audit";
import { sendWelcomeEmail, logEmailSent } from "./email-service";
import { Organization, OrganizationRole, OrgMemberStatus } from "../types";

export class InviteOrgMemberError extends Error {
  constructor(
    public code: "EMAIL_EXISTS" | "ORG_NOT_FOUND" | "FAILED",
    message: string,
    public orgName?: string,
  ) {
    super(message);
    this.name = "InviteOrgMemberError";
  }
}

export type InviteOrgMemberResult = {
  userId: string;
  email: string;
  name: string;
  isExistingUser: boolean;
  emailSent: boolean;
  emailError?: string;
  hasMagicLink: boolean;
  tempPassword?: string;
};

export async function inviteOrganizationMember(params: {
  actorUserId: string;
  organizationId: string;
  email: string;
  fullName: string;
  role?: OrganizationRole | string;
  databases?: Databases;
}): Promise<InviteOrgMemberResult> {
  const { users, databases: adminDatabases } = await createAdminClient();
  const databases = params.databases ?? adminDatabases;
  const organizationId = params.organizationId;
  const targetEmail = params.email.trim().toLowerCase();
  const fullName = params.fullName.trim() || targetEmail.split("@")[0] || "Member";
  const role = String(params.role || OrganizationRole.MEMBER).toUpperCase();

  let organization: Organization;
  try {
    organization = await databases.getDocument<Organization>(DATABASE_ID, ORGANIZATIONS_ID, organizationId);
  } catch {
    throw new InviteOrgMemberError("ORG_NOT_FOUND", "Organization not found.");
  }

  const existingMemberInOrg = await databases.listDocuments(DATABASE_ID, ORGANIZATION_MEMBERS_ID, [
    Query.equal("email", targetEmail),
    Query.equal("organizationId", organizationId),
  ]);
  if (existingMemberInOrg.total > 0) {
    throw new InviteOrgMemberError(
      "EMAIL_EXISTS",
      `This email is already a member of ${organization.name}.`,
      organization.name,
    );
  }

  let tempPassword = "";
  let targetUserId: string;
  let isExistingUser = false;

  const existingUsers = await users.list([Query.equal("email", targetEmail)]);
  if (existingUsers.total > 0) {
    isExistingUser = true;
    const existingUser = existingUsers.users[0]!;
    targetUserId = existingUser.$id;
    if (!existingUser.emailVerification) {
      await users.updateEmailVerification(targetUserId, true);
    }
    const existingPrefs = existingUser.prefs || {};
    if (!existingPrefs.accountType) {
      await users.updatePrefs(targetUserId, {
        ...existingPrefs,
        accountType: "ORG",
        primaryOrganizationId: existingPrefs.primaryOrganizationId || organizationId,
      });
    }
  } else {
    isExistingUser = false;
    tempPassword = randomBytes(12).toString("base64").slice(0, 16);
    const newUser = await users.create(ID.unique(), targetEmail, undefined, tempPassword, fullName);
    targetUserId = newUser.$id;
    await users.updateEmailVerification(targetUserId, true);
    await users.updatePrefs(targetUserId, {
      mustResetPassword: true,
      accountType: "ORG",
      primaryOrganizationId: organizationId,
    });
  }

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  if (LOGIN_TOKENS_ID) {
    await adminDatabases.createDocument(DATABASE_ID, LOGIN_TOKENS_ID, ID.unique(), {
      userId: targetUserId,
      orgId: organizationId,
      tokenHash,
      expiresAt,
      usedAt: null,
      purpose: "FIRST_LOGIN",
    });
  }

  await databases.createDocument(DATABASE_ID, ORGANIZATION_MEMBERS_ID, ID.unique(), {
    organizationId,
    userId: targetUserId,
    role,
    status: OrgMemberStatus.INVITED,
    mustResetPassword: !isExistingUser,
    name: fullName,
    email: targetEmail,
  });

  await logOrgAudit({
    databases: adminDatabases,
    organizationId,
    actorUserId: params.actorUserId,
    actionType: OrgAuditAction.MEMBER_ADDED,
    metadata: {
      targetUserId,
      targetEmail,
      role,
      creationType: isExistingUser ? "readded_existing_user" : "admin_created",
      isExistingUser,
      verifiedByDefault: true,
    },
  });

  const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL}/sign-in`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const emailResult = await sendWelcomeEmail({
    recipientEmail: targetEmail,
    recipientName: fullName,
    recipientUserId: targetUserId,
    organizationName: organization.name,
    tempPassword: isExistingUser ? undefined : tempPassword,
    loginUrl,
    firstLoginToken: LOGIN_TOKENS_ID ? rawToken : undefined,
    appUrl: LOGIN_TOKENS_ID ? appUrl : undefined,
    logoUrl: organization.imageUrl || undefined,
  });

  if (emailResult.success) {
    logEmailSent({
      organizationId,
      recipientUserId: targetUserId,
      recipientEmail: targetEmail,
      emailType: "welcome",
    });
  }

  await invalidateCache(CK.authLifecycle(targetUserId), CK.authLifecycle(params.actorUserId));

  return {
    userId: targetUserId,
    email: targetEmail,
    name: fullName,
    isExistingUser,
    emailSent: emailResult.success,
    emailError: emailResult.success ? undefined : emailResult.error,
    hasMagicLink: Boolean(LOGIN_TOKENS_ID),
    tempPassword: process.env.NODE_ENV === "development" && !isExistingUser ? tempPassword : undefined,
  };
}

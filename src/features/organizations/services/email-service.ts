import { ID } from "node-appwrite";

import { SMTP_PROVIDER_ID } from "@/config";
import { createAdminClient } from "@/lib/appwrite";
import { welcomeEmailTemplate } from "@/lib/email-templates";

import { ensureUserEmailTarget } from "./ensure-email-target";

interface WelcomeEmailParams {
  recipientEmail: string;
  recipientName: string;
  recipientUserId: string;
  organizationName: string;
  tempPassword?: string;
  loginUrl: string;
  firstLoginToken?: string;
  appUrl?: string;
  logoUrl?: string;
}

/**
 * Send welcome email to new org member with temp password / magic link.
 *
 * New Users API accounts have no messaging target. Attach one first or
 * Appwrite accepts the message and delivers it to nobody.
 */
export async function sendWelcomeEmail({
  recipientEmail,
  recipientName,
  recipientUserId,
  organizationName,
  tempPassword,
  loginUrl,
  firstLoginToken,
  appUrl,
  logoUrl,
}: WelcomeEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    const { messaging, users } = await createAdminClient();

    const subject = `Welcome to ${organizationName}!`;
    const body = welcomeEmailTemplate({
      recipientName,
      recipientEmail,
      organizationName,
      tempPassword,
      loginUrl,
      firstLoginToken,
      appUrl,
      logoUrl,
    });

    const targetId = await ensureUserEmailTarget(users, recipientUserId, recipientEmail, {
      newId: () => ID.unique(),
      providerId: SMTP_PROVIDER_ID || undefined,
    });
    if (!targetId) {
      return {
        success: false,
        error:
          "Could not create an email delivery target for this user. Check Appwrite Messaging SMTP in the console.",
      };
    }

    await messaging.createEmail(
      ID.unique(),
      subject,
      body,
      [],
      [recipientUserId],
      [targetId],
      [],
      [],
      [],
      false,
      true,
    );

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[welcome-email] send failed", error);
    return { success: false, error: errorMessage };
  }
}

export async function logEmailSent({
  organizationId,
  recipientUserId,
  recipientEmail,
  emailType,
}: {
  organizationId: string;
  recipientUserId: string;
  recipientEmail: string;
  emailType: "welcome" | "password_reset" | "notification";
}): Promise<void> {
  try {
    const { logOrgAudit, OrgAuditAction } = await import("@/features/organizations/audit");
    const { databases } = await createAdminClient();

    await logOrgAudit({
      databases,
      organizationId,
      actorUserId: "system",
      actionType: OrgAuditAction.MEMBER_ADDED,
      metadata: {
        eventType: "email_sent",
        emailType,
        recipientUserId,
        recipientEmail,
        timestamp: new Date().toISOString(),
      },
    });
  } catch {
    // Non-blocking
  }
}

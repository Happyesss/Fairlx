import "server-only";

import { ID, Query } from "node-appwrite";

import {
    DATABASE_ID,
    BILLING_ACCOUNTS_ID,
    BILLING_AUDIT_LOGS_ID,
} from "@/config";
import { createAdminClient } from "@/lib/appwrite";

import {
    BillingStatus,
    BillingAccountType,
    BillingAccount,
    BillingAuditEventType,
    REMINDER_SCHEDULE_DAYS,
} from "../types";

/**
 * Grace Period Reminder Service
 * 
 * Sends reminder emails to accounts in DUE status:
 * - Day 1: Initial payment failure notification
 * - Day 7: 1-week reminder
 * - Day 13: Final warning (1 day before suspension)
 * 
 * CRITICAL: This relies on an email service (e.g., Resend, SendGrid, SES)
 * Configure EMAIL_FROM and EMAIL_API_KEY in environment
 */

interface ReminderResult {
    accountId: string;
    email: string;
    reminderDay: number;
    success: boolean;
    error?: string;
}

/**
 * Calculate days since grace period started
 */
function getDaysSinceGracePeriodStart(account: BillingAccount): number {
    if (!account.gracePeriodEnd) return 0;

    // Grace period is 14 days, so start = end - 14 days
    const gracePeriodEnd = new Date(account.gracePeriodEnd);
    const gracePeriodStart = new Date(gracePeriodEnd);
    gracePeriodStart.setDate(gracePeriodStart.getDate() - 14);

    const now = new Date();
    const diffMs = now.getTime() - gracePeriodStart.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    return diffDays;
}

/**
 * Check if a reminder should be sent today for this account
 */
function shouldSendReminder(account: BillingAccount): number | null {
    const daysSinceStart = getDaysSinceGracePeriodStart(account);

    // Check if today matches any reminder schedule day
    if (REMINDER_SCHEDULE_DAYS.includes(daysSinceStart)) {
        return daysSinceStart;
    }

    return null;
}

/**
 * Get email template for reminder
 */
function getReminderEmailContent(
    reminderDay: number,
    accountType: BillingAccountType,
    daysRemaining: number
): { subject: string; html: string; text: string } {
    const accountName = accountType === BillingAccountType.ORG ? "organization" : "account";
    const billingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/billing`;

    // Theme colors
    const primaryBlue = "#2563eb";
    const darkText = "#111827";
    const mutedText = "#6b7280";
    const lightText = "#9ca3af";
    const bgMain = "#f8fafc";
    const cardBg = "#ffffff";
    const fontStack = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

    // Unused but kept for reference: bodyText = "#374151", bgLight = "#f1f5f9", border = "#e2e8f0"

    // Shared email wrapper function
    const wrapInTemplate = (badgeText: string, badgeBgColor: string, badgeTextColor: string, headline: string, content: string, ctaText: string, ctaBgColor: string) => `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <style type="text/css">
    body, table, td, p, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; }
      .email-content { padding: 24px 20px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${bgMain}; font-family: ${fontStack};">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: ${bgMain};">
    <tr>
      <td style="padding: 40px 16px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="560" class="email-container" style="margin: 0 auto; max-width: 560px;">
          
          <!-- Logo -->
          <tr>
            <td style="padding: 0 0 24px 0; text-align: center;">
              <span style="font-size: 26px; font-weight: 700; color: ${primaryBlue}; font-family: ${fontStack}; letter-spacing: -0.5px;">fairlx<span style="color: ${primaryBlue};">.</span></span>
            </td>
          </tr>
          
          <!-- Main Card -->
          <tr>
            <td>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: ${cardBg}; border-radius: 12px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);">
                
                <!-- Content -->
                <tr>
                  <td class="email-content" style="padding: 32px;">
                    
                    <!-- Badge -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 20px;">
                      <tr>
                        <td style="padding: 6px 12px; background-color: ${badgeBgColor}; border-radius: 4px;">
                          <span style="font-size: 13px; font-weight: 600; color: ${badgeTextColor}; font-family: ${fontStack};">${badgeText}</span>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Headline -->
                    <h1 style="margin: 0 0 20px 0; font-size: 22px; font-weight: 700; color: ${darkText}; line-height: 1.3; font-family: ${fontStack};">${headline}</h1>
                    
                    ${content}
                    
                    <!-- CTA Button -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0;">
                      <tr>
                        <td>
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                            <tr>
                              <td style="border-radius: 8px; background-color: ${ctaBgColor}; text-align: center;">
                                <a href="${billingUrl}" target="_blank" style="display: block; padding: 14px 24px; color: #ffffff; font-size: 15px; font-weight: 600; font-family: ${fontStack}; text-decoration: none; border-radius: 8px;">${ctaText} →</a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                    
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 16px 0 16px; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: ${mutedText}; font-family: ${fontStack};">
                You received this email because you have billing notifications enabled
              </p>
              <p style="margin: 0 0 8px 0; font-size: 12px; color: ${lightText}; font-family: ${fontStack};">
                <a href="mailto:billing@fairlx.com" style="color: ${primaryBlue}; text-decoration: none;">Billing Support</a>
                <span style="padding: 0 4px;">·</span>
                <a href="https://fairlx.com/privacy" style="color: ${primaryBlue}; text-decoration: none;">Privacy</a>
                <span style="padding: 0 4px;">·</span>
                <a href="https://fairlx.com/terms" style="color: ${primaryBlue}; text-decoration: none;">Terms</a>
              </p>
              <p style="margin: 0; font-size: 12px; color: ${lightText}; font-family: ${fontStack};">© 2026 Stemlen. All rights reserved.</p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    if (reminderDay === 1) {
        const content = `
            <p style="margin: 0 0 16px 0; color: #4b5563; font-size: 16px; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                We were unable to process your recent payment. Your ${accountName} remains <strong style="color: #111827;">fully accessible</strong> during the 14-day grace period.
            </p>
            
            <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 24px 0; border: 1px solid #e5e7eb;">
                <table cellpadding="0" cellspacing="0" role="presentation" style="width: 100%;">
                    <tr>
                        <td style="padding: 8px 0;">
                            <span style="color: #6b7280; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">Grace Period Remaining</span>
                        </td>
                        <td style="padding: 8px 0; text-align: right;">
                            <span style="color: #111827; font-size: 18px; font-weight: 700; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">${daysRemaining} days</span>
                        </td>
                    </tr>
                </table>
            </div>
            
            <p style="margin: 0 0 0 0; color: #4b5563; font-size: 16px; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                Please update your payment method to avoid service interruption:
            </p>
        `;

        return {
            subject: "Action Required: Payment Failed for Your Fairlx Account",
            html: wrapInTemplate(
                "⚠️ Payment Failed",
                "#fef3c7",
                "#92400e",
                "Payment Update Required",
                content,
                "Update Payment Method",
                "#2563eb"
            ),
            text: `Payment Failed\n\nWe were unable to process your recent payment. Your ${accountName} remains fully accessible during the 14-day grace period.\n\nDays remaining: ${daysRemaining}\n\nPlease update your payment method at: ${billingUrl}`,
        };
    } else if (reminderDay === 7) {
        const content = `
            <p style="margin: 0 0 16px 0; color: #4b5563; font-size: 16px; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                This is a friendly reminder that your payment is still pending. Your ${accountName} will be suspended in <strong style="color: #111827;">${daysRemaining} days</strong> if payment is not received.
            </p>
            
            <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 24px 0;">
                <table cellpadding="0" cellspacing="0" role="presentation" style="width: 100%;">
                    <tr>
                        <td style="width: 32px; vertical-align: top;">
                            <div style="font-size: 18px;">⏱️</div>
                        </td>
                        <td style="vertical-align: top;">
                            <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                                <strong>${daysRemaining} days remaining</strong> until your ${accountName} is suspended.
                            </p>
                        </td>
                    </tr>
                </table>
            </div>
            
            <p style="margin: 0 0 0 0; color: #6b7280; font-size: 14px; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                Your data is safe and will not be deleted even if your account is suspended.
            </p>
        `;

        return {
            subject: "Reminder: Update Your Payment Method - 7 Days Remaining",
            html: wrapInTemplate(
                "🔔 Payment Reminder",
                "#dbeafe",
                "#1e40af",
                "Payment Still Pending",
                content,
                "Update Payment Method",
                "#2563eb"
            ),
            text: `Payment Reminder\n\nThis is a friendly reminder that your payment is still pending. Your ${accountName} will be suspended in ${daysRemaining} days if payment is not received.\n\nUpdate your payment method at: ${billingUrl}`,
        };
    } else {
        // Day 13 - Final warning
        const content = `
            <p style="margin: 0 0 16px 0; color: #4b5563; font-size: 16px; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                Your ${accountName} will be <strong style="color: #ef4444;">suspended tomorrow</strong> due to unpaid invoice.
            </p>
            
            <div style="background-color: #fee2e2; border: 2px solid #ef4444; border-radius: 8px; padding: 16px; margin: 24px 0;">
                <table cellpadding="0" cellspacing="0" role="presentation" style="width: 100%;">
                    <tr>
                        <td style="width: 32px; vertical-align: top;">
                            <div style="font-size: 18px;">🚨</div>
                        </td>
                        <td style="vertical-align: top;">
                            <p style="margin: 0; color: #991b1b; font-size: 14px; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                                Once suspended, you will not be able to access your workspaces, projects, or data until payment is received.
                            </p>
                        </td>
                    </tr>
                </table>
            </div>
            
            <p style="margin: 0 0 0 0; color: #6b7280; font-size: 14px; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                Don't worry — your data is safe. You can restore access anytime by completing your payment.
            </p>
        `;

        return {
            subject: "URGENT: Your Account Will Be Suspended Tomorrow",
            html: wrapInTemplate(
                "🚨 Final Warning",
                "#fee2e2",
                "#991b1b",
                "Immediate Action Required",
                content,
                "Pay Now",
                "#ef4444"
            ),
            text: `FINAL WARNING\n\nYour ${accountName} will be suspended tomorrow due to unpaid invoice.\n\nOnce suspended, you will not be able to access your workspaces, projects, or data until payment is received.\n\nPay now at: ${billingUrl}`,
        };
    }
}

/**
 * Send email via configured email service
 * 
 * Migrated to Appwrite Messaging. This uses the SMTP provider
 * configured in your Appwrite Console.
 */
async function sendEmail(
    to: string,
    subject: string,
    html: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const { messaging } = await createAdminClient();
        const _emailFrom = process.env.EMAIL_FROM || "billing@fairlx.com";

        // Send direct email using Appwrite Messaging
        await messaging.createEmail(
            ID.unique(),
            subject,
            html,
            [], // topics
            [], // users
            [], // targets
            [to] // direct emails
        );

        return { success: true };
    } catch (error) {
        console.error("Appwrite Messaging Error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error"
        };
    }
}

/**
 * Send grace period reminders to all eligible accounts
 * 
 * Called by /api/cron/billing/send-reminders
 */
export async function sendGracePeriodReminders(): Promise<{
    processed: number;
    sent: number;
    results: ReminderResult[];
}> {
    const { databases } = await createAdminClient();

    // Find accounts in DUE status with grace period set
    const accounts = await databases.listDocuments<BillingAccount>(
        DATABASE_ID,
        BILLING_ACCOUNTS_ID,
        [
            Query.equal("billingStatus", BillingStatus.DUE),
            Query.isNotNull("gracePeriodEnd"),
            Query.limit(100),
        ]
    );

    const results: ReminderResult[] = [];

    for (const account of accounts.documents) {
        const reminderDay = shouldSendReminder(account);

        if (reminderDay === null) {
            // Not a reminder day for this account
            continue;
        }

        // Get email address
        const email = account.billingEmail;
        if (!email) {
            continue;
        }

        // Calculate days remaining
        const gracePeriodEnd = new Date(account.gracePeriodEnd!);
        const now = new Date();
        const daysRemaining = Math.max(0, Math.ceil((gracePeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

        // Get email content
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { subject, html, text } = getReminderEmailContent(
            reminderDay,
            account.type,
            daysRemaining
        );

        // Send email
        const emailResult = await sendEmail(email, subject, html);

        results.push({
            accountId: account.$id,
            email,
            reminderDay,
            success: emailResult.success,
            error: emailResult.error,
        });

        // Log audit event
        if (emailResult.success) {
            await databases.createDocument(
                DATABASE_ID,
                BILLING_AUDIT_LOGS_ID,
                ID.unique(),
                {
                    billingAccountId: account.$id,
                    eventType: BillingAuditEventType.GRACE_PERIOD_REMINDER_SENT,
                    metadata: JSON.stringify({
                        reminderDay,
                        daysRemaining,
                        email,
                    }),
                }
            );
        }
    }

    const sent = results.filter(r => r.success).length;

    return {
        processed: accounts.total,
        sent,
        results,
    };
}

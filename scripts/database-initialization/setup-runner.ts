/**
 * setup-runner.ts
 *
 * Standalone module that provides runCollectionSetups / runBucketSetups
 * for programmatic use (e.g. BYOB initialize-db endpoint).
 *
 * This exists separately from setup-database.ts because that file has
 * top-level side effects (dotenv.config, main() call) that would execute
 * on import. This module is side-effect-free.
 */

// ─── Collection Setup Imports ────────────────────────────────
import { setupWorkspaces } from './collections/workspaces';
import { setupMembers } from './collections/members';
import { setupProjects } from './collections/projects';
import { setupProjectMembers } from './collections/project-members';
import { setupProjectRoles } from './collections/project-roles';
import { setupWorkItems } from './collections/work-items';
import { setupSprints } from './collections/sprints';
import { setupPersonalBacklog } from './collections/personal-backlog';
import { setupCustomColumns } from './collections/custom-columns';
import { setupDefaultColumnSettings } from './collections/default-column-settings';
import { setupNotifications } from './collections/notifications';
import { setupAttachments } from './collections/attachments';
import { setupComments } from './collections/comments';
import { setupProjectDocs } from './collections/project-docs';
import { setupAuditLogs } from './collections/audit-logs';
import { setupOrganizationAuditLogs } from './collections/organization-audit-logs';
import { setupOrganizations } from './collections/organizations';
import { setupOrganizationMembers } from './collections/organization-members';
import { setupDepartments } from './collections/departments';
import { setupOrgMemberDepartments } from './collections/org-member-departments';
import { setupOrgMemberPermissions } from './collections/org-member-permissions';
import { setupDepartmentPermissions } from './collections/department-permissions';
import { setupLoginTokens } from './collections/login-tokens';
import { setupVerificationTokens } from './collections/verification-tokens';
import { setupUsageEvents } from './collections/usage-events';
import { setupUsageAggregations } from './collections/usage-aggregations';
import { setupUsageAlerts } from './collections/usage-alerts';
import { setupUsageDeductions } from './collections/usage-deductions';
import { setupBillingAccounts } from './collections/billing-accounts';
import { setupBillingAuditLogs } from './collections/billing-audit-logs';
import { setupBillingSettings } from './collections/billing-settings';
import { setupStorageDailySnapshots } from './collections/storage-daily-snapshots';
import { setupInvoices } from './collections/invoices';
import { setupProcessedEvents } from './collections/processed-events';
import { setupWallets } from './collections/wallets';
import { setupWalletTransactions } from './collections/wallet-transactions';
import { setupGithubRepositories } from './collections/github-repositories';
import { setupCodeDocumentation } from './collections/code-documentation';
import { setupProjectTeams } from './collections/project-teams';
import { setupProjectTeamMembers } from './collections/project-team-members';
import { setupProjectPermissions } from './collections/project-permissions';
import { setupPrograms } from './collections/programs';
import { setupProgramMembers } from './collections/program-members';
import { setupProgramMilestones } from './collections/program-milestones';
import { setupCustomRoles } from './collections/custom-roles';
import { setupSpaces } from './collections/spaces';
import { setupSpaceMembers } from './collections/space-members';
import { setupWorkflows } from './collections/workflows';
import { setupWorkflowStatuses } from './collections/workflow-statuses';
import { setupWorkflowTransitions } from './collections/workflow-transitions';
import { setupCustomFields } from './collections/custom-fields';
import { setupCustomWorkItemTypes } from './collections/custom-work-item-types';
import { setupWorkItemLinks } from './collections/work-item-links';
import { setupSavedViews } from './collections/saved-views';
import { setupSubtasks } from './collections/subtasks';
import { setupTimeLogs } from './collections/time-logs';
import { setupProjectWebhooks } from './collections/project-webhooks';
import { setupProjectWebhookDeliveries } from './collections/project-webhook-deliveries';
import { setupUserRecoveryCodes } from './collections/user-recovery-codes';
import { setupEmailOtpCodes } from './collections/email-otp-codes';
import { setupAIModelPricing } from './collections/ai-model-pricing';

// ─── Storage Bucket Imports ──────────────────────────────────
import { setupImagesBucket } from './storage/images-bucket';
import { setupAttachmentsBucket } from './storage/attachments-bucket';
import { setupProjectDocsBucket } from './storage/project-docs-bucket';

// ─── Collection Setup List ───────────────────────────────────
const collectionSetups: Array<{
    name: string;
    setup: (databases: import('node-appwrite').Databases, databaseId: string) => Promise<void>;
}> = [
        { name: 'Workspaces', setup: setupWorkspaces },
        { name: 'Members', setup: setupMembers },
        { name: 'Projects', setup: setupProjects },
        { name: 'Project Members', setup: setupProjectMembers },
        { name: 'Project Roles', setup: setupProjectRoles },
        { name: 'Work Items', setup: setupWorkItems },
        { name: 'Sprints', setup: setupSprints },
        { name: 'Personal Backlog', setup: setupPersonalBacklog },
        { name: 'Custom Columns', setup: setupCustomColumns },
        { name: 'Default Column Settings', setup: setupDefaultColumnSettings },
        { name: 'Notifications', setup: setupNotifications },
        { name: 'Attachments', setup: setupAttachments },
        { name: 'Comments', setup: setupComments },
        { name: 'Project Docs', setup: setupProjectDocs },
        { name: 'Audit Logs', setup: setupAuditLogs },
        { name: 'Organization Audit Logs', setup: setupOrganizationAuditLogs },
        { name: 'Organizations', setup: setupOrganizations },
        { name: 'Organization Members', setup: setupOrganizationMembers },
        { name: 'Departments', setup: setupDepartments },
        { name: 'Org Member Departments', setup: setupOrgMemberDepartments },
        { name: 'Org Member Permissions', setup: setupOrgMemberPermissions },
        { name: 'Department Permissions', setup: setupDepartmentPermissions },
        { name: 'Login Tokens', setup: setupLoginTokens },
        { name: 'Verification Tokens', setup: setupVerificationTokens },
        { name: 'Usage Events', setup: setupUsageEvents },
        { name: 'Usage Aggregations', setup: setupUsageAggregations },
        { name: 'Usage Alerts', setup: setupUsageAlerts },
        { name: 'Usage Deductions', setup: setupUsageDeductions },
        { name: 'Billing Accounts', setup: setupBillingAccounts },
        { name: 'Billing Audit Logs', setup: setupBillingAuditLogs },
        { name: 'Billing Settings', setup: setupBillingSettings },
        { name: 'Storage Daily Snapshots', setup: setupStorageDailySnapshots },
        { name: 'Invoices', setup: setupInvoices },
        { name: 'Processed Events', setup: setupProcessedEvents },
        { name: 'AI Model Pricing', setup: setupAIModelPricing },
        { name: 'Wallets', setup: setupWallets },
        { name: 'Wallet Transactions', setup: setupWalletTransactions },
        { name: 'GitHub Repositories', setup: setupGithubRepositories },
        { name: 'Code Documentation', setup: setupCodeDocumentation },
        { name: 'Project Teams', setup: setupProjectTeams },
        { name: 'Project Team Members', setup: setupProjectTeamMembers },
        { name: 'Project Permissions', setup: setupProjectPermissions },
        { name: 'Programs', setup: setupPrograms },
        { name: 'Program Members', setup: setupProgramMembers },
        { name: 'Program Milestones', setup: setupProgramMilestones },
        { name: 'Custom Roles', setup: setupCustomRoles },
        { name: 'Spaces', setup: setupSpaces },
        { name: 'Space Members', setup: setupSpaceMembers },
        { name: 'Workflows', setup: setupWorkflows },
        { name: 'Workflow Statuses', setup: setupWorkflowStatuses },
        { name: 'Workflow Transitions', setup: setupWorkflowTransitions },
        { name: 'Custom Fields', setup: setupCustomFields },
        { name: 'Custom Work Item Types', setup: setupCustomWorkItemTypes },
        { name: 'Work Item Links', setup: setupWorkItemLinks },
        { name: 'Saved Views', setup: setupSavedViews },
        { name: 'Subtasks', setup: setupSubtasks },
        { name: 'Time Logs', setup: setupTimeLogs },
        { name: 'Project Webhooks', setup: setupProjectWebhooks },
        { name: 'Project Webhook Deliveries', setup: setupProjectWebhookDeliveries },
        { name: 'User Recovery Codes', setup: setupUserRecoveryCodes },
        { name: 'Email OTP Codes', setup: setupEmailOtpCodes },
    ];

// ─── Exported Functions ──────────────────────────────────────

export async function runCollectionSetups(
    databases: import('node-appwrite').Databases,
    databaseId: string,
    onProgress?: (name: string, index: number, total: number) => void | Promise<void>,
): Promise<{ succeeded: string[]; failed: string[] }> {
    const succeeded: string[] = [];
    const failed: string[] = [];

    for (let i = 0; i < collectionSetups.length; i++) {
        const { name, setup } = collectionSetups[i];
        try {
            await setup(databases, databaseId);
            succeeded.push(name);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`❌ Fatal error in collection "${name}": ${message}`);
            failed.push(name);
        }
        await onProgress?.(name, i + 1, collectionSetups.length);
    }

    return { succeeded, failed };
}

export async function runBucketSetups(
    storage: import('node-appwrite').Storage,
    onProgress?: (name: string, index: number, total: number) => void | Promise<void>,
): Promise<{ succeeded: string[]; failed: string[] }> {
    const bucketSetups = [
        { name: 'Images', setup: setupImagesBucket },
        { name: 'Attachments', setup: setupAttachmentsBucket },
        { name: 'Project Documents', setup: setupProjectDocsBucket },
    ];

    const succeeded: string[] = [];
    const failed: string[] = [];

    for (let i = 0; i < bucketSetups.length; i++) {
        const { name, setup } = bucketSetups[i];
        try {
            await setup(storage);
            succeeded.push(name);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`❌ Fatal error in bucket "${name}": ${message}`);
            failed.push(name);
        }
        await onProgress?.(name, i + 1, bucketSetups.length);
    }

    return { succeeded, failed };
}

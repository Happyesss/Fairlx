import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getDatabases, getStorage } from './lib/appwrite-client';
import { runInteractiveSetup } from './lib/interactive-setup';
import { ensureDatabase } from './lib/db-helpers';
import { logger, printSummary } from './lib/logger';
import { writeEnvVars } from './lib/env-writer';

// ─── Storage Bucket Setup Imports ────────────────────────────
import { setupImagesBucket } from './storage/images-bucket';
import { setupAttachmentsBucket } from './storage/attachments-bucket';
import { setupProjectDocsBucket } from './storage/project-docs-bucket';

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
import { setupBYOBTenants } from './collections/byob-tenants';
import { setupAIModelPricing } from './collections/ai-model-pricing';

// ─── Configuration ───────────────────────────────────────────
const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? 'fairlx';
const DATABASE_NAME = 'Fairlx';

// ─── Collection Setup Functions (ordered) ────────────────────
const collectionSetups: Array<{
    name: string;
    setup: (databases: import('node-appwrite').Databases, databaseId: string) => Promise<void>;
}> = [
        // Core
        { name: 'Workspaces', setup: setupWorkspaces },
        { name: 'Members', setup: setupMembers },
        { name: 'Projects', setup: setupProjects },
        { name: 'Project Members', setup: setupProjectMembers },
        { name: 'Project Roles', setup: setupProjectRoles },

        // Work Management
        { name: 'Work Items', setup: setupWorkItems },
        { name: 'Sprints', setup: setupSprints },
        { name: 'Personal Backlog', setup: setupPersonalBacklog },
        { name: 'Custom Columns', setup: setupCustomColumns },
        { name: 'Default Column Settings', setup: setupDefaultColumnSettings },

        // Collaboration
        { name: 'Notifications', setup: setupNotifications },
        { name: 'Attachments', setup: setupAttachments },
        { name: 'Comments', setup: setupComments },
        { name: 'Project Docs', setup: setupProjectDocs },

        // Audit
        { name: 'Audit Logs', setup: setupAuditLogs },
        { name: 'Organization Audit Logs', setup: setupOrganizationAuditLogs },

        // Organization
        { name: 'Organizations', setup: setupOrganizations },
        { name: 'Organization Members', setup: setupOrganizationMembers },
        { name: 'Departments', setup: setupDepartments },
        { name: 'Org Member Departments', setup: setupOrgMemberDepartments },
        { name: 'Org Member Permissions', setup: setupOrgMemberPermissions },
        { name: 'Department Permissions', setup: setupDepartmentPermissions },

        // Auth
        { name: 'Login Tokens', setup: setupLoginTokens },
        { name: 'Verification Tokens', setup: setupVerificationTokens },

        // Usage & Billing
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

        // Wallets
        { name: 'Wallets', setup: setupWallets },
        { name: 'Wallet Transactions', setup: setupWalletTransactions },

        // Integrations
        { name: 'GitHub Repositories', setup: setupGithubRepositories },
        { name: 'Code Documentation', setup: setupCodeDocumentation },

        // Teams & Permissions
        { name: 'Project Teams', setup: setupProjectTeams },
        { name: 'Project Team Members', setup: setupProjectTeamMembers },
        { name: 'Project Permissions', setup: setupProjectPermissions },

        // Programs & Roles
        { name: 'Programs', setup: setupPrograms },
        { name: 'Program Members', setup: setupProgramMembers },
        { name: 'Program Milestones', setup: setupProgramMilestones },
        { name: 'Custom Roles', setup: setupCustomRoles },

        // Spaces
        { name: 'Spaces', setup: setupSpaces },
        { name: 'Space Members', setup: setupSpaceMembers },

        // Workflows
        { name: 'Workflows', setup: setupWorkflows },
        { name: 'Workflow Statuses', setup: setupWorkflowStatuses },
        { name: 'Workflow Transitions', setup: setupWorkflowTransitions },

        // Customization
        { name: 'Custom Fields', setup: setupCustomFields },
        { name: 'Custom Work Item Types', setup: setupCustomWorkItemTypes },
        { name: 'Work Item Links', setup: setupWorkItemLinks },
        { name: 'Saved Views', setup: setupSavedViews },
        { name: 'Subtasks', setup: setupSubtasks },
        { name: 'Time Logs', setup: setupTimeLogs },

        // Webhooks
        { name: 'Project Webhooks', setup: setupProjectWebhooks },
        { name: 'Project Webhook Deliveries', setup: setupProjectWebhookDeliveries },

        // Auth (additional)
        { name: 'User Recovery Codes', setup: setupUserRecoveryCodes },
        { name: 'Email OTP Codes', setup: setupEmailOtpCodes },

        // BYOB (Bring Your Own Backend)
        { name: 'BYOB Tenants', setup: setupBYOBTenants },
    ];

// ─── All Environment Variables ───────────────────────────────
// Returns every env var needed by the application, split into:
//   autoVars   → auto-generated (collection IDs, DB ID, sensible defaults)
//   manualVars → require user to provide credentials/secrets (written as empty placeholders)

interface EnvVarEntry {
    key: string;
    value: string;
    description: string;
}

function getAutoGeneratedVars(): Record<string, string> {
    return {
        // ── App ──
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',

        // ── Appwrite Connection (preserved from existing env) ──
        NEXT_PUBLIC_APPWRITE_ENDPOINT: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || '',
        NEXT_PUBLIC_APPWRITE_PROJECT: process.env.NEXT_PUBLIC_APPWRITE_PROJECT || '',
        NEXT_APPWRITE_KEY: process.env.NEXT_APPWRITE_KEY || '',

        // ── Database ──
        NEXT_PUBLIC_APPWRITE_DATABASE_ID: DATABASE_ID,

        // ── Core Collections ──
        NEXT_PUBLIC_APPWRITE_WORKSPACES_ID: process.env.NEXT_PUBLIC_APPWRITE_WORKSPACES_ID || 'workspaces',
        NEXT_PUBLIC_APPWRITE_MEMBERS_ID: process.env.NEXT_PUBLIC_APPWRITE_MEMBERS_ID || 'members',
        NEXT_PUBLIC_APPWRITE_PROJECTS_ID: process.env.NEXT_PUBLIC_APPWRITE_PROJECTS_ID || 'projects',
        NEXT_PUBLIC_APPWRITE_PROJECT_MEMBERS_ID: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_MEMBERS_ID || 'project_members',
        NEXT_PUBLIC_APPWRITE_PROJECT_ROLES_ID: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ROLES_ID || 'project_roles',

        // ── Work Management Collections ──
        NEXT_PUBLIC_APPWRITE_WORK_ITEMS_ID: process.env.NEXT_PUBLIC_APPWRITE_WORK_ITEMS_ID || 'workItems',
        NEXT_PUBLIC_APPWRITE_TASKS_ID: process.env.NEXT_PUBLIC_APPWRITE_TASKS_ID || 'workItems',
        NEXT_PUBLIC_APPWRITE_SPRINTS_ID: process.env.NEXT_PUBLIC_APPWRITE_SPRINTS_ID || 'sprints',
        NEXT_PUBLIC_APPWRITE_PERSONAL_BACKLOG_ID: process.env.NEXT_PUBLIC_APPWRITE_PERSONAL_BACKLOG_ID || 'personalBacklog',
        NEXT_PUBLIC_APPWRITE_CUSTOM_COLUMNS_ID: process.env.NEXT_PUBLIC_APPWRITE_CUSTOM_COLUMNS_ID || 'custom-columns',
        NEXT_PUBLIC_APPWRITE_DEFAULT_COLUMN_SETTINGS_ID: process.env.NEXT_PUBLIC_APPWRITE_DEFAULT_COLUMN_SETTINGS_ID || 'default_column_settings',

        // ── Collaboration Collections ──
        NEXT_PUBLIC_APPWRITE_NOTIFICATIONS_ID: process.env.NEXT_PUBLIC_APPWRITE_NOTIFICATIONS_ID || 'notifications',
        NEXT_PUBLIC_APPWRITE_ATTACHMENTS_ID: process.env.NEXT_PUBLIC_APPWRITE_ATTACHMENTS_ID || 'attachments',
        NEXT_PUBLIC_APPWRITE_COMMENTS_ID: process.env.NEXT_PUBLIC_APPWRITE_COMMENTS_ID || 'comments',
        NEXT_PUBLIC_APPWRITE_PROJECT_DOCS_ID: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_DOCS_ID || 'project_docs',

        // ── Audit Collections ──
        NEXT_PUBLIC_APPWRITE_AUDIT_LOGS_ID: 'audit_logs',
        NEXT_PUBLIC_APPWRITE_ORGANIZATION_AUDIT_LOGS_ID: process.env.NEXT_PUBLIC_APPWRITE_ORGANIZATION_AUDIT_LOGS_ID || 'organization_audit_logs',

        // ── Organization Collections ──
        NEXT_PUBLIC_APPWRITE_ORGANIZATIONS_ID: process.env.NEXT_PUBLIC_APPWRITE_ORGANIZATIONS_ID || 'organizations',
        NEXT_PUBLIC_APPWRITE_ORGANIZATION_MEMBERS_ID: process.env.NEXT_PUBLIC_APPWRITE_ORGANIZATION_MEMBERS_ID || 'organization_members',
        NEXT_PUBLIC_APPWRITE_DEPARTMENTS_ID: process.env.NEXT_PUBLIC_APPWRITE_DEPARTMENTS_ID || 'departments',
        NEXT_PUBLIC_APPWRITE_ORG_MEMBER_DEPARTMENTS_ID: process.env.NEXT_PUBLIC_APPWRITE_ORG_MEMBER_DEPARTMENTS_ID || 'org_member_departments',
        NEXT_PUBLIC_APPWRITE_ORG_MEMBER_PERMISSIONS_ID: process.env.NEXT_PUBLIC_APPWRITE_ORG_MEMBER_PERMISSIONS_ID || 'org_member_permissions',
        NEXT_PUBLIC_APPWRITE_DEPARTMENT_PERMISSIONS_ID: process.env.NEXT_PUBLIC_APPWRITE_DEPARTMENT_PERMISSIONS_ID || 'department_permissions',

        // ── Auth Collections ──
        NEXT_PUBLIC_APPWRITE_LOGIN_TOKENS_ID: process.env.NEXT_PUBLIC_APPWRITE_LOGIN_TOKENS_ID || 'login_tokens',
        NEXT_PUBLIC_APPWRITE_VERIFICATION_TOKENS_ID: 'verification_tokens',
        NEXT_PUBLIC_APPWRITE_USER_RECOVERY_CODES_ID: 'user_recovery_codes',
        NEXT_PUBLIC_APPWRITE_EMAIL_OTP_CODES_ID: 'email_otp_codes',

        // ── Usage & Billing Collections ──
        NEXT_PUBLIC_APPWRITE_USAGE_EVENTS_ID: process.env.NEXT_PUBLIC_APPWRITE_USAGE_EVENTS_ID || 'usage_events',
        NEXT_PUBLIC_APPWRITE_USAGE_AGGREGATIONS_ID: process.env.NEXT_PUBLIC_APPWRITE_USAGE_AGGREGATIONS_ID || 'usage_aggregations',
        NEXT_PUBLIC_APPWRITE_USAGE_ALERTS_ID: process.env.NEXT_PUBLIC_APPWRITE_USAGE_ALERTS_ID || 'usage_alerts',
        NEXT_PUBLIC_APPWRITE_USAGE_DEDUCTIONS_ID: process.env.NEXT_PUBLIC_APPWRITE_USAGE_DEDUCTIONS_ID || 'usage_deductions',
        NEXT_PUBLIC_APPWRITE_BILLING_ACCOUNTS_ID: process.env.NEXT_PUBLIC_APPWRITE_BILLING_ACCOUNTS_ID || 'billing_accounts',
        NEXT_PUBLIC_APPWRITE_BILLING_AUDIT_LOGS_ID: process.env.NEXT_PUBLIC_APPWRITE_BILLING_AUDIT_LOGS_ID || 'billing_audit_logs',
        NEXT_PUBLIC_APPWRITE_BILLING_SETTINGS_ID: process.env.NEXT_PUBLIC_APPWRITE_BILLING_SETTINGS_ID || 'billing_settings',
        NEXT_PUBLIC_APPWRITE_STORAGE_SNAPSHOTS_ID: process.env.NEXT_PUBLIC_APPWRITE_STORAGE_SNAPSHOTS_ID || 'storage_daily_snapshots',
        NEXT_PUBLIC_APPWRITE_INVOICES_ID: process.env.NEXT_PUBLIC_APPWRITE_INVOICES_ID || 'invoices',
        NEXT_PUBLIC_APPWRITE_PROCESSED_EVENTS_ID: process.env.NEXT_PUBLIC_APPWRITE_PROCESSED_EVENTS_ID || 'processed_events',
        NEXT_PUBLIC_AI_MODEL_PRICING_ID: process.env.NEXT_PUBLIC_AI_MODEL_PRICING_ID || 'ai_model_pricing',

        // ── Wallet Collections ──
        NEXT_PUBLIC_APPWRITE_WALLETS_ID: process.env.NEXT_PUBLIC_APPWRITE_WALLETS_ID || 'wallets',
        NEXT_PUBLIC_APPWRITE_WALLET_TRANSACTIONS_ID: process.env.NEXT_PUBLIC_APPWRITE_WALLET_TRANSACTIONS_ID || 'wallet_transactions',

        // ── Integration Collections ──
        NEXT_PUBLIC_APPWRITE_GITHUB_REPOS_ID: process.env.NEXT_PUBLIC_APPWRITE_GITHUB_REPOS_ID || 'github_repositories',
        NEXT_PUBLIC_APPWRITE_CODE_DOCS_ID: process.env.NEXT_PUBLIC_APPWRITE_CODE_DOCS_ID || 'code_documentation',

        // ── Team & Permission Collections ──
        NEXT_PUBLIC_APPWRITE_PROJECT_TEAMS_ID: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_TEAMS_ID || 'project_teams',
        NEXT_PUBLIC_APPWRITE_PROJECT_TEAM_MEMBERS_ID: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_TEAM_MEMBERS_ID || 'project_team_members',
        NEXT_PUBLIC_APPWRITE_PROJECT_PERMISSIONS_ID: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_PERMISSIONS_ID || 'project_permissions',

        // ── Program & Role Collections ──
        NEXT_PUBLIC_APPWRITE_PROGRAMS_ID: process.env.NEXT_PUBLIC_APPWRITE_PROGRAMS_ID || 'programs',
        NEXT_PUBLIC_APPWRITE_PROGRAM_MEMBERS_ID: process.env.NEXT_PUBLIC_APPWRITE_PROGRAM_MEMBERS_ID || 'program_members',
        NEXT_PUBLIC_APPWRITE_PROGRAM_MILESTONES_ID: process.env.NEXT_PUBLIC_APPWRITE_PROGRAM_MILESTONES_ID || 'program_milestones',
        NEXT_PUBLIC_APPWRITE_CUSTOM_ROLES_ID: process.env.NEXT_PUBLIC_APPWRITE_CUSTOM_ROLES_ID || 'custom_roles',

        // ── Space Collections ──
        NEXT_PUBLIC_APPWRITE_SPACES_ID: 'spaces',
        NEXT_PUBLIC_APPWRITE_SPACE_MEMBERS_ID: 'space_members',

        // ── Workflow Collections ──
        NEXT_PUBLIC_APPWRITE_WORKFLOWS_ID: 'workflows',
        NEXT_PUBLIC_APPWRITE_WORKFLOW_STATUSES_ID: 'workflow_statuses',
        NEXT_PUBLIC_APPWRITE_WORKFLOW_TRANSITIONS_ID: 'workflow_transitions',

        // ── Customization Collections ──
        NEXT_PUBLIC_APPWRITE_CUSTOM_FIELDS_ID: 'custom_fields',
        NEXT_PUBLIC_APPWRITE_CUSTOM_WORK_ITEM_TYPES_ID: 'custom_work_item_types',
        NEXT_PUBLIC_APPWRITE_WORK_ITEM_LINKS_ID: 'work_item_links',
        NEXT_PUBLIC_APPWRITE_SAVED_VIEWS_ID: 'saved_views',
        NEXT_PUBLIC_APPWRITE_SUBTASKS_ID: 'subtasks',
        NEXT_PUBLIC_APPWRITE_TIME_LOGS_ID: process.env.NEXT_PUBLIC_APPWRITE_TIME_LOGS_ID || 'time_logs',

        // ── Webhook Collections ──
        NEXT_PUBLIC_APPWRITE_PROJECT_WEBHOOKS_ID: 'project_webhooks',
        NEXT_PUBLIC_APPWRITE_PROJECT_WEBHOOK_DELIVERIES_ID: 'project_webhook_deliveries',

        // ── Storage Buckets ──
        NEXT_PUBLIC_APPWRITE_IMAGES_BUCKET_ID: process.env.NEXT_PUBLIC_APPWRITE_IMAGES_BUCKET_ID || 'images',
        NEXT_PUBLIC_APPWRITE_ATTACHMENTS_BUCKET_ID: process.env.NEXT_PUBLIC_APPWRITE_ATTACHMENTS_BUCKET_ID || 'attachments_bucket',
        NEXT_PUBLIC_APPWRITE_PROJECT_DOCS_BUCKET_ID: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_DOCS_BUCKET_ID || 'project-docs',

        // ── BYOB ──
        NEXT_PUBLIC_APPWRITE_BYOB_TENANTS_ID: process.env.NEXT_PUBLIC_APPWRITE_BYOB_TENANTS_ID || 'byob_tenants',

        // ── Billing Defaults ──
        BILLING_GRACE_PERIOD_DAYS: process.env.BILLING_GRACE_PERIOD_DAYS || '7',
        BILLING_CURRENCY: process.env.BILLING_CURRENCY || 'INR',
        USAGE_RATE_TRAFFIC_GB: process.env.USAGE_RATE_TRAFFIC_GB || '0.10',
        USAGE_RATE_STORAGE_GB_MONTH: process.env.USAGE_RATE_STORAGE_GB_MONTH || '0.05',
        USAGE_RATE_COMPUTE_UNIT: process.env.USAGE_RATE_COMPUTE_UNIT || '0.001',
        ENABLE_EMANDATE: process.env.ENABLE_EMANDATE || 'false',
        WALLET_DAILY_TOPUP_LIMIT: process.env.WALLET_DAILY_TOPUP_LIMIT || '50000',

        // ── Cloudflare R2 Defaults ──
        R2_BUCKET_NAME: process.env.R2_BUCKET_NAME || 'fairlx-storage',
    };
}

/**
 * Returns env vars that REQUIRE user action — secrets, API keys, etc.
 * These are written as empty strings (unless already set) with descriptions
 * for the warning summary.
 */
function getUserRequiredVars(): EnvVarEntry[] {
    return [
        // Cashfree
        {
            key: 'CASHFREE_APP_ID',
            value: process.env.CASHFREE_APP_ID || '',
            description: 'Cashfree App ID → https://merchant.cashfree.com/merchants/apikeys',
        },
        {
            key: 'CASHFREE_SECRET_KEY',
            value: process.env.CASHFREE_SECRET_KEY || '',
            description: 'Cashfree Secret Key → https://merchant.cashfree.com/merchants/apikeys',
        },
        {
            key: 'CASHFREE_WEBHOOK_SECRET',
            value: process.env.CASHFREE_WEBHOOK_SECRET || '',
            description: 'Cashfree Webhook Secret → Settings > Webhooks in Cashfree dashboard',
        },
        {
            key: 'EXCHANGE_RATE_API_KEY',
            value: process.env.EXCHANGE_RATE_API_KEY || '',
            description: 'Exchange Rate API key → https://www.exchangerate-api.com/',
        },

        // Security Secrets
        {
            key: 'CRON_SECRET',
            value: process.env.CRON_SECRET || '',
            description: 'Secret for securing cron job endpoints (generate a random string)',
        },
        {
            key: 'WALLET_SIG_SECRET',
            value: process.env.WALLET_SIG_SECRET || '',
            description: 'Secret for wallet signature verification (generate a random string)',
        },
        {
            key: 'TWO_FACTOR_ENCRYPTION_SECRET',
            value: process.env.TWO_FACTOR_ENCRYPTION_SECRET || '',
            description: 'Encryption secret for 2FA recovery codes (generate a 32-char hex string)',
        },
        {
            key: 'SOCKET_PUSH_SECRET',
            value: process.env.SOCKET_PUSH_SECRET || '',
            description: 'Secret for internal Socket.IO push endpoint (generate a random string)',
        },

        // AI & GitHub
        {
            key: 'GEMINI_API_KEY',
            value: process.env.GEMINI_API_KEY || '',
            description: 'Google Gemini API key → https://aistudio.google.com/apikey',
        },
        {
            key: 'GH_PERSONAL_TOKEN',
            value: process.env.GH_PERSONAL_TOKEN || '',
            description: 'GitHub Personal Access Token → https://github.com/settings/tokens',
        },

        // Appwrite Messaging
        {
            key: 'NEXT_PUBLIC_APPWRITE_SMTP_PROVIDER_ID',
            value: process.env.NEXT_PUBLIC_APPWRITE_SMTP_PROVIDER_ID || '',
            description: 'Appwrite SMTP provider ID → Create in Appwrite Console > Messaging',
        },
        {
            key: 'NEXT_PUBLIC_APPWRITE_EMAIL_TOPIC_ID',
            value: process.env.NEXT_PUBLIC_APPWRITE_EMAIL_TOPIC_ID || '',
            description: 'Appwrite Email Topic ID → Create in Appwrite Console > Messaging > Topics',
        },

        // Landing Page
        {
            key: 'LANDING_SUPABASE_URL',
            value: process.env.LANDING_SUPABASE_URL || '',
            description: 'Supabase URL for landing page → https://supabase.com/dashboard',
        },
        {
            key: 'LANDING_SUPABASE_SERVICE_ROLE_KEY',
            value: process.env.LANDING_SUPABASE_SERVICE_ROLE_KEY || '',
            description: 'Supabase Service Role Key → Project Settings > API in Supabase',
        },

        // Cloudflare R2 (production only)
        {
            key: 'R2_ACCOUNT_ID',
            value: process.env.R2_ACCOUNT_ID || '',
            description: 'Cloudflare Account ID → Cloudflare dashboard (production only)',
        },
        {
            key: 'R2_ACCESS_KEY_ID',
            value: process.env.R2_ACCESS_KEY_ID || '',
            description: 'R2 Access Key ID → Cloudflare R2 > Manage API Tokens (production only)',
        },
        {
            key: 'R2_SECRET_ACCESS_KEY',
            value: process.env.R2_SECRET_ACCESS_KEY || '',
            description: 'R2 Secret Access Key → Cloudflare R2 > Manage API Tokens (production only)',
        },
        {
            key: 'R2_PUBLIC_URL',
            value: process.env.R2_PUBLIC_URL || '',
            description: 'R2 public CDN URL → Custom domain for R2 bucket (production only)',
        },
        // BYOB Security
        {
            key: 'BYOB_ENCRYPTION_SECRET',
            value: process.env.BYOB_ENCRYPTION_SECRET || '',
            description: 'Encryption key for BYOB tenant env vars (generate a 32-byte hex string: openssl rand -hex 32)',
        },
    ];
}

// ─── Exported Setup Functions (callable from BYOB API) ───────

/**
 * Run all collection setup functions against the given databases/databaseId.
 * Used both by the CLI `main()` and programmatically by the BYOB initialize-db endpoint.
 *
 * @param onProgress Optional callback invoked after each collection completes
 */
export async function runCollectionSetups(
    databases: import('node-appwrite').Databases,
    databaseId: string,
    onProgress?: (name: string, index: number, total: number) => void,
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
            console.error(`\x1b[31m❌ Fatal error in collection "${name}": ${message}\x1b[0m`);
            failed.push(name);
        }
        onProgress?.(name, i + 1, collectionSetups.length);
    }

    return { succeeded, failed };
}

/**
 * Run all bucket setup functions against the given storage instance.
 * Used both by the CLI `main()` and programmatically by the BYOB initialize-db endpoint.
 *
 * @param onProgress Optional callback invoked after each bucket completes
 */
export async function runBucketSetups(
    storage: import('node-appwrite').Storage,
    onProgress?: (name: string, index: number, total: number) => void,
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
            console.error(`\x1b[31m❌ Fatal error in bucket "${name}": ${message}\x1b[0m`);
            failed.push(name);
        }
        onProgress?.(name, i + 1, bucketSetups.length);
    }

    return { succeeded, failed };
}

// ─── Main ────────────────────────────────────────────────────

async function main() {
    // ─── Step 0: Interactive Setup (prompt for core vars if missing) ───
    const setupOk = await runInteractiveSetup();
    if (!setupOk) {
        console.log('\x1b[31m❌ Setup aborted. Please run again when ready.\x1b[0m');
        process.exit(1);
    }

    // Now that core vars are guaranteed, initialize the Appwrite client
    const databases = getDatabases();
    const storage = getStorage();

    console.log('\n');
    logger.separator();
    console.log('\x1b[1m\x1b[35m🚀 FAIRLX DATABASE SETUP\x1b[0m');
    logger.separator();
    logger.info(`Database ID: ${DATABASE_ID}`);
    logger.info(`Total collections to process: ${collectionSetups.length}`);
    logger.info(`Storage buckets to process: 3`);
    console.log('');

    // Step 1: Ensure database exists
    logger.database(DATABASE_NAME);
    await ensureDatabase(databases, DATABASE_ID, DATABASE_NAME);

    // Step 1b: Ensure storage buckets exist
    console.log('');
    logger.separator();
    console.log('\x1b[1m\x1b[36m📦 STORAGE BUCKETS\x1b[0m');
    logger.separator();

    await runBucketSetups(storage);

    console.log('');

    // Step 2: Process all collections sequentially
    await runCollectionSetups(databases, DATABASE_ID);

    // Step 3: Write ALL env variables to .env.local
    console.log('');
    logger.separator();
    console.log('\x1b[1m\x1b[36m📝 WRITING ENV VARIABLES\x1b[0m');
    logger.separator();

    // 3a: Auto-generated vars (collection IDs, defaults)
    const autoVars = getAutoGeneratedVars();

    // 3b: User-required vars (secrets, API keys — write as empty if not set)
    const userRequiredVars = getUserRequiredVars();
    const manualVars: Record<string, string> = {};
    for (const entry of userRequiredVars) {
        manualVars[entry.key] = entry.value;
    }

    // Merge both
    const allVars = { ...autoVars, ...manualVars };
    writeEnvVars(allVars);

    // Step 4: Print summary
    printSummary();

    // Step 5: Print ACTION REQUIRED warnings for empty user-required vars
    const missingVars = userRequiredVars.filter((v) => !v.value);
    if (missingVars.length > 0) {
        console.log('');
        logger.separator();
        console.log('\x1b[1m\x1b[33m⚠️  ACTION REQUIRED — Add these values manually to .env.local\x1b[0m');
        logger.separator();
        console.log('');
        console.log('\x1b[33mThe following environment variables were created with EMPTY values.\x1b[0m');
        console.log('\x1b[33mYou must provide real credentials for these features to work:\x1b[0m');
        console.log('');

        // Group by category for readability
        const categories: Record<string, EnvVarEntry[]> = {};
        const categoryMap: Record<string, string> = {
            RAZORPAY: '💳 Payment (Cashfree)',
            EXCHANGE_RATE: '💱 Exchange Rates',
            CRON: '⏰ Cron Jobs',
            WALLET_SIG: '👛 Wallet Security',
            TWO_FACTOR: '🔐 Two-Factor Auth',
            SOCKET: '🔌 WebSocket',
            GEMINI: '🤖 AI (Gemini)',
            GH_PERSONAL: '🐙 GitHub Integration',
            SMTP: '📧 Email/Messaging',
            EMAIL_TOPIC: '📧 Email/Messaging',
            LANDING_SUPABASE: '🌐 Landing Page (Supabase)',
            R2: '☁️  Cloudflare R2 (Production)',
        };

        for (const entry of missingVars) {
            let matched = false;
            for (const [prefix, cat] of Object.entries(categoryMap)) {
                if (entry.key.includes(prefix)) {
                    if (!categories[cat]) categories[cat] = [];
                    categories[cat].push(entry);
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                const other = '🔧 Other';
                if (!categories[other]) categories[other] = [];
                categories[other].push(entry);
            }
        }

        for (const [category, entries] of Object.entries(categories)) {
            console.log(`  \x1b[1m${category}\x1b[0m`);
            for (const entry of entries) {
                console.log(`    \x1b[33m• ${entry.key}\x1b[0m`);
                console.log(`      \x1b[90m${entry.description}\x1b[0m`);
            }
            console.log('');
        }

        console.log(`\x1b[33m  Total: ${missingVars.length} variables need your attention.\x1b[0m`);
        console.log(`\x1b[90m  Edit .env.local and fill in the values above for a seamless experience.\x1b[0m`);
        logger.separator();
    } else {
        console.log('');
        console.log('\x1b[32m✅ All environment variables are configured! No manual action needed.\x1b[0m');
    }
}

// Execute
main().catch((err) => {
    console.error('\x1b[31m❌ Unhandled error during database setup:\x1b[0m', err);
    process.exit(1);
});

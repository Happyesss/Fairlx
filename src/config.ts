export const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
export const WORKSPACES_ID = process.env.NEXT_PUBLIC_APPWRITE_WORKSPACES_ID!;
export const MEMBERS_ID = process.env.NEXT_PUBLIC_APPWRITE_MEMBERS_ID!;
export const PROJECTS_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECTS_ID!;
export const TASKS_ID = process.env.NEXT_PUBLIC_APPWRITE_TASKS_ID!;
export const TIME_LOGS_ID = process.env.NEXT_PUBLIC_APPWRITE_TIME_LOGS_ID!;
export const SPRINTS_ID = process.env.NEXT_PUBLIC_APPWRITE_SPRINTS_ID!;
export const WORK_ITEMS_ID = process.env.NEXT_PUBLIC_APPWRITE_WORK_ITEMS_ID!;
export const PERSONAL_BACKLOG_ID = process.env.NEXT_PUBLIC_APPWRITE_PERSONAL_BACKLOG_ID!;
export const CUSTOM_COLUMNS_ID = process.env.NEXT_PUBLIC_APPWRITE_CUSTOM_COLUMNS_ID!;
export const DEFAULT_COLUMN_SETTINGS_ID = process.env.NEXT_PUBLIC_APPWRITE_DEFAULT_COLUMN_SETTINGS_ID!;
export const NOTIFICATIONS_ID = process.env.NEXT_PUBLIC_APPWRITE_NOTIFICATIONS_ID!;
export const SUBTASKS_ID = process.env.NEXT_PUBLIC_APPWRITE_SUBTASKS_ID!;
export const IMAGES_BUCKET_ID =
  process.env.NEXT_PUBLIC_APPWRITE_IMAGES_BUCKET_ID!
export const ATTACHMENTS_BUCKET_ID =
  process.env.NEXT_PUBLIC_APPWRITE_ATTACHMENTS_BUCKET_ID!
export const ATTACHMENTS_ID = process.env.NEXT_PUBLIC_APPWRITE_ATTACHMENTS_ID!
export const PROJECT_WEBHOOKS_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_WEBHOOKS_ID!;
export const PROJECT_WEBHOOK_DELIVERIES_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_WEBHOOK_DELIVERIES_ID!;

// Comments Collection
export const COMMENTS_ID = process.env.NEXT_PUBLIC_APPWRITE_COMMENTS_ID!;

// GitHub Integration Collections
export const GITHUB_REPOS_ID = process.env.NEXT_PUBLIC_APPWRITE_GITHUB_REPOS_ID!;
export const CODE_DOCS_ID = process.env.NEXT_PUBLIC_APPWRITE_CODE_DOCS_ID!;

// Project Documents Collections
export const PROJECT_DOCS_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_DOCS_ID!;
export const PROJECT_DOCS_BUCKET_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_DOCS_BUCKET_ID!;

// Teams & Programs Collections
export const PROGRAMS_ID = process.env.NEXT_PUBLIC_APPWRITE_PROGRAMS_ID!;
export const PROGRAM_MEMBERS_ID = process.env.NEXT_PUBLIC_APPWRITE_PROGRAM_MEMBERS_ID!;
export const PROGRAM_MILESTONES_ID = process.env.NEXT_PUBLIC_APPWRITE_PROGRAM_MILESTONES_ID!;
export const CUSTOM_ROLES_ID = process.env.NEXT_PUBLIC_APPWRITE_CUSTOM_ROLES_ID!;

// Project-Scoped RBAC Collections
export const PROJECT_MEMBERS_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_MEMBERS_ID!;
export const PROJECT_ROLES_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ROLES_ID!;
// NEW: Project-scoped teams (replacing workspace teams)
export const PROJECT_TEAMS_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_TEAMS_ID!;
export const PROJECT_TEAM_MEMBERS_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_TEAM_MEMBERS_ID!;
export const PROJECT_PERMISSIONS_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_PERMISSIONS_ID!;

// Email/Messaging Configuration
export const SMTP_PROVIDER_ID = process.env.NEXT_PUBLIC_APPWRITE_SMTP_PROVIDER_ID!;
export const EMAIL_TOPIC_ID = process.env.NEXT_PUBLIC_APPWRITE_EMAIL_TOPIC_ID!;

// ===============================
// NEW: Spaces & Workflows Collections
// ===============================
export const SPACES_ID = process.env.NEXT_PUBLIC_APPWRITE_SPACES_ID!;
export const SPACE_MEMBERS_ID = process.env.NEXT_PUBLIC_APPWRITE_SPACE_MEMBERS_ID!;

// Workflow Collections
export const WORKFLOWS_ID = process.env.NEXT_PUBLIC_APPWRITE_WORKFLOWS_ID!;
export const WORKFLOW_STATUSES_ID = process.env.NEXT_PUBLIC_APPWRITE_WORKFLOW_STATUSES_ID!;
export const WORKFLOW_TRANSITIONS_ID = process.env.NEXT_PUBLIC_APPWRITE_WORKFLOW_TRANSITIONS_ID!;

// Custom Fields Collections
export const CUSTOM_FIELDS_ID = process.env.NEXT_PUBLIC_APPWRITE_CUSTOM_FIELDS_ID!;
export const CUSTOM_WORK_ITEM_TYPES_ID = process.env.NEXT_PUBLIC_APPWRITE_CUSTOM_WORK_ITEM_TYPES_ID!;

// Work Item Links Collection
export const WORK_ITEM_LINKS_ID = process.env.NEXT_PUBLIC_APPWRITE_WORK_ITEM_LINKS_ID!;

// Saved Views/Filters Collection
export const SAVED_VIEWS_ID = process.env.NEXT_PUBLIC_APPWRITE_SAVED_VIEWS_ID!;

// ===============================
// Usage-Based Billing Collections
// ===============================
export const USAGE_EVENTS_ID = process.env.NEXT_PUBLIC_APPWRITE_USAGE_EVENTS_ID!;
export const USAGE_AGGREGATIONS_ID = process.env.NEXT_PUBLIC_APPWRITE_USAGE_AGGREGATIONS_ID!;
export const USAGE_ALERTS_ID = process.env.NEXT_PUBLIC_APPWRITE_USAGE_ALERTS_ID!;
// New collections for billing fixes
export const STORAGE_SNAPSHOTS_ID = process.env.NEXT_PUBLIC_APPWRITE_STORAGE_SNAPSHOTS_ID!;
export const INVOICES_ID = process.env.NEXT_PUBLIC_APPWRITE_INVOICES_ID!;

// ===============================
// Organizations & Account Management
// ===============================
export const ORGANIZATIONS_ID = process.env.NEXT_PUBLIC_APPWRITE_ORGANIZATIONS_ID!;
export const ORGANIZATION_MEMBERS_ID = process.env.NEXT_PUBLIC_APPWRITE_ORGANIZATION_MEMBERS_ID!;
export const ORGANIZATION_AUDIT_LOGS_ID = process.env.NEXT_PUBLIC_APPWRITE_ORGANIZATION_AUDIT_LOGS_ID!;
export const LOGIN_TOKENS_ID = process.env.NEXT_PUBLIC_APPWRITE_LOGIN_TOKENS_ID!;
export const VERIFICATION_TOKENS_ID = process.env.NEXT_PUBLIC_APPWRITE_VERIFICATION_TOKENS_ID || "verification_tokens";
// Departments (org-level grouping)
export const DEPARTMENTS_ID = process.env.NEXT_PUBLIC_APPWRITE_DEPARTMENTS_ID!;
export const ORG_MEMBER_DEPARTMENTS_ID = process.env.NEXT_PUBLIC_APPWRITE_ORG_MEMBER_DEPARTMENTS_ID!;
// Department permissions (org permissions owned by departments)
export const DEPARTMENT_PERMISSIONS_ID = process.env.NEXT_PUBLIC_APPWRITE_DEPARTMENT_PERMISSIONS_ID!;
// Explicit per-user org permissions
export const ORG_MEMBER_PERMISSIONS_ID = process.env.NEXT_PUBLIC_APPWRITE_ORG_MEMBER_PERMISSIONS_ID!;
// User preferences extended with accountType stored in Appwrite user.prefs

// Organization lifecycle settings
export const ORG_DELETE_GRACE_PERIOD_DAYS = parseInt(process.env.ORG_DELETE_GRACE_PERIOD_DAYS || "30");

// Usage Billing Rates (cents per unit)
export const USAGE_RATE_TRAFFIC_GB = parseFloat(process.env.USAGE_RATE_TRAFFIC_GB || "0.10");
export const USAGE_RATE_STORAGE_GB_MONTH = parseFloat(process.env.USAGE_RATE_STORAGE_GB_MONTH || "0.05");
export const USAGE_RATE_COMPUTE_UNIT = parseFloat(process.env.USAGE_RATE_COMPUTE_UNIT || "0.001");

// ===============================
// Billing & Payments Collections
// ===============================
export const BILLING_ACCOUNTS_ID = process.env.NEXT_PUBLIC_APPWRITE_BILLING_ACCOUNTS_ID!;
export const BILLING_AUDIT_LOGS_ID = process.env.NEXT_PUBLIC_APPWRITE_BILLING_AUDIT_LOGS_ID!;
export const PROCESSED_EVENTS_ID = process.env.NEXT_PUBLIC_APPWRITE_PROCESSED_EVENTS_ID!;

// ===============================
// Billing Configuration
// ===============================
export const BILLING_GRACE_PERIOD_DAYS = parseInt(process.env.BILLING_GRACE_PERIOD_DAYS || "14");
export const BILLING_CURRENCY = process.env.BILLING_CURRENCY || "USD";

// ===============================
// Wallet Security Configuration
// ===============================
/** Maximum daily top-up amount per wallet (paise). Default: ₹5,00,000 */
export const WALLET_DAILY_TOPUP_LIMIT = parseInt(process.env.WALLET_DAILY_TOPUP_LIMIT || "50000000");

// ===============================
// Cron Job Security
// ===============================
// Secret token to authenticate cron job requests
export const CRON_SECRET = process.env.CRON_SECRET;

// ===============================
// Wallet & Billing Mode Collections
// ===============================
export const WALLETS_ID = process.env.NEXT_PUBLIC_APPWRITE_WALLETS_ID!;
export const WALLET_TRANSACTIONS_ID = process.env.NEXT_PUBLIC_APPWRITE_WALLET_TRANSACTIONS_ID!;
export const USAGE_DEDUCTIONS_ID = process.env.NEXT_PUBLIC_APPWRITE_USAGE_DEDUCTIONS_ID!;

// ===============================
// Two-Factor Authentication (2FA)
// ===============================
export const USER_RECOVERY_CODES_ID = process.env.NEXT_PUBLIC_APPWRITE_USER_RECOVERY_CODES_ID || "user_recovery_codes";
export const EMAIL_OTP_CODES_ID = process.env.NEXT_PUBLIC_APPWRITE_EMAIL_OTP_CODES_ID || "email_otp_codes";
export const TWO_FACTOR_ENCRYPTION_SECRET = process.env.TWO_FACTOR_ENCRYPTION_SECRET!;

// ===============================
// Landing Page Supabase (GitHub Star Rewards)
// MOVED TO config.server.ts for security
// ===============================
// SECURITY: These credentials are now in config.server.ts which has 
// "server-only" protection to prevent accidental client bundle inclusion.
// Import from "@/config.server" instead.;

import { BYOB_TENANTS_ID, DATABASE_ID } from "@/config";

// ===============================
// Collection Configuration
// ===============================

export const BYOB_COLLECTION_ID = BYOB_TENANTS_ID;
export const BYOB_DATABASE_ID = DATABASE_ID;

// ===============================
// Setup Stepper Configuration
// ===============================

export const SETUP_STEPS = [
    {
        index: 0,
        label: "Create Organisation",
        description: "Choose your org slug and display name",
    },
    {
        index: 1,
        label: "Appwrite Credentials",
        description: "Provide your Appwrite endpoint, project, and API key",
    },
    {
        index: 2,
        label: "Additional Config",
        description: "Optional: SMTP, AI, storage, and payment settings",
    },
    {
        index: 3,
        label: "Database Setup",
        description: "Initialize all collections and storage buckets on your Appwrite",
    },
    {
        index: 4,
        label: "Create Your Account",
        description: "Set up your owner login credentials to manage this organisation",
    },
] as const;

// ===============================
// Validation
// ===============================

/** Regex for valid org slugs: lowercase alphanumeric + hyphens, 3–48 chars */
export const ORG_SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/;

/** Core Appwrite env var keys required for BYOB */
export const REQUIRED_CREDENTIAL_KEYS = [
    "NEXT_PUBLIC_APPWRITE_ENDPOINT",
    "NEXT_PUBLIC_APPWRITE_PROJECT",
    "NEXT_APPWRITE_KEY",
] as const;

/** Optional env var categories for Step 3 */
export const OPTIONAL_CONFIG_CATEGORIES = [
    {
        category: "Email / SMTP",
        keys: [
            "NEXT_PUBLIC_APPWRITE_SMTP_PROVIDER_ID",
            "NEXT_PUBLIC_APPWRITE_EMAIL_TOPIC_ID",
        ],
    },
    {
        category: "AI (Google Gemini)",
        keys: ["GEMINI_API_KEY", "GEMINI_MODEL"],
    },
    {
        category: "Payment (Cashfree)",
        keys: [
            "CASHFREE_APP_ID",
            "CASHFREE_SECRET_KEY",
            "CASHFREE_WEBHOOK_SECRET",
        ],
    },
    {
        category: "Cloudflare R2 Storage",
        keys: [
            "R2_ACCOUNT_ID",
            "R2_ACCESS_KEY_ID",
            "R2_SECRET_ACCESS_KEY",
            "R2_BUCKET_NAME",
            "R2_PUBLIC_URL",
        ],
    },
    {
        category: "GitHub Integration",
        keys: ["GH_PERSONAL_TOKEN"],
    },
] as const;

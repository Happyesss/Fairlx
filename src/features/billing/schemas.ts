import { z } from "zod";
import { BillingStatus, BillingAccountType, InvoiceStatus } from "./types";

// ===============================
// Enum Schemas
// ===============================

export const billingStatusSchema = z.nativeEnum(BillingStatus);
export const billingAccountTypeSchema = z.nativeEnum(BillingAccountType);
export const invoiceStatusSchema = z.nativeEnum(InvoiceStatus);

// ===============================
// Billing Account Schemas
// ===============================

/**
 * Schema for setting up billing (creating BillingAccount + Wallet)
 */
export const setupBillingSchema = z.object({
    type: billingAccountTypeSchema,
    userId: z.string().optional(),
    organizationId: z.string().optional(),
    billingEmail: z.string().email().optional(),
    contactName: z.string().min(1).max(255),
    contactPhone: z.string().optional(),
}).refine(
    (data) => {
        // PERSONAL requires userId, ORG requires organizationId
        if (data.type === BillingAccountType.PERSONAL) {
            return !!data.userId;
        }
        if (data.type === BillingAccountType.ORG) {
            return !!data.organizationId;
        }
        return false;
    },
    {
        message: "PERSONAL accounts require userId, ORG accounts require organizationId",
    }
);

/**
 * Schema for getting billing account
 */
export const getBillingAccountSchema = z.object({
    userId: z.string().optional(),
    organizationId: z.string().optional(),
}).refine(
    (data) => data.userId || data.organizationId,
    { message: "Either userId or organizationId is required" }
);

/**
 * Schema for updating billing account
 */
export const updateBillingAccountSchema = z.object({
    billingEmail: z.string().email().optional(),
    billingStatus: billingStatusSchema.optional(),
});

// ===============================
// Invoice Schemas
// ===============================

/**
 * Schema for getting invoices
 */
export const getInvoicesSchema = z.object({
    billingAccountId: z.string().optional(),
    userId: z.string().optional(),
    organizationId: z.string().optional(),
    status: invoiceStatusSchema.optional(),
    limit: z.coerce.number().min(1).max(100).default(24),
    offset: z.coerce.number().min(0).default(0),
}).refine(
    (data) => data.billingAccountId || data.userId || data.organizationId,
    { message: "billingAccountId, userId, or organizationId is required" }
);

/**
 * Schema for getting a single invoice
 */
export const getInvoiceSchema = z.object({
    invoiceId: z.string().min(1),
});

// ===============================
// Webhook Schemas
// ===============================

/**
 * Schema for Cashfree webhook header validation
 */
export const webhookHeadersSchema = z.object({
    "x-webhook-signature": z.string().min(1),
    "x-webhook-timestamp": z.string().min(1),
});

/**
 * Schema for Cashfree webhook event (one-time payment events only)
 */
export const webhookEventSchema = z.object({
    type: z.string(),
    event_time: z.string(),
    data: z.object({
        order: z.object({
            order_id: z.string(),
            order_amount: z.number(),
            order_currency: z.string(),
            order_tags: z.record(z.string()).optional(),
        }),
        payment: z.object({
            cf_payment_id: z.string(),
            payment_status: z.enum(["SUCCESS", "FAILED", "USER_DROPPED", "PENDING"]),
            payment_amount: z.number(),
            payment_currency: z.string(),
            payment_method: z.record(z.unknown()).optional(),
            payment_message: z.string().optional(),
        }).optional(),
        refund: z.object({
            refund_id: z.string(),
            cf_payment_id: z.string(),
            refund_amount: z.number(),
            refund_status: z.enum(["SUCCESS", "FAILED", "PENDING"]),
        }).optional(),
    }),
});

// ===============================
// Billing Status Schemas
// ===============================

/**
 * Schema for checking billing status
 */
export const checkBillingStatusSchema = z.object({
    userId: z.string().optional(),
    organizationId: z.string().optional(),
}).refine(
    (data) => data.userId || data.organizationId,
    { message: "Either userId or organizationId is required" }
);

// ===============================
// Admin/Internal Schemas
// ===============================

/**
 * Schema for generating invoice (internal use)
 */
export const generateInvoiceSchema = z.object({
    billingAccountId: z.string().min(1),
    cycleStart: z.string().datetime(),
    cycleEnd: z.string().datetime(),
    forceRegenerate: z.boolean().default(false),
});

/**
 * Schema for processing billing cycle (cron job)
 */
export const processBillingCycleSchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    dryRun: z.boolean().default(false),
});

/**
 * Schema for suspending account (internal use)
 */
export const suspendAccountSchema = z.object({
    billingAccountId: z.string().min(1),
    reason: z.string().optional(),
});

/**
 * Schema for restoring account (internal use)
 */
export const restoreAccountSchema = z.object({
    billingAccountId: z.string().min(1),
});

// ===============================
// Export Types
// ===============================

export type SetupBillingInput = z.infer<typeof setupBillingSchema>;
export type GetBillingAccountInput = z.infer<typeof getBillingAccountSchema>;
export type UpdateBillingAccountInput = z.infer<typeof updateBillingAccountSchema>;
export type GetInvoicesInput = z.infer<typeof getInvoicesSchema>;
export type WebhookEventInput = z.infer<typeof webhookEventSchema>;
export type GenerateInvoiceInput = z.infer<typeof generateInvoiceSchema>;
export type ProcessBillingCycleInput = z.infer<typeof processBillingCycleSchema>;

import { z } from "zod";
import { WalletTransactionType } from "./types";

// ===============================
// Wallet Validation Schemas
// ===============================

/**
 * Schema for creating a Cashfree top-up order
 * This creates the order server-side; frontend opens Cashfree Checkout with it
 */
export const createTopupOrderSchema = z.object({
    /** Amount in smallest currency unit (paise). Min ₹1, Max ₹1,00,000 */
    amount: z.number().min(100, "Minimum top-up is ₹1").max(100000000, "Maximum top-up is ₹10,00,000"),
    /** Currency - defaults to USD on server */
    currency: z.string().optional(),
    /** Organization ID (for org wallets) */
    organizationId: z.string().optional(),
    /** User ID (for personal wallets) */
    userId: z.string().optional(),
});

export type CreateTopupOrderInput = z.infer<typeof createTopupOrderSchema>;

/**
 * Schema for verifying a Cashfree top-up payment after checkout
 * Requires Cashfree payment details + signature for verification
 */
export const verifyTopupSchema = z.object({
    /** Cashfree Order ID */
    cashfreeOrderId: z.string().min(1),
    /** Cashfree Payment ID (cfPaymentId) — optional, backend fetches from API if not provided */
    cfPaymentId: z.string().optional(),
    /** Order amount for signature verification — optional, backend fetches from API */
    orderAmount: z.number().positive().optional(),
    /** Cashfree Signature for verification — optional, backend verifies via API instead */
    signature: z.string().optional(),
});

export type VerifyTopupInput = z.infer<typeof verifyTopupSchema>;

/**
 * Schema for getting wallet balance
 */
export const getWalletBalanceSchema = z.object({
    userId: z.string().optional(),
    organizationId: z.string().optional(),
}).refine(
    (data) => data.userId || data.organizationId,
    { message: "Either userId or organizationId is required" }
);

export type GetWalletBalanceInput = z.infer<typeof getWalletBalanceSchema>;

/**
 * Schema for listing wallet transactions
 */
export const getTransactionsSchema = z.object({
    limit: z.coerce.number().min(1).max(100).default(20),
    offset: z.coerce.number().min(0).default(0),
    type: z.nativeEnum(WalletTransactionType).optional(),
});

export type GetTransactionsInput = z.infer<typeof getTransactionsSchema>;

/**
 * Schema for usage deduction from wallet (internal use)
 * Used by billing system to deduct from wallet
 */
export const deductUsageSchema = z.object({
    /** Amount to deduct in smallest currency unit (paise) */
    amount: z.number().min(1),
    /** Reference ID (invoice ID, usage event ID, etc.) */
    referenceId: z.string().min(1),
    /** Idempotency key to prevent double-deduction */
    idempotencyKey: z.string().min(1).max(64),
    /** Description for the deduction */
    description: z.string().optional(),
});

export type DeductUsageInput = z.infer<typeof deductUsageSchema>;

/**
 * Schema for holding funds in wallet (async jobs)
 */
export const holdWalletSchema = z.object({
    /** Amount to hold in smallest currency unit (paise) */
    amount: z.number().min(1),
    /** Reference ID for the hold */
    referenceId: z.string().min(1),
    /** Idempotency key */
    idempotencyKey: z.string().min(1).max(64),
    /** Description */
    description: z.string().optional(),
});

export type HoldWalletInput = z.infer<typeof holdWalletSchema>;

/**
 * Schema for releasing a hold on wallet funds
 */
export const releaseHoldSchema = z.object({
    /** Amount to release */
    amount: z.number().min(1),
    /** Reference ID matching the original hold */
    referenceId: z.string().min(1),
    /** Idempotency key */
    idempotencyKey: z.string().min(1).max(64),
    /** If true, commit the hold as a DEBIT instead of releasing back to balance */
    confirm: z.boolean().default(false),
});

export type ReleaseHoldInput = z.infer<typeof releaseHoldSchema>;

/**
 * Schema for wallet refund (internal use)
 */
export const refundWalletSchema = z.object({
    amount: z.number().min(1),
    referenceId: z.string().min(1),
    idempotencyKey: z.string().min(1).max(64),
    reason: z.string().optional(),
});

export type RefundWalletInput = z.infer<typeof refundWalletSchema>;

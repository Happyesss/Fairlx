import "server-only";

import { Cashfree } from "cashfree-pg";
import { CFEnvironment } from "cashfree-pg/dist/configuration";
import crypto from "crypto";

/**
 * Cashfree Payments Client Utility
 * 
 * Provides initialized Cashfree instance and helper functions
 * for one-time payment operations and webhook verification.
 * 
 * WALLET-ONLY: This module handles Cashfree interactions for
 * wallet top-ups only. No mandates, subscriptions, or recurring payments.
 * 
 * SECURITY:
 * - API keys loaded from environment variables
 * - Webhook signatures verified with HMAC-SHA256(timestamp + body), base64
 * - Payment signatures verified after checkout
 * - All sensitive operations are server-side only
 * 
 * CRITICAL DIFFERENCES FROM RAZORPAY:
 * - order_amount is in RUPEES (major units), not paise
 * - Webhook signature = HMAC-SHA256(timestamp + rawBody), base64-encoded
 * - Order ID must be caller-generated (not auto-generated)
 * - No standalone Customer API — customer details embedded per order
 */

// ===============================
// Cashfree Instance
// ===============================

let cashfreeInstance: Cashfree | null = null;

/**
 * Get Cashfree instance (singleton pattern)
 * 
 * WHY singleton: Avoids creating multiple instances,
 * which could cause rate limiting issues.
 */
/**
 * Get the current Cashfree environment mode for frontend
 */
export function getCashfreeMode(): "sandbox" | "production" {
    if (process.env.CASHFREE_ENV === "PRODUCTION") return "production";
    if (process.env.CASHFREE_ENV === "SANDBOX") return "sandbox";
    return process.env.NODE_ENV === "production" ? "production" : "sandbox";
}

export function getCashfree(): Cashfree {
    if (!cashfreeInstance) {
        const appId = process.env.CASHFREE_APP_ID;
        const secretKey = process.env.CASHFREE_SECRET_KEY;

        if (!appId || !secretKey) {
            throw new Error(
                "[Cashfree] Missing credentials. Set CASHFREE_APP_ID and CASHFREE_SECRET_KEY."
            );
        }

        // Allow manual override via CASHFREE_ENV, fallback to NODE_ENV logic
        let environment: CFEnvironment;
        if (process.env.CASHFREE_ENV === "PRODUCTION") {
            environment = CFEnvironment.PRODUCTION;
        } else if (process.env.CASHFREE_ENV === "SANDBOX") {
            environment = CFEnvironment.SANDBOX;
        } else {
            environment = process.env.NODE_ENV === "production"
                ? CFEnvironment.PRODUCTION
                : CFEnvironment.SANDBOX;
        }

        cashfreeInstance = new Cashfree(environment, appId, secretKey);
    }

    return cashfreeInstance;
}

// ===============================
// Webhook Verification
// ===============================

/**
 * Verify Cashfree webhook signature
 * 
 * CRITICAL: Always verify webhooks before processing.
 * Never trust unverified webhook payloads.
 * 
 * DIFFERENCE FROM RAZORPAY: Cashfree uses HMAC-SHA256(timestamp + rawBody)
 * encoded as base64. Razorpay used HMAC-SHA256(rawBody) encoded as hex.
 * 
 * @param body - Raw request body (string)
 * @param signature - x-webhook-signature header value
 * @param timestamp - x-webhook-timestamp header value
 * @param secret - Webhook secret from Cashfree dashboard
 * @returns true if signature is valid
 */
export function verifyWebhookSignature(
    body: string,
    signature: string,
    timestamp: string,
    secret?: string
): boolean {
    // FIXED: Use dedicated CASHFREE_WEBHOOK_SECRET, fallback to API key
    const webhookSecret = secret 
        || process.env.CASHFREE_WEBHOOK_SECRET 
        || process.env.CASHFREE_SECRET_KEY;

    if (!process.env.CASHFREE_WEBHOOK_SECRET) {
        console.warn("[Cashfree] CASHFREE_WEBHOOK_SECRET not set — falling back to CASHFREE_SECRET_KEY for webhook verification. Set CASHFREE_WEBHOOK_SECRET from the Cashfree dashboard.");
    }

    if (!webhookSecret || !timestamp) {
        return false;
    }

    try {
        const payload = timestamp + body;
        const expectedSignature = crypto
            .createHmac("sha256", webhookSecret)
            .update(payload)
            .digest("base64");

        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expectedSignature)
        );
    } catch {
        return false;
    }
}

/**
 * Verify Cashfree payment signature (for checkout flow)
 * 
 * Used to verify payment after Cashfree Checkout completes.
 * This confirms the payment is authentic before crediting the wallet.
 * 
 * @param orderId - Cashfree Order ID
 * @param orderAmount - Order amount as string
 * @param referenceId - Cashfree payment reference ID (cfPaymentId)
 * @param signature - Signature from checkout response
 * @returns true if signature is valid
 */
export function verifyPaymentSignature(
    orderId: string,
    orderAmount: string,
    referenceId: string,
    signature: string
): boolean {
    const secretKey = process.env.CASHFREE_SECRET_KEY;

    if (!secretKey) {
        return false;
    }

    try {
        const payload = orderId + orderAmount + referenceId;
        const expectedSignature = crypto
            .createHmac("sha256", secretKey)
            .update(payload)
            .digest("base64");

        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expectedSignature)
        );
    } catch {
        return false;
    }
}

// ===============================
// Customer Operations
// ===============================

export interface CreateCustomerOptions {
    name: string;
    email: string;
    contact?: string;
    notes?: Record<string, string>;
}

/**
 * Create a Cashfree customer
 * 
 * NOTE: Cashfree does not have a standalone Customer API for one-time payments.
 * Customer details are embedded per order. This function returns a stable
 * customer_id derived from the email hash for use in orders.
 */
export async function createCustomer(options: CreateCustomerOptions): Promise<{ id: string; email: string }> {
    // Derive a stable customer_id from email hash
    // Cashfree customer_id max 50 chars, we use 32
    const stableId = crypto
        .createHash("sha256")
        .update(options.email.toLowerCase())
        .digest("hex")
        .slice(0, 32);

    return { id: stableId, email: options.email };
}

// ===============================
// Order Operations (for wallet top-ups)
// ===============================

export interface CreateOrderOptions {
    amount: number; // Amount in smallest currency unit (paise)
    currency: string;
    orderId: string; // Caller-generated — Cashfree requires it upfront
    customerId: string;
    customerEmail: string;
    customerPhone?: string;
    notes?: Record<string, string>;
}

/**
 * Create a Cashfree order for one-time wallet top-up
 * 
 * CRITICAL: Cashfree order_amount is in RUPEES (major units), not paise.
 * This function accepts paise and divides by 100 before sending.
 */
export async function createOrder(options: CreateOrderOptions) {
    const cashfree = getCashfree();

    // Cashfree amount is in major units (rupees), not paise
    const amountInMajorUnits = options.amount / 100;

    // Sanitize notify_url: Cashfree Production often rejects localhost URLs
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    const isLocalhost = appUrl.includes("localhost") || appUrl.includes("127.0.0.1");
    const notifyUrl = isLocalhost ? undefined : `${appUrl}/api/webhooks/cashfree`;

    // Sanitize customer_phone: must be a 10-digit string for some providers
    let phone = options.customerPhone || "9999999999";
    phone = phone.replace(/\D/g, "").slice(-10);
    if (phone.length < 10) phone = "9999999999";

    const request = {
        order_id: options.orderId,
        order_amount: amountInMajorUnits,
        order_currency: options.currency,
        customer_details: {
            customer_id: options.customerId,
            customer_email: options.customerEmail,
            customer_phone: phone,
        },
        order_meta: {
            notify_url: notifyUrl,
        },
        order_tags: options.notes,
    };

    try {
        const response = await cashfree.PGCreateOrder(request);
        return response;
    } catch (error: unknown) {
        throw error;
    }
}

/**
 * Get payments for a Cashfree order
 * 
 * Equivalent to Razorpay's getPayment — Cashfree returns payments
 * associated with an order rather than fetching by payment ID directly.
 */
export async function getOrderPayments(orderId: string) {
    const cashfree = getCashfree();
    return cashfree.PGOrderFetchPayments(orderId);
}

// ===============================
// Utility Functions
// ===============================

/**
 * Get Cashfree public key for frontend
 */
export function getPublicKey(): string {
    const appId = process.env.CASHFREE_APP_ID;
    if (!appId) {
        throw new Error("[Cashfree] CASHFREE_APP_ID not configured");
    }
    return appId;
}

/**
 * Format amount for internal representation (convert to paisa/cents)
 */
export function formatAmount(amount: number): number {
    // Amount coming in is already in USD cents (internal representation).
    // No change needed here — conversion to INR paise happens in route.
    return Math.round(amount * 100);
}

/**
 * Parse amount from paisa/cents to major units
 */
export function parseAmount(amount: number): number {
    return amount / 100;
}

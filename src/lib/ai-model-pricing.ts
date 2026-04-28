import "server-only";

import { Databases, Models, Query } from "node-appwrite";
import { DATABASE_ID, AI_MODEL_PRICING_ID } from "@/config";

// ============================================================================
// TYPES
// ============================================================================

export interface AIModelPricing {
    modelId: string;
    displayName: string;
    inputPricePerMillionTokens: number;
    outputPricePerMillionTokens: number;
    isActive: boolean;
    tier: "economy" | "standard" | "flagship";
    pricingSource: "google_scraper" | "google_api" | "admin_override" | "fallback_default";
    lastSyncedAt?: string;
    inputTokenLimit?: number;
    outputTokenLimit?: number;
    supportedMethods?: string[];
}

// Appwrite document shape
type AIModelPricingDoc = Models.Document & AIModelPricing & {
    supportedMethods?: string; // stored as JSON string in DB
};

// ============================================================================
// HARDCODED FALLBACK DEFAULTS (emergency-only)
// ============================================================================

/**
 * Fallback pricing used ONLY when both DB and pricing sync are unavailable.
 * Based on Google's published pricing as of 2026-04.
 * Updated during code deployments — serves as a safety net.
 */
const AI_MODEL_PRICING_DEFAULTS: Record<string, AIModelPricing> = {
    "gemini-2.5-flash": {
        modelId: "gemini-2.5-flash",
        displayName: "Gemini 2.5 Flash",
        inputPricePerMillionTokens: 0.15,
        outputPricePerMillionTokens: 0.60,
        isActive: true,
        tier: "economy",
        pricingSource: "fallback_default",
    },
    "gemini-2.5-pro": {
        modelId: "gemini-2.5-pro",
        displayName: "Gemini 2.5 Pro",
        inputPricePerMillionTokens: 1.25,
        outputPricePerMillionTokens: 10.00,
        isActive: true,
        tier: "standard",
        pricingSource: "fallback_default",
    },
    "gemini-2.5-flash-lite": {
        modelId: "gemini-2.5-flash-lite",
        displayName: "Gemini 2.5 Flash Lite",
        inputPricePerMillionTokens: 0.075,
        outputPricePerMillionTokens: 0.30,
        isActive: true,
        tier: "economy",
        pricingSource: "fallback_default",
    },
    "gemini-2.0-flash": {
        modelId: "gemini-2.0-flash",
        displayName: "Gemini 2.0 Flash",
        inputPricePerMillionTokens: 0.10,
        outputPricePerMillionTokens: 0.40,
        isActive: true,
        tier: "economy",
        pricingSource: "fallback_default",
    },
    "gemini-3-flash-preview": {
        modelId: "gemini-3-flash-preview",
        displayName: "Gemini 3 Flash Preview",
        inputPricePerMillionTokens: 0.15,
        outputPricePerMillionTokens: 0.60,
        isActive: true,
        tier: "standard",
        pricingSource: "fallback_default",
    },
    "gemini-3.1-pro-preview": {
        modelId: "gemini-3.1-pro-preview",
        displayName: "Gemini 3.1 Pro Preview",
        inputPricePerMillionTokens: 1.25,
        outputPricePerMillionTokens: 10.00,
        isActive: true,
        tier: "flagship",
        pricingSource: "fallback_default",
    },
};

// ============================================================================
// IN-MEMORY CACHE (5-min TTL)
// ============================================================================

interface CacheEntry {
    pricing: AIModelPricing;
    expiresAt: number;
}

const pricingCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Cache for all active models (used by model picker UI)
let allModelsCache: { models: AIModelPricing[]; expiresAt: number } | null = null;
const ALL_MODELS_CACHE_TTL_MS = 5 * 60 * 1000;

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Normalize a model ID to its base form.
 *
 * Gemini API responses sometimes include suffixes like ":generateContent"
 * or version prefixes like "models/". Strip those for pricing lookup.
 *
 * Examples:
 *   "models/gemini-2.5-flash:generateContent" → "gemini-2.5-flash"
 *   "models/gemini-2.5-flash" → "gemini-2.5-flash"
 *   "gemini-2.5-flash" → "gemini-2.5-flash"
 */
export function normalizeModelId(rawModelId: string): string {
    let modelId = rawModelId;

    // Strip "models/" prefix
    if (modelId.startsWith("models/")) {
        modelId = modelId.slice(7);
    }

    // Strip ":generateContent" or similar method suffix
    const colonIdx = modelId.indexOf(":");
    if (colonIdx !== -1) {
        modelId = modelId.slice(0, colonIdx);
    }

    return modelId;
}

/**
 * Get pricing for a specific AI model.
 *
 * Resolution order:
 * 1. In-memory cache (5-min TTL)
 * 2. Database (ai_model_pricing collection)
 * 3. Hardcoded fallback defaults
 *
 * @param databases - Appwrite Databases instance
 * @param rawModelId - Model ID (may include "models/" prefix or ":generateContent" suffix)
 * @returns AIModelPricing for the requested model
 */
export async function getAIModelPricing(
    databases: Databases,
    rawModelId: string
): Promise<AIModelPricing> {
    const modelId = normalizeModelId(rawModelId);

    // 1. Check in-memory cache
    const cached = pricingCache.get(modelId);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.pricing;
    }

    // 2. Try database
    try {
        const docs = await databases.listDocuments<AIModelPricingDoc>(
            DATABASE_ID,
            AI_MODEL_PRICING_ID,
            [
                Query.equal("modelId", modelId),
                Query.equal("isActive", true),
                Query.limit(1),
            ]
        );

        if (docs.total > 0) {
            const doc = docs.documents[0];
            const pricing: AIModelPricing = {
                modelId: doc.modelId,
                displayName: doc.displayName,
                inputPricePerMillionTokens: doc.inputPricePerMillionTokens,
                outputPricePerMillionTokens: doc.outputPricePerMillionTokens,
                isActive: doc.isActive,
                tier: doc.tier,
                pricingSource: doc.pricingSource,
                lastSyncedAt: doc.lastSyncedAt,
                inputTokenLimit: doc.inputTokenLimit,
                outputTokenLimit: doc.outputTokenLimit,
                supportedMethods: doc.supportedMethods
                    ? JSON.parse(doc.supportedMethods as string)
                    : undefined,
            };

            // Update cache
            pricingCache.set(modelId, {
                pricing,
                expiresAt: Date.now() + CACHE_TTL_MS,
            });

            return pricing;
        }
    } catch (error) {
        console.warn(`[AIModelPricing] DB lookup failed for "${modelId}":`, error);
        // Fall through to hardcoded defaults
    }

    // 3. Hardcoded fallback
    return getFallbackPricing(modelId);
}

/**
 * Get fallback pricing for a model.
 *
 * Tries exact match first, then partial match on the base model family.
 * If no match found, returns a safe economy-tier default.
 */
export function getFallbackPricing(rawModelId: string): AIModelPricing {
    const modelId = normalizeModelId(rawModelId);

    // Exact match
    if (AI_MODEL_PRICING_DEFAULTS[modelId]) {
        return AI_MODEL_PRICING_DEFAULTS[modelId];
    }

    // Partial match: try to find a model family match
    // e.g. "gemini-2.5-flash-001" should match "gemini-2.5-flash"
    for (const [key, pricing] of Object.entries(AI_MODEL_PRICING_DEFAULTS)) {
        if (modelId.startsWith(key) || key.startsWith(modelId)) {
            return { ...pricing, modelId };
        }
    }

    // Ultimate fallback: return a safe economy-tier default
    // WHY: We never want to crash just because we don't recognize a model.
    // Use the cheapest tier so we at least log *some* cost.
    console.warn(`[AIModelPricing] No pricing found for "${modelId}", using economy fallback`);
    return {
        modelId,
        displayName: modelId,
        inputPricePerMillionTokens: 0.15,
        outputPricePerMillionTokens: 0.60,
        isActive: true,
        tier: "economy",
        pricingSource: "fallback_default",
    };
}

/**
 * Calculate the exact USD cost for an AI call.
 *
 * @param pricing - Model pricing data
 * @param promptTokens - Number of input/prompt tokens
 * @param completionTokens - Number of output/completion tokens
 * @returns Cost in USD (e.g., 0.0024)
 */
export function calculateAICallCostUSD(
    pricing: AIModelPricing,
    promptTokens: number,
    completionTokens: number
): number {
    const inputCost = (promptTokens / 1_000_000) * pricing.inputPricePerMillionTokens;
    const outputCost = (completionTokens / 1_000_000) * pricing.outputPricePerMillionTokens;
    return inputCost + outputCost;
}

/**
 * Get all active AI models from the database.
 *
 * Used by the future model-picker UI to show available models.
 * Results are cached for 5 minutes.
 *
 * @param databases - Appwrite Databases instance
 * @returns Array of active model pricing records
 */
export async function getAllActiveModels(
    databases: Databases
): Promise<AIModelPricing[]> {
    // Check cache
    if (allModelsCache && allModelsCache.expiresAt > Date.now()) {
        return allModelsCache.models;
    }

    try {
        const docs = await databases.listDocuments<AIModelPricingDoc>(
            DATABASE_ID,
            AI_MODEL_PRICING_ID,
            [
                Query.equal("isActive", true),
                Query.orderAsc("displayName"),
                Query.limit(100),
            ]
        );

        const models: AIModelPricing[] = docs.documents.map((doc) => ({
            modelId: doc.modelId,
            displayName: doc.displayName,
            inputPricePerMillionTokens: doc.inputPricePerMillionTokens,
            outputPricePerMillionTokens: doc.outputPricePerMillionTokens,
            isActive: doc.isActive,
            tier: doc.tier,
            pricingSource: doc.pricingSource,
            lastSyncedAt: doc.lastSyncedAt,
            inputTokenLimit: doc.inputTokenLimit,
            outputTokenLimit: doc.outputTokenLimit,
            supportedMethods: doc.supportedMethods
                ? JSON.parse(doc.supportedMethods as string)
                : undefined,
        }));

        // Update cache
        allModelsCache = {
            models,
            expiresAt: Date.now() + ALL_MODELS_CACHE_TTL_MS,
        };

        return models;
    } catch (error) {
        console.warn("[AIModelPricing] Failed to fetch all models:", error);

        // Return fallback defaults
        return Object.values(AI_MODEL_PRICING_DEFAULTS);
    }
}

/**
 * Invalidate the pricing cache for a specific model or all models.
 * Called after the pricing sync job updates DB records.
 */
export function invalidatePricingCache(modelId?: string): void {
    if (modelId) {
        pricingCache.delete(normalizeModelId(modelId));
    } else {
        pricingCache.clear();
        allModelsCache = null;
    }
}

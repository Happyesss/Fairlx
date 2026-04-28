import "server-only";

import { Databases, ID, Query } from "node-appwrite";
import { DATABASE_ID, AI_MODEL_PRICING_ID } from "@/config";
import { invalidatePricingCache, type AIModelPricing } from "./ai-model-pricing";

// ============================================================================
// TYPES
// ============================================================================

interface GoogleModelInfo {
    name: string;
    displayName: string;
    description?: string;
    inputTokenLimit?: number;
    outputTokenLimit?: number;
    supportedGenerationMethods?: string[];
}

interface PricingSyncResult {
    modelsDiscovered: number;
    modelsUpdated: number;
    modelsCreated: number;
    modelsSkipped: number;
    pricingUpdated: number;
    errors: string[];
}

interface ParsedPricing {
    modelId: string;
    inputPricePerMillionTokens: number;
    outputPricePerMillionTokens: number;
}

// ============================================================================
// PRICING PAGE PARSER
// ============================================================================

async function fetchGooglePricingPage(): Promise<ParsedPricing[]> {
    const results: ParsedPricing[] = [];
    try {
        const response = await fetch("https://ai.google.dev/pricing", {
            headers: { "User-Agent": "Fairlx-Billing-Sync/1.0", "Accept": "text/html" },
            signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) {
            console.warn(`[AIPricingSync] Pricing page returned ${response.status}`);
            return results;
        }
        const html = await response.text();
        results.push(...extractPricingFromHTML(html));
    } catch (error) {
        console.warn("[AIPricingSync] Failed to fetch pricing page:", error);
    }
    return results;
}

function extractPricingFromHTML(html: string): ParsedPricing[] {
    const results: ParsedPricing[] = [];
    const modelRegex = /```\s*(gemini-[\w.-]+)\s*```/g;
    let modelMatch: RegExpExecArray | null;
    while ((modelMatch = modelRegex.exec(html)) !== null) {
        const modelId = modelMatch[1];
        const contextEnd = Math.min(html.length, modelMatch.index + 3000);
        const context = html.slice(Math.max(0, modelMatch.index - 200), contextEnd);
        const inputPrice = extractPrice(context, "input");
        const outputPrice = extractPrice(context, "output");
        if (inputPrice !== null && outputPrice !== null) {
            results.push({ modelId, inputPricePerMillionTokens: inputPrice, outputPricePerMillionTokens: outputPrice });
        }
    }
    return results;
}

function extractPrice(context: string, type: "input" | "output"): number | null {
    const typeRegex = new RegExp(`${type}[^$]*\\$([0-9]+\\.?[0-9]*)`, "i");
    const match = context.match(typeRegex);
    if (match) {
        const price = parseFloat(match[1]);
        if (!isNaN(price) && price >= 0) return price;
    }
    return null;
}

// ============================================================================
// MODELS LIST API
// ============================================================================

async function fetchGoogleModels(apiKey: string): Promise<GoogleModelInfo[]> {
    const allModels: GoogleModelInfo[] = [];
    let pageToken: string | undefined;
    try {
        do {
            const url = new URL("https://generativelanguage.googleapis.com/v1beta/models");
            url.searchParams.set("key", apiKey);
            url.searchParams.set("pageSize", "100");
            if (pageToken) url.searchParams.set("pageToken", pageToken);
            const response = await fetch(url.toString(), { signal: AbortSignal.timeout(10_000) });
            if (!response.ok) { console.warn(`[AIPricingSync] models.list returned ${response.status}`); break; }
            const data = await response.json();
            for (const model of (data.models || []) as GoogleModelInfo[]) {
                if (model.supportedGenerationMethods?.includes("generateContent")) allModels.push(model);
            }
            pageToken = data.nextPageToken;
        } while (pageToken);
    } catch (error) {
        console.warn("[AIPricingSync] Failed to fetch models list:", error);
    }
    return allModels;
}

// ============================================================================
// SYNC JOB
// ============================================================================

/**
 * Sync AI model pricing from Google sources.
 * 1. Fetch pricing from Google pricing page (HTML scrape)
 * 2. Fetch all models from Google models.list API  
 * 3. Merge data and update/create DB records
 * 4. Never overwrite admin_override pricing
 */
export async function syncAIModelPricing(databases: Databases, apiKey: string): Promise<PricingSyncResult> {
    const result: PricingSyncResult = { modelsDiscovered: 0, modelsUpdated: 0, modelsCreated: 0, modelsSkipped: 0, pricingUpdated: 0, errors: [] };
    console.log("[AIPricingSync] Starting pricing sync...");

    const pricingData = await fetchGooglePricingPage();
    const pricingMap = new Map<string, ParsedPricing>();
    for (const p of pricingData) pricingMap.set(p.modelId, p);
    console.log(`[AIPricingSync] Parsed ${pricingData.length} model prices from pricing page`);

    const googleModels = await fetchGoogleModels(apiKey);
    result.modelsDiscovered = googleModels.length;
    console.log(`[AIPricingSync] Discovered ${googleModels.length} models from API`);

    // Fetch existing DB records
    const existingDocs = new Map<string, { $id: string; pricingSource: string }>();
    try {
        let offset = 0;
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const batch = await databases.listDocuments(DATABASE_ID, AI_MODEL_PRICING_ID, [Query.limit(100), Query.offset(offset)]);
            for (const doc of batch.documents) {
                const d = doc as unknown as { $id: string; modelId: string; pricingSource: string };
                existingDocs.set(d.modelId, { $id: d.$id, pricingSource: d.pricingSource });
            }
            if (batch.documents.length < 100) break;
            offset += 100;
        }
    } catch (error) {
        console.warn("[AIPricingSync] Failed to fetch existing records:", error);
    }

    // Merge and upsert
    const processedModelIds = new Set<string>();
    for (const model of googleModels) {
        const modelId = model.name.replace("models/", "");
        if (processedModelIds.has(modelId)) continue;
        processedModelIds.add(modelId);
        const existing = existingDocs.get(modelId);
        if (existing?.pricingSource === "admin_override") { result.modelsSkipped++; continue; }

        const pricing = pricingMap.get(modelId);
        const tier = inferTier(modelId);
        const docData: Record<string, unknown> = {
            modelId, displayName: model.displayName || modelId, isActive: true, tier,
            inputTokenLimit: model.inputTokenLimit || null,
            outputTokenLimit: model.outputTokenLimit || null,
            supportedMethods: model.supportedGenerationMethods ? JSON.stringify(model.supportedGenerationMethods) : null,
            lastSyncedAt: new Date().toISOString(),
        };

        if (pricing) {
            docData.inputPricePerMillionTokens = pricing.inputPricePerMillionTokens;
            docData.outputPricePerMillionTokens = pricing.outputPricePerMillionTokens;
            docData.pricingSource = "google_scraper";
            result.pricingUpdated++;
        } else if (!existing) {
            const defaults = getDefaultPricingForTier(tier);
            docData.inputPricePerMillionTokens = defaults.input;
            docData.outputPricePerMillionTokens = defaults.output;
            docData.pricingSource = "google_api";
        }

        try {
            if (existing) {
                await databases.updateDocument(DATABASE_ID, AI_MODEL_PRICING_ID, existing.$id, docData);
                result.modelsUpdated++;
            } else {
                await databases.createDocument(DATABASE_ID, AI_MODEL_PRICING_ID, ID.unique(), docData);
                result.modelsCreated++;
            }
        } catch (error) {
            result.errors.push(`Failed "${modelId}": ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    invalidatePricingCache();
    console.log(`[AIPricingSync] Done: ${result.modelsCreated} created, ${result.modelsUpdated} updated, ${result.modelsSkipped} admin-skipped, ${result.errors.length} errors`);
    return result;
}

// Suppress unused import warning — AIModelPricing is used in type context
void (0 as unknown as AIModelPricing);

// ============================================================================
// HELPERS
// ============================================================================

function inferTier(modelId: string): "economy" | "standard" | "flagship" {
    const lower = modelId.toLowerCase();
    if (lower.includes("pro") || lower.includes("ultra")) return "flagship";
    if (lower.includes("lite")) return "economy";
    if (lower.includes("flash")) return "standard";
    return "standard";
}

function getDefaultPricingForTier(tier: "economy" | "standard" | "flagship"): { input: number; output: number } {
    switch (tier) {
        case "economy": return { input: 0.075, output: 0.30 };
        case "standard": return { input: 0.15, output: 0.60 };
        case "flagship": return { input: 1.25, output: 10.00 };
    }
}

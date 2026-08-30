import "server-only";

import { ResourceType } from "@/features/usage/types";
import {
    USAGE_RATE_TRAFFIC_GB,
    USAGE_RATE_STORAGE_GB_MONTH,
    USAGE_RATE_COMPUTE_UNIT
} from "@/config";
import { bytesToGB, calculateUsageCostUsd } from "@/lib/usage-cost";

/**
 * Centralized Pricing Logic
 *
 * WHY: Ensures consistent cost calculation across:
 * 1. Instant deduction (Usage Ledger)
 * 2. Daily aggregation (Cron Job)
 * 3. UI Dashboard (Estimated Cost)
 *
 * Rates from config.ts are in CENTS. calculateUsageCostUsd converts them to USD.
 */

const RATE_CENTS = {
    trafficPerGB: USAGE_RATE_TRAFFIC_GB,
    storagePerGBMonth: USAGE_RATE_STORAGE_GB_MONTH,
    computePerUnit: USAGE_RATE_COMPUTE_UNIT,
};

/**
 * Calculate the cost of a usage event in USD.
 * Supports high precision (up to 6+ decimal places).
 */
export function calculateEventCostUSD(
    resourceType: ResourceType,
    units: number, // units for compute, bytes for traffic/storage
    weightedUnits?: number // for compute weighting
): number {
    const computeUnits = weightedUnits !== undefined ? weightedUnits : units;

    switch (resourceType) {
        case ResourceType.TRAFFIC:
            return calculateUsageCostUsd(
                { trafficGB: bytesToGB(units), storageAvgGB: 0, computeUnits: 0 },
                RATE_CENTS
            ).traffic;

        case ResourceType.STORAGE:
            /**
             * STORAGE COST CALCULATION:
             * Storage is billed as GB-month.
             * For instantaneous events (upload/delete), we can't easily calculate
             * the "cost of the event" without knowing how long it will be stored.
             *
             * SOLUTION:
             * For "instant deduction", we skip storage events and rely on the
             * daily snapshot aggregation for accurate storage billing.
             */
            return 0;

        case ResourceType.COMPUTE:
            return calculateUsageCostUsd(
                { trafficGB: 0, storageAvgGB: 0, computeUnits },
                RATE_CENTS
            ).compute;

        default:
            return 0;
    }
}

/**
 * Calculate the monthly cost of storage (GB-month)
 */
export function calculateStorageMonthlyCostUSD(storageAvgGB: number): number {
    return calculateUsageCostUsd(
        { trafficGB: 0, storageAvgGB, computeUnits: 0 },
        RATE_CENTS
    ).storage;
}

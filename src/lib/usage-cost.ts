/**
 * Canonical usage-cost math.
 *
 * Billing is always USD. Display/visibility currencies convert USD * exchangeRate.
 * Config rates are CENTS; convert with centsToUsd() before multiplying quantities.
 *
 * This module is client-safe (no server-only import) so dashboard UI and
 * server billing/aggregation can share one formula.
 */

export const BYTES_PER_GB = 1024 * 1024 * 1024;

/** Product rates in cents: $0.12/GB, $0.02/GB-month, $0.01/compute unit. */
export const DEFAULT_USAGE_RATE_CENTS = {
    trafficPerGB: 12,
    storagePerGBMonth: 2,
    computePerUnit: 1,
} as const;

export type UsageRateCents = {
    trafficPerGB: number;
    storagePerGBMonth: number;
    computePerUnit: number;
};

export type UsageCostInput = {
    trafficGB: number;
    storageAvgGB: number;
    computeUnits: number;
    aiCostUSD?: number;
};

export type UsageCostUsd = {
    traffic: number;
    storage: number;
    compute: number;
    ai: number;
    total: number;
};

export type UsageRatesUsd = {
    trafficPerGBUsd: number;
    storagePerGBMonthUsd: number;
    computePerUnitUsd: number;
    billingCurrency: "USD";
};

export function roundUsd(value: number): number {
    return Number(value.toFixed(6));
}

export function centsToUsd(cents: number): number {
    return cents / 100;
}

export function bytesToGB(bytes: number): number {
    return bytes / BYTES_PER_GB;
}

export function gbToBytes(gb: number): number {
    return gb * BYTES_PER_GB;
}

export function resolveUsageRateCents(
    overrides?: Partial<UsageRateCents>
): UsageRateCents {
    return {
        trafficPerGB: overrides?.trafficPerGB ?? DEFAULT_USAGE_RATE_CENTS.trafficPerGB,
        storagePerGBMonth: overrides?.storagePerGBMonth ?? DEFAULT_USAGE_RATE_CENTS.storagePerGBMonth,
        computePerUnit: overrides?.computePerUnit ?? DEFAULT_USAGE_RATE_CENTS.computePerUnit,
    };
}

export function getUsageRatesUsd(
    rateCents?: Partial<UsageRateCents>
): UsageRatesUsd {
    const cents = resolveUsageRateCents(rateCents);
    return {
        trafficPerGBUsd: centsToUsd(cents.trafficPerGB),
        storagePerGBMonthUsd: centsToUsd(cents.storagePerGBMonth),
        computePerUnitUsd: centsToUsd(cents.computePerUnit),
        billingCurrency: "USD",
    };
}

export function emptyUsageCost(): UsageCostUsd {
    return { traffic: 0, storage: 0, compute: 0, ai: 0, total: 0 };
}

/**
 * USD cost for a usage snapshot.
 * Storage must be GB-month (time-weighted average), not raw current bytes.
 */
export function calculateUsageCostUsd(
    input: UsageCostInput,
    rateCents?: Partial<UsageRateCents>
): UsageCostUsd {
    const rates = getUsageRatesUsd(rateCents);
    const traffic = roundUsd((input.trafficGB || 0) * rates.trafficPerGBUsd);
    const storage = roundUsd(Math.max(0, input.storageAvgGB || 0) * rates.storagePerGBMonthUsd);
    const compute = roundUsd((input.computeUnits || 0) * rates.computePerUnitUsd);
    const ai = roundUsd(input.aiCostUSD || 0);
    return {
        traffic,
        storage,
        compute,
        ai,
        total: roundUsd(traffic + storage + compute + ai),
    };
}

export function sumUsageCosts(costs: UsageCostUsd[]): UsageCostUsd {
    return costs.reduce(
        (acc, cost) => ({
            traffic: roundUsd(acc.traffic + cost.traffic),
            storage: roundUsd(acc.storage + cost.storage),
            compute: roundUsd(acc.compute + cost.compute),
            ai: roundUsd(acc.ai + cost.ai),
            total: roundUsd(acc.total + cost.total),
        }),
        emptyUsageCost()
    );
}

export function daysInUtcMonth(isoDate: string): number {
    const [year, month] = isoDate.split("-").map(Number);
    if (!year || !month) return 30;
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Storage is billed as GB-month. Daily aggregation should debit a calendar-day
 * slice of the month-to-date GB-month cost so a month of snapshots equals ~1x.
 */
export function dailyStorageDebitUsd(
    storageAvgGB: number,
    rateCents?: Partial<UsageRateCents>,
    isoDate?: string
): number {
    const monthly = calculateUsageCostUsd(
        { trafficGB: 0, storageAvgGB, computeUnits: 0 },
        rateCents
    ).storage;
    const days = daysInUtcMonth(isoDate || new Date().toISOString());
    return roundUsd(monthly / Math.max(1, days));
}

export function formatUsdAsDisplayCurrency(
    amountUsd: number,
    currency = "USD",
    exchangeRate = 1
): string {
    const converted = amountUsd * exchangeRate;
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: converted < 0.1 && converted > 0 ? 6 : 2,
    }).format(converted);
}

export type WorkspaceUsageAccumulator = {
    trafficBytes: number;
    storageAvgGB: number;
    storagePeriod: string;
    computeUnits: number;
    aiTokens: number;
    aiCostUSD: number;
};

export function emptyWorkspaceUsage(): WorkspaceUsageAccumulator {
    return {
        trafficBytes: 0,
        storageAvgGB: 0,
        storagePeriod: "",
        computeUnits: 0,
        aiTokens: 0,
        aiCostUSD: 0,
    };
}

export function aggregatedPeriodKey(workspaceId: string, period: string): string {
    return `${workspaceId}:${period}`;
}

/** Keep the latest month-to-date GB-month; never sum daily monthly averages. */
export function applyLatestStorageAvg(
    acc: WorkspaceUsageAccumulator,
    period: string,
    storageAvgGB: number
): void {
    if (!acc.storagePeriod || period >= acc.storagePeriod) {
        acc.storagePeriod = period;
        acc.storageAvgGB = storageAvgGB;
    }
}

export function workspaceUsageToBreakdown(
    acc: WorkspaceUsageAccumulator,
    rateCents?: Partial<UsageRateCents>
) {
    const estimatedCost = calculateUsageCostUsd(
        {
            trafficGB: bytesToGB(acc.trafficBytes),
            storageAvgGB: acc.storageAvgGB,
            computeUnits: acc.computeUnits,
            aiCostUSD: acc.aiCostUSD,
        },
        rateCents
    );
    return {
        traffic: acc.trafficBytes,
        storage: gbToBytes(acc.storageAvgGB),
        compute: acc.computeUnits,
        ai: acc.aiTokens,
        aiCost: acc.aiCostUSD,
        estimatedCost,
    };
}

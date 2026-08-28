import { describe, expect, it } from "vitest";
import {
    applyLatestStorageAvg,
    bytesToGB,
    calculateUsageCostUsd,
    centsToUsd,
    dailyStorageDebitUsd,
    daysInUtcMonth,
    DEFAULT_USAGE_RATE_CENTS,
    emptyWorkspaceUsage,
    formatUsdAsDisplayCurrency,
    gbToBytes,
    getUsageRatesUsd,
    sumUsageCosts,
    workspaceUsageToBreakdown,
} from "./usage-cost";

const PRODUCT_RATES = DEFAULT_USAGE_RATE_CENTS;

describe("centsToUsd", () => {
    it("converts advertised product rates to USD", () => {
        expect(centsToUsd(12)).toBe(0.12);
        expect(centsToUsd(2)).toBe(0.02);
        expect(centsToUsd(1)).toBe(0.01);
    });
});

describe("calculateUsageCostUsd", () => {
    it("bills 157 compute units at $0.01 each, not $0.00157", () => {
        const cost = calculateUsageCostUsd(
            { trafficGB: 0, storageAvgGB: 0, computeUnits: 157 },
            PRODUCT_RATES
        );
        expect(cost.compute).toBe(1.57);
        expect(cost.total).toBe(1.57);
    });

    it("bills traffic at $0.12 per GB", () => {
        const trafficGB = 59.32 / 1024;
        const cost = calculateUsageCostUsd(
            { trafficGB, storageAvgGB: 0, computeUnits: 0 },
            PRODUCT_RATES
        );
        expect(cost.traffic).toBeCloseTo(trafficGB * 0.12, 6);
    });

    it("bills storage as GB-month, not raw bytes times the monthly rate", () => {
        const billedGbMonth = 6.14 / 1024;
        const rawBytesAsGb = 48.21 / 1024;
        const billed = calculateUsageCostUsd(
            { trafficGB: 0, storageAvgGB: billedGbMonth, computeUnits: 0 },
            PRODUCT_RATES
        );
        const overstated = calculateUsageCostUsd(
            { trafficGB: 0, storageAvgGB: rawBytesAsGb, computeUnits: 0 },
            PRODUCT_RATES
        );
        expect(billed.storage).toBeCloseTo(billedGbMonth * 0.02, 6);
        expect(overstated.storage).toBeGreaterThan(billed.storage * 5);
    });

    it("includes AI metadata cost as USD passthrough", () => {
        const cost = calculateUsageCostUsd(
            { trafficGB: 0, storageAvgGB: 0, computeUnits: 0, aiCostUSD: 0.42 },
            PRODUCT_RATES
        );
        expect(cost.ai).toBe(0.42);
        expect(cost.total).toBe(0.42);
    });

    it("matches event-level traffic and compute math used by the wallet path", () => {
        const trafficBytes = 100 * 1024 * 1024;
        const trafficGB = bytesToGB(trafficBytes);
        const fromSnapshot = calculateUsageCostUsd(
            { trafficGB, storageAvgGB: 0, computeUnits: 40 },
            PRODUCT_RATES
        );
        expect(fromSnapshot.traffic).toBe(calculateUsageCostUsd(
            { trafficGB, storageAvgGB: 0, computeUnits: 0 },
            PRODUCT_RATES
        ).traffic);
        expect(fromSnapshot.compute).toBe(0.4);
    });
});

describe("workspace vs org totals", () => {
    it("sums per-workspace USD costs to the org total", () => {
        const stemlen = calculateUsageCostUsd(
            {
                trafficGB: bytesToGB(53.08 * 1024 * 1024),
                storageAvgGB: bytesToGB(6.14 * 1024 * 1024),
                computeUnits: 157,
                aiCostUSD: 0,
            },
            PRODUCT_RATES
        );
        const surendra = calculateUsageCostUsd(
            {
                trafficGB: bytesToGB(6.24 * 1024 * 1024),
                storageAvgGB: 0,
                computeUnits: 0,
                aiCostUSD: 0,
            },
            PRODUCT_RATES
        );
        const orgFromWorkspaces = sumUsageCosts([stemlen, surendra]);
        const orgFromTotals = calculateUsageCostUsd(
            {
                trafficGB: bytesToGB((53.08 + 6.24) * 1024 * 1024),
                storageAvgGB: bytesToGB(6.14 * 1024 * 1024),
                computeUnits: 157,
                aiCostUSD: 0,
            },
            PRODUCT_RATES
        );
        expect(orgFromWorkspaces.total).toBeCloseTo(orgFromTotals.total, 5);
        expect(orgFromWorkspaces.compute).toBe(1.57);
    });
});

describe("display currency", () => {
    it("converts billed USD to visibility currency without changing the USD amount", () => {
        const usd = 1.57;
        const inrRate = 95.58;
        expect(formatUsdAsDisplayCurrency(usd, "INR", inrRate)).toMatch(/150\.06/);
        expect(usd * inrRate).toBeCloseTo(150.0606, 4);
        expect(getUsageRatesUsd(PRODUCT_RATES).billingCurrency).toBe("USD");
    });
});

describe("storage daily debit", () => {
    it("charges a calendar-day slice of GB-month so 31 days ≈ one month", () => {
        const monthly = calculateUsageCostUsd(
            { trafficGB: 0, storageAvgGB: 1, computeUnits: 0 },
            PRODUCT_RATES
        ).storage;
        expect(monthly).toBe(0.02);
        expect(daysInUtcMonth("2026-08-15")).toBe(31);
        const daily = dailyStorageDebitUsd(1, PRODUCT_RATES, "2026-08-15");
        expect(daily).toBeCloseTo(0.02 / 31, 6);
        // Daily slice is rounded to 6 USD decimals, so 31 * daily ≈ monthly.
        expect(daily * 31).toBeCloseTo(0.02, 4);
    });
});

describe("bytes helpers", () => {
    it("round-trips GB and bytes", () => {
        expect(bytesToGB(gbToBytes(2))).toBe(2);
        expect(gbToBytes(1)).toBe(1024 * 1024 * 1024);
    });
});

describe("latest storage GB-month", () => {
    it("does not sum daily monthly averages across the month", () => {
        const acc = emptyWorkspaceUsage();
        applyLatestStorageAvg(acc, "2026-08-01", 0.005);
        applyLatestStorageAvg(acc, "2026-08-05", 0.006);
        applyLatestStorageAvg(acc, "2026-08-03", 0.004);
        expect(acc.storageAvgGB).toBe(0.006);
        expect(acc.storagePeriod).toBe("2026-08-05");

        acc.trafficBytes = gbToBytes(0.05);
        acc.computeUnits = 157;
        const breakdown = workspaceUsageToBreakdown(acc, PRODUCT_RATES);
        expect(breakdown.estimatedCost.compute).toBe(1.57);
        expect(breakdown.estimatedCost.storage).toBeCloseTo(0.006 * 0.02, 6);
    });
});

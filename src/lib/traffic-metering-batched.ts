import "server-only";

import { createMiddleware } from "hono/factory";
import { Databases } from "node-appwrite";
import { DATABASE_ID } from "@/config";
import { ResourceType, UsageSource } from "@/features/usage/types";
import { writeUsageEvent, generateTrafficIdempotencyKey } from "./usage-ledger";

/**
 * Traffic Metering System
 * 
 * DESIGN:
 * Writes traffic events immediately using the central Usage Ledger.
 * Ensures usage is recorded even in serverless environments where
 * background timers/global buffers are killed.
 */

type MeteringContext = {
    Variables: {
        databases?: Databases;
        user?: { $id: string; prefs?: Record<string, string | number | boolean | null> };
    };
};

/**
 * Calculate approximate size of request/response in bytes
 */
function estimatePayloadSize(obj: unknown): number {
    if (obj === null || obj === undefined) return 0;
    try {
        const str = typeof obj === 'string' ? obj : JSON.stringify(obj);
        return new Blob([str]).size;
    } catch {
        return 0;
    }
}

/**
 * Extract workspace ID from request (URL or body)
 */
function extractWorkspaceId(url: string, body?: Record<string, unknown>): string | null {
    try {
        const urlObj = new URL(url, 'http://localhost');
        const pathname = urlObj.pathname;

        const matches = [
            pathname.match(/\/workspaces\/([a-zA-Z0-9_-]+)/),
            pathname.match(/workspaceId=([a-zA-Z0-9_-]+)/)
        ];

        for (const match of matches) {
            if (match && match[1]) return match[1];
        }

        const queryWorkspaceId = urlObj.searchParams.get('workspaceId');
        if (queryWorkspaceId) return queryWorkspaceId;

        // Try body
        if (body && typeof body.workspaceId === 'string') {
            return body.workspaceId;
        }
    } catch {
        const pathMatch = url.match(/\/workspaces\/([a-zA-Z0-9_-]+)/);
        if (pathMatch) return pathMatch[1];
    }

    return null;
}

/**
 * Extract organization ID from request (URL or body)
 */
function extractOrganizationId(url: string, body?: Record<string, unknown>): string | null {
    try {
        const urlObj = new URL(url, 'http://localhost');
        const pathname = urlObj.pathname;

        const matches = [
            pathname.match(/\/organizations\/([a-zA-Z0-9_-]+)/),
            pathname.match(/organizationId=([a-zA-Z0-9_-]+)/),
            pathname.match(/orgId=([a-zA-Z0-9_-]+)/)
        ];

        for (const match of matches) {
            if (match && match[1]) return match[1];
        }

        const queryOrgId = urlObj.searchParams.get('organizationId') || urlObj.searchParams.get('orgId');
        if (queryOrgId) return queryOrgId;

        // Try body
        if (body) {
            if (typeof body.organizationId === 'string') return body.organizationId;
            if (typeof body.orgId === 'string') return body.orgId;
        }
    } catch {
        const orgMatch = url.match(/\/organizations\/([a-zA-Z0-9_-]+)/);
        if (orgMatch) return orgMatch[1];
    }

    return null;
}

/**
 * Extract project ID from request
 */
function extractProjectId(url: string): string | null {
    const pathMatch = url.match(/\/projects\/([a-zA-Z0-9]+)/);
    if (pathMatch) return pathMatch[1];

    try {
        const urlObj = new URL(url, 'http://localhost');
        const queryProjectId = urlObj.searchParams.get('projectId');
        if (queryProjectId) return queryProjectId;
    } catch {
        // ignore
    }

    return null;
}

/**
 * Flush and stop (Deprecated/No-op after refactor to immediate)
 */
export async function flushAndStop() {
    // No-op
}

/**
 * Traffic metering middleware
 * 
 * Writes usage events immediately using the Usage Ledger.
 */
export const batchedTrafficMeteringMiddleware = createMiddleware<MeteringContext>(
    async (c, next) => {
        const startTime = Date.now();
        const requestUrl = c.req.url;
        const requestMethod = c.req.method;

        // Estimate request size and extract Body if applicable
        let requestBody: Record<string, unknown> | undefined = undefined;
        const contentLength = c.req.header('content-length');
        const requestSize = contentLength ? parseInt(contentLength, 10) : 0;

        // SAFELY attempt to parse body for JSON requests to extract IDs
        // Note: For POST/PUT/PATCH we need the IDs for attribution
        if (['POST', 'PUT', 'PATCH'].includes(requestMethod)) {
            const contentTypeHeader = c.req.header('content-type') || '';
            if (contentTypeHeader.includes('application/json')) {
                try {
                    // Clone and read JSON body
                    const clone = c.req.raw.clone();
                    requestBody = await clone.json().catch(() => ({}));
                } catch {
                    // Ignore body parsing errors
                }
            }
        }

        // Execute route handler
        await next();

        // Calculate response size (skip for streaming)
        let responseSize = 0;
        const contentType = c.res.headers.get("content-type") || "";
        const isStreaming = contentType.includes("text/event-stream") ||
            contentType.includes("text/plain") ||
            contentType.includes("application/octet-stream");

        if (!isStreaming) {
            try {
                const responseBody = c.res.clone();
                const text = await responseBody.text();
                responseSize = estimatePayloadSize(text);
            } catch {
                responseSize = 0;
            }
        }

        const duration = Date.now() - startTime;
        let workspaceId = extractWorkspaceId(requestUrl, requestBody);
        const organizationId = extractOrganizationId(requestUrl, requestBody);
        const projectId = extractProjectId(requestUrl);
        const databases = c.get('databases');
        const user = c.get('user');

        if (!databases) return;

        // Resolve Org -> First Workspace for contextless routes
        if (!workspaceId) {
            const targetOrgId = organizationId || extractOrganizationId(requestUrl, requestBody);
            if (targetOrgId) {
                try {
                    const { Query } = await import('node-appwrite');
                    const { WORKSPACES_ID } = await import('@/config');
                    const ws = await databases.listDocuments(
                        DATABASE_ID,
                        WORKSPACES_ID,
                        [Query.equal('organizationId', targetOrgId), Query.limit(1)]
                    );
                    if (ws.total > 0) {
                        workspaceId = ws.documents[0].$id;
                    }
                } catch (err) {
                    console.warn("[TrafficMetering] Could not resolve workspace from org:", err);
                }
            }
        }

        if (!workspaceId) return;

        const endpoint = new URL(requestUrl, 'http://localhost').pathname;
        const byobOrgSlug = user?.prefs?.byobOrgSlug as string | undefined;

        // Log immediately via central ledger
        // Use setImmediate to avoid blocking the user response, but ensures it runs
        setImmediate(async () => {
            try {
                await writeUsageEvent(databases, {
                    idempotencyKey: generateTrafficIdempotencyKey(workspaceId!, endpoint, requestMethod),
                    workspaceId: workspaceId!,
                    projectId: projectId || undefined,
                    resourceType: ResourceType.TRAFFIC,
                    units: requestSize + responseSize,
                    source: UsageSource.API,
                    metadata: {
                        endpoint,
                        method: requestMethod,
                        durationMs: duration,
                        statusCode: c.res.status,
                        isByob: !!byobOrgSlug,
                        byobOrgSlug,
                    }
                });
            } catch (err) {
                console.error("[TrafficMetering] Log failed:", err);
            }
        });
    }
);

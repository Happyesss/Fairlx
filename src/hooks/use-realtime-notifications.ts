/**
 * Realtime Notifications Hook
 * 
 * React hook for subscribing to real-time notifications using Appwrite Realtime.
 * Automatically subscribes to new notifications and invalidates queries for fresh data.
 * 
 * Usage:
 * ```tsx
 * const { isConnected, latestNotification } = useRealtimeNotifications({
 *   workspaceId,
 *   userId,
 *   onNewNotification: (notification) => {
 *     toast({ title: notification.title, description: notification.summary });
 *   }
 * });
 * ```
 */

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Client, RealtimeResponseEvent } from "appwrite";
import { Notification } from "@/features/notifications/types";

// =============================================================================
// TYPES
// =============================================================================

export interface RealtimeNotification {
    id: string;
    type: string;
    title: string;
    summary: string;
    workitemId: string;
    workspaceId: string;
    triggeredBy: string;
    timestamp: string;
    deepLinkUrl: string;
    read: boolean;
}

interface UseRealtimeNotificationsOptions {
    /** Current workspace ID */
    workspaceId: string;
    /** Current user ID */
    userId: string;
    /** Callback when a new notification arrives */
    onNewNotification?: (notification: RealtimeNotification) => void;
    /** Whether to enable realtime subscription (default: true) */
    enabled?: boolean;
}

interface UseRealtimeNotificationsReturn {
    /** Whether connected to realtime */
    isConnected: boolean;
    /** Latest notification received */
    latestNotification: RealtimeNotification | null;
    /** Connection error if any */
    error: Error | null;
}

// =============================================================================
// APPWRITE CLIENT (SINGLETON)
// =============================================================================

let clientInstance: Client | null = null;
let realtimeSuppressionActive = false;

function getAppwriteClient(): Client {
    if (!clientInstance) {
        clientInstance = new Client()
            .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
            .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT!);
        
        // Suppress realtime reconnection console messages (they're handled automatically)
        if (!realtimeSuppressionActive && typeof window !== 'undefined') {
            realtimeSuppressionActive = true;
            const originalWarn = console.warn;
            const originalLog = console.log;
            const originalError = console.error;
            
            console.warn = (...args: unknown[]) => {
                const message = args[0];
                if (typeof message === 'string' && message.includes('Realtime got disconnected')) {
                    return; // Suppress this specific warning
                }
                originalWarn.apply(console, args);
            };
            
            console.log = (...args: unknown[]) => {
                const message = args[0];
                if (typeof message === 'string' && message.includes('Realtime got disconnected')) {
                    return; // Suppress this specific log
                }
                originalLog.apply(console, args);
            };

            console.error = (...args: unknown[]) => {
                const message = args[0];
                if (typeof message === 'string' && message.includes('Realtime got disconnected')) {
                    return; // Suppress this specific error
                }
                originalError.apply(console, args);
            };
        }
    }
    return clientInstance;
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

export function useRealtimeNotifications({
    workspaceId,
    userId,
    onNewNotification,
    enabled = true,
}: UseRealtimeNotificationsOptions): UseRealtimeNotificationsReturn {
    const [isConnected, setIsConnected] = useState(false);
    const [latestNotification, setLatestNotification] = useState<RealtimeNotification | null>(null);
    const [error, setError] = useState<Error | null>(null);

    const queryClient = useQueryClient();
    const callbackRef = useRef(onNewNotification);
    callbackRef.current = onNewNotification;

    // Transform Appwrite notification to our format
    const transformNotification = useCallback((doc: Notification): RealtimeNotification => {
        const appUrl = typeof window !== 'undefined' ? window.location.origin : '';

        return {
            id: doc.$id,
            type: doc.type,
            title: doc.title,
            summary: doc.message,
            workitemId: doc.taskId,
            workspaceId: doc.workspaceId,
            triggeredBy: doc.triggeredBy,
            timestamp: doc.$createdAt,
            deepLinkUrl: `${appUrl}/workspaces/${doc.workspaceId}/tasks/${doc.taskId}`,
            read: doc.read,
        };
    }, []);

    useEffect(() => {
        if (!enabled || !workspaceId || !userId) {
            setIsConnected(false);
            return;
        }

        const client = getAppwriteClient();
        const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
        const notificationsId = process.env.NEXT_PUBLIC_APPWRITE_NOTIFICATIONS_ID!;

        // Subscribe to notification collection changes
        const channel = `databases.${databaseId}.collections.${notificationsId}.documents`;

        let unsubscribe: (() => void) | null = null;

        try {
            unsubscribe = client.subscribe<Notification>(
                channel,
                (response: RealtimeResponseEvent<Notification>) => {
                    // Only process create events
                    if (!response.events.some((e: string) => e.includes('.create'))) {
                        return;
                    }

                    const notification = response.payload;

                    // Filter for current user
                    if (notification.userId !== userId) {
                        return;
                    }

                    // Filter for current workspace (optional - user might want all)
                    // if (notification.workspaceId !== workspaceId) {
                    //   return;
                    // }

                    const transformed = transformNotification(notification);
                    setLatestNotification(transformed);

                    // Invalidate queries to refresh the notification list and count
                    queryClient.invalidateQueries({
                        queryKey: ["notifications"]
                    });
                    queryClient.invalidateQueries({
                        queryKey: ["unread-count"]
                    });

                    // Trigger callback for toast/alert
                    if (callbackRef.current) {
                        callbackRef.current(transformed);
                    }
                }
            );

            setIsConnected(true);
            setError(null);

            // Silent success - no console logging to reduce noise
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to subscribe'));
            setIsConnected(false);
        }

        return () => {
            if (unsubscribe) {
                unsubscribe();
                // Silent cleanup
            }
            setIsConnected(false);
        };
    }, [workspaceId, userId, enabled, transformNotification, queryClient]);

    return {
        isConnected,
        latestNotification,
        error,
    };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get WebSocket event name for notification type
 */
export function getSocketEventName(type: string): string {
    switch (type) {
        case 'task_assigned':
            return 'workitem:assigned';
        case 'task_completed':
            return 'workitem:completed';
        case 'task_comment':
            return 'workitem:commented';
        default:
            return 'workitem:updated';
    }
}

/**
 * Transform raw notification data to RealtimeNotification format
 */
export function transformToRealtimeNotification(doc: {
    $id: string;
    $createdAt: string;
    type: string;
    title: string;
    message: string;
    taskId: string;
    workspaceId: string;
    triggeredBy: string;
    read: boolean;
}): RealtimeNotification {
    const appUrl = typeof window !== 'undefined' ? window.location.origin : '';

    return {
        id: doc.$id,
        type: doc.type,
        title: doc.title,
        summary: doc.message,
        workitemId: doc.taskId,
        workspaceId: doc.workspaceId,
        triggeredBy: doc.triggeredBy,
        timestamp: doc.$createdAt,
        deepLinkUrl: `${appUrl}/workspaces/${doc.workspaceId}/tasks/${doc.taskId}`,
        read: doc.read,
    };
}

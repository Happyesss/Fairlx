/**
 * Socket Channel Handler
 * 
 * Handles real-time push notifications via HTTP bridge to the custom server.
 * 
 * Implementation:
 * - Makes HTTP POST to /internal/socket-push endpoint on the main server
 * - The main server then emits via Socket.IO
 * - Fire-and-forget semantics (non-blocking)
 * - Fails silently with logging
 * 
 * The dispatcher calls this AFTER storing the notification in the database,
 * so users always have a fallback to see missed notifications.
 */

import { NotificationPayload, ChannelHandler, NotificationChannel } from "../types";

// SECURITY: Internal secret must match the one in server.ts - no fallback allowed
const SOCKET_PUSH_SECRET = process.env.SOCKET_PUSH_SECRET;
const SOCKET_PUSH_URL = `http://localhost:${process.env.PORT || 3000}/internal/socket-push`;

// Validation helper - throws only when actually trying to send
function getSocketPushSecret(): string {
    if (!SOCKET_PUSH_SECRET) {
        throw new Error(
            "SOCKET_PUSH_SECRET environment variable is not set. " +
            "Socket push notifications are disabled for security."
        );
    }
    return SOCKET_PUSH_SECRET;
}

export class SocketChannelHandler implements ChannelHandler {
    readonly name: NotificationChannel = "socket";

    /**
     * Send notification via HTTP bridge to the socket server
     * 
     * This pushes a real-time notification via the internal HTTP endpoint,
     * which then triggers Socket.IO emit in the main server process.
     * 
     * This is FIRE-AND-FORGET:
     * - Non-blocking
     * - Fails silently with logging
     */
    async send(userId: string, payload: NotificationPayload): Promise<void> {
        try {
            // Build lightweight socket payload
            const socketPayload = {
                notificationId: payload.id,
                type: payload.type,
                title: payload.title,
                message: payload.summary,
                workitemId: payload.workitemId,
                workspaceId: payload.workspaceId,
                createdAt: payload.timestamp,
                triggeredBy: payload.triggeredBy,
            };

            // Fire and forget HTTP POST to internal endpoint
            const response = await fetch(SOCKET_PUSH_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId,
                    payload: socketPayload,
                    secret: getSocketPushSecret(),
                }),
            });

            if (response.ok) {
                // console.log(`[SocketChannel] Pushed notification to user: ${userId}, type: ${payload.type}`);
            } else {
                console.debug(`[SocketChannel] Push failed with status: ${response.status}`);
            }
        } catch (error) {
            // CRITICAL: Never throw - fail silently
            // This happens when running without the custom server, which is fine
            console.debug("[SocketChannel] Push failed (server not available):", error instanceof Error ? error.message : "unknown");
        }
    }
}

// Export singleton instance
export const socketChannelHandler = new SocketChannelHandler();

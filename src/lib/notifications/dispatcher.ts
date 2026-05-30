/**
 * Notification Dispatcher
 * 
 * Central notification routing service that:
 * 1. Resolves recipients for workitem events
 * 2. Checks user preferences
 * 3. Routes notifications to appropriate channels (socket, email)
 * 
 * Failures in one channel do not affect others (isolated execution).
 */

import { ID, Query } from "node-appwrite";
import { createAdminClient } from "@/lib/appwrite";
import { DATABASE_ID, MEMBERS_ID, NOTIFICATIONS_ID } from "@/config";
import {
    WorkitemEvent,
    WorkitemEventType,
    NotificationPayload,
    UserNotificationPreferences,
    DEFAULT_NOTIFICATION_PREFERENCES,
    NotificationChannel,
    ChannelHandler,
} from "./types";
import {
    getNotificationTitle,
    getNotificationSummary,
    getDefaultChannelsForEvent,
    EVENTS_NOTIFYING_ALL_ASSIGNEES,
    EVENTS_NOTIFYING_REPORTER
} from "./events";

// =============================================================================
// DISPATCHER CLASS
// =============================================================================

class NotificationDispatcher {
    private channelHandlers: Map<NotificationChannel, ChannelHandler> = new Map();

    /**
     * Register a channel handler
     */
    registerChannel(handler: ChannelHandler): void {
        this.channelHandlers.set(handler.name, handler);
    }

    /**
     * Dispatch a workitem event to all relevant recipients via appropriate channels
     */
    async dispatch(event: WorkitemEvent): Promise<void> {
        try {
            // 1. Handle Project-Level Channels (Broadcast)
            // These channels are triggered once per event, regardless of user recipients.
            const defaultChannels = getDefaultChannelsForEvent(event);
            const projectLevelHandlers = Array.from(this.channelHandlers.values())
                .filter(h => h.isProjectLevel && defaultChannels.includes(h.name));

            if (projectLevelHandlers.length > 0) {
                const payload = this.buildPayload(event);
                const projectPromises = projectLevelHandlers.map(handler =>
                    handler.send("", payload).catch(err => {
                        console.error(`[NotificationDispatcher] Project channel ${handler.name} failed:`, err);
                    })
                );
                // Non-blocking project broadcast
                Promise.allSettled(projectPromises);
            }

            // 2. Resolve recipients
            const allRecipients = await this.resolveRecipients(event);

            // 3. Apply exclusions from metadata
            const excludedIds = new Set(event.metadata?.excludeUserIds || []);
            const recipientUserIds = allRecipients.filter(id => !excludedIds.has(id));

            if (recipientUserIds.length === 0) {
                return;
            }

            // 4. Process each recipient
            const deliveryPromises = recipientUserIds.map(async (userId) => {
                try {
                    await this.processRecipient(userId, event);
                } catch {
                    // Silently fail for individual recipients
                }
            });

            await Promise.allSettled(deliveryPromises);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Unknown error";
            console.error("[NotificationDispatcher] Dispatch caught error:", errorMessage);
            // Don't throw - notifications should not break the main flow
        }
    }

    /**
     * Process a single recipient
     */
    private async processRecipient(userId: string, event: WorkitemEvent): Promise<void> {
        // Skip self-notifications
        if (userId === event.triggeredBy) {
            return;
        }

        // Get user preferences
        const preferences = await this.getUserPreferences(userId);

        // Check if workitem is muted
        if (preferences.mutedWorkitems.includes(event.workitemId)) {
            return;
        }

        // Check if project is muted
        if (event.workitem.projectId && preferences.mutedProjects.includes(event.workitem.projectId)) {
            return;
        }

        // Determine channels based on event type and user preferences
        const channels = this.determineChannels(event, preferences);

        if (channels.length === 0) {
            return;
        }

        // Build notification payload
        const payload = this.buildPayload(event);

        // Store in-app notification first (always)
        await this.storeInAppNotification(userId, event, payload);

        // Dispatch to each channel (parallel, isolated failures)
        const channelPromises = channels.map(async (channelName) => {
            const handler = this.channelHandlers.get(channelName);
            if (handler) {
                try {
                    await handler.send(userId, payload);
                } catch {
                    // Channel delivery failed - silently continue
                }
            }
        });

        await Promise.allSettled(channelPromises);
    }

    /**
     * Resolve all recipients for an event
     */
    private async resolveRecipients(event: WorkitemEvent): Promise<string[]> {
        const recipients = new Set<string>();
        const { databases } = await createAdminClient();

        // 1. Add assignees only for relevant events
        if (EVENTS_NOTIFYING_ALL_ASSIGNEES.includes(event.type)) {
            const assigneeIds = event.workitem.assigneeIds || [];

            if (assigneeIds.length > 0) {
                try {
                    const members = await databases.listDocuments(
                        DATABASE_ID,
                        MEMBERS_ID,
                        [Query.equal("$id", assigneeIds)]
                    );

                    members.documents.forEach((member) => {
                        if (member.userId) {
                            recipients.add(member.userId as string);
                        }
                    });
                } catch {
                    // Failed to resolve assignee members - continue
                }
            }
        }

        // 2. Add reporter for specific events
        if (EVENTS_NOTIFYING_REPORTER.includes(event.type)) {
            if (event.workitem.reporterId) {
                recipients.add(event.workitem.reporterId);
            }
        }

        // 3. Add mentioned users for comments (metadata.mentionedUserIds)
        if (
            event.type === WorkitemEventType.WORKITEM_COMMENT_ADDED &&
            event.metadata?.mentionedUserIds
        ) {
            (event.metadata.mentionedUserIds as string[]).forEach((id) => recipients.add(id));
        }

        // 4. Add mentioned user for direct mention events
        if (event.type === WorkitemEventType.WORKITEM_MENTION && event.metadata?.mentionedUserId) {
            recipients.add(event.metadata.mentionedUserId as string);
        }

        // 5. Add parent comment author for reply events
        if (event.type === WorkitemEventType.WORKITEM_REPLY && event.metadata?.parentCommentAuthorId) {
            recipients.add(event.metadata.parentCommentAuthorId as string);
        }

        // 6. Add target user for rewards
        if (event.type === WorkitemEventType.GITHUB_REWARD_REDEEMED && event.metadata?.userId) {
            recipients.add(event.metadata.userId as string);
        }

        return Array.from(recipients);
    }

    /**
     * Get user notification preferences
     */
    private async getUserPreferences(userId: string): Promise<UserNotificationPreferences> {
        try {
            const { users } = await createAdminClient();
            const user = await users.get(userId);

            const prefs = user.prefs as { notificationPrefs?: string } | undefined;

            if (prefs?.notificationPrefs) {
                try {
                    return {
                        ...DEFAULT_NOTIFICATION_PREFERENCES,
                        ...JSON.parse(prefs.notificationPrefs),
                    };
                } catch {
                    // Invalid JSON, use defaults
                }
            }
        } catch {
            // Use default preferences on error
        }

        return DEFAULT_NOTIFICATION_PREFERENCES;
    }

    /**
     * Determine which channels to use based on event type and user preferences
     */
    private determineChannels(
        event: WorkitemEvent,
        preferences: UserNotificationPreferences
    ): NotificationChannel[] {
        const defaultChannels = getDefaultChannelsForEvent(event);
        const channels: NotificationChannel[] = [];

        // User-level channels (only socket and email for now)
        if (preferences.pushNotifications && defaultChannels.includes("socket")) {
            channels.push("socket");
        }

        if (preferences.emailNotifications && defaultChannels.includes("email")) {
            channels.push("email");
        }

        return channels;
    }

    /**
     * Build notification payload from event
     */
    private buildPayload(event: WorkitemEvent): NotificationPayload {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
        const deepLinkUrl = event.type === WorkitemEventType.GITHUB_REWARD_REDEEMED
            ? `${appUrl}/workspaces/${event.workspaceId}/rewards`
            : `${appUrl}/workspaces/${event.workspaceId}/tasks/${event.workitemId}`;

        return {
            id: ID.unique(),
            type: event.type,
            workitemId: event.workitemId,
            workitemKey: event.workitem.key,
            workspaceId: event.workspaceId,
            title: getNotificationTitle(event),
            summary: getNotificationSummary(event),
            triggeredBy: event.triggeredBy,
            triggeredByName: event.triggeredByName,
            timestamp: new Date().toISOString(),
            deepLinkUrl: deepLinkUrl,
            projectId: event.workitem.projectId,
            metadata: event.metadata,
        };
    }

    /**
     * Store notification in database for in-app display
     */
    private async storeInAppNotification(
        userId: string,
        event: WorkitemEvent,
        payload: NotificationPayload
    ): Promise<void> {
        try {
            // console.log(`[Dispatcher:storeInAppNotification] Creating DB notification for user: ${userId}`);
            const { databases } = await createAdminClient();

            // Map event type to supported database notification types
            const supportedTypes = ["task_assigned", "task_updated", "task_completed", "task_deleted", "task_comment", "task_mention", "task_reply", "reward_credited"];
            const dbType = this.mapEventTypeToDbType(event.type);
            const finalType = supportedTypes.includes(dbType) ? dbType : "task_updated";

            await databases.createDocument(
                DATABASE_ID,
                NOTIFICATIONS_ID,
                ID.unique(),
                {
                    userId,
                    type: finalType,
                    title: payload.title,
                    message: payload.summary,
                    taskId: event.workitemId,
                    workspaceId: event.workspaceId,
                    triggeredBy: event.triggeredBy,
                    metadata: JSON.stringify(payload.metadata || {}),
                    isRead: false,
                },
                [
                    `read("user:${userId}")`,
                    `update("user:${userId}")`,
                    `delete("user:${userId}")`,
                ]
            );
            // console.log(`[Dispatcher] DB NOTIFICATION CREATED`);
            // console.log(`[Dispatcher] Title: "${payload.title}", Message: "${payload.summary}"`);
        } catch {
            // Failed to store notification - silently continue
        }
    }

    /**
     * Map WorkitemEventType to database-compatible notification type
     */
    private mapEventTypeToDbType(eventType: WorkitemEventType): string {
        switch (eventType) {
            case WorkitemEventType.WORKITEM_ASSIGNED:
                return "task_assigned";
            case WorkitemEventType.WORKITEM_COMPLETED:
                return "task_completed";
            case WorkitemEventType.WORKITEM_DELETED:
                return "task_deleted";
            case WorkitemEventType.WORKITEM_COMMENT_ADDED:
                return "task_comment";
            case WorkitemEventType.WORKITEM_MENTION:
                return "task_mention";
            case WorkitemEventType.WORKITEM_REPLY:
                return "task_reply";
            case WorkitemEventType.GITHUB_REWARD_REDEEMED:
                return "reward_credited";
            default:
                return "task_updated";
        }
    }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

export const dispatcher = new NotificationDispatcher();

// =============================================================================
// CONVENIENCE FUNCTION
// =============================================================================

/**
 * Dispatch a workitem event through the notification system
 */
export async function dispatchWorkitemEvent(event: WorkitemEvent): Promise<void> {
    return dispatcher.dispatch(event);
}

/**
 * Outbound notifications to Slack / Discord for work-item events.
 */

import { Databases } from "node-appwrite";
import {
  decryptIntegrationToken,
  getAppBaseUrl,
  getProjectIntegration,
} from "./helpers";

export type ChannelNotifyPayload = {
  projectId: string;
  title: string;
  body: string;
  workItemKey?: string;
  workItemId?: string;
  workspaceId?: string;
};

export async function notifyProjectChannels(
  databases: Databases,
  payload: ChannelNotifyPayload
): Promise<void> {
  const base = getAppBaseUrl();
  const link =
    payload.workspaceId && payload.workItemId
      ? `${base}/workspaces/${payload.workspaceId}/tasks/${payload.workItemId}`
      : base;

  const text = payload.workItemKey
    ? `*${payload.workItemKey}* ${payload.title}\n${payload.body}\n${link}`
    : `${payload.title}\n${payload.body}\n${link}`;

  const slack = await getProjectIntegration(databases, payload.projectId, "slack");
  if (slack?.enabled) {
    const token = decryptIntegrationToken(slack.accessToken);
    if (token && slack.channelId) {
      await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          channel: slack.channelId,
          text,
          unfurl_links: true,
        }),
      }).catch((err) => console.warn("[Slack] postMessage failed:", err));
    } else if (slack.webhookUrl) {
      await fetch(slack.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      }).catch((err) => console.warn("[Slack] webhook failed:", err));
    }
  }

  const discord = await getProjectIntegration(databases, payload.projectId, "discord");
  if (discord?.enabled && discord.webhookUrl) {
    await fetch(discord.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            title: payload.workItemKey
              ? `${payload.workItemKey}: ${payload.title}`
              : payload.title,
            description: payload.body.slice(0, 2000),
            url: link,
            color: 0x5865f2,
          },
        ],
      }),
    }).catch((err) => console.warn("[Discord] webhook failed:", err));
  }
}

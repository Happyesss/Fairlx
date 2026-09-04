import { decryptSecret } from "../lib/secrets";
import type { AgentPluginConnection } from "../types";
import { callMcpServerTool } from "../lib/mcp-bridge";
import type { McpConfig } from "../types";

export type MailSendInput = {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  workItemKey?: string;
};

function connectedMailPlugin(plugins: AgentPluginConnection[]): AgentPluginConnection | undefined {
  return plugins.find(
    (plugin) =>
      plugin.status === "connected" &&
      plugin.capabilities.includes("email.send") &&
      (plugin.secrets?.accessTokenEncrypted ||
        plugin.secrets?.apiKeyEncrypted ||
        plugin.secrets?.mcpUrl),
  );
}

export function mailPluginReady(plugins: AgentPluginConnection[]): boolean {
  return Boolean(connectedMailPlugin(plugins));
}

async function sendGraph(token: string, input: MailSendInput, from?: string) {
  const payload = {
    message: {
      subject: input.subject,
      body: { contentType: "HTML", content: input.body.replaceAll("\n", "<br/>") },
      toRecipients: [{ emailAddress: { address: input.to } }],
      ...(input.cc
        ? { ccRecipients: [{ emailAddress: { address: input.cc } }] }
        : {}),
      ...(from ? { from: { emailAddress: { address: from } } } : {}),
    },
    saveToSentItems: true,
  };
  const response = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text.slice(0, 400) || `Graph sendMail failed (${response.status})`);
  }
  return { sent: true, provider: "outlook" as const, to: input.to };
}

async function sendGmail(token: string, input: MailSendInput, from?: string) {
  const rfc = [
    `To: ${input.to}`,
    from ? `From: ${from}` : "",
    `Subject: ${input.subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    input.body,
  ]
    .filter((line, index, all) => line !== "" || index === all.length - 1)
    .join("\r\n");
  const raw = Buffer.from(rfc)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text.slice(0, 400) || `Gmail send failed (${response.status})`);
  }
  const json = (await response.json()) as { id?: string };
  return { sent: true, provider: "gmail" as const, to: input.to, messageId: json.id };
}

async function sendHttp(apiKey: string, endpoint: string, from: string, input: MailSendInput) {
  const response = await fetch(endpoint || "https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.body.replaceAll("\n", "<br/>"),
      text: input.body,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text.slice(0, 400) || `Mail HTTP send failed (${response.status})`);
  }
  const json = (await response.json().catch(() => ({}))) as { id?: string };
  return { sent: true, provider: "http" as const, to: input.to, messageId: json.id };
}

export async function sendMailViaPlugin(params: {
  plugins: AgentPluginConnection[];
  mcp: McpConfig;
  input: MailSendInput;
}): Promise<Record<string, unknown>> {
  const plugin = connectedMailPlugin(params.plugins);
  if (!plugin) {
    return {
      error: "Mail is not configured.",
      capability: "email.send",
      hint: "Connect Outlook, Gmail, Resend, or a mail MCP server.",
    };
  }

  const secrets = plugin.secrets ?? {};
  const from = secrets.from || "";

  if (plugin.catalogId === "mail-mcp" && secrets.mcpUrl) {
    const headers: Record<string, string> = {};
    if (secrets.mcpHeadersEncrypted) {
      headers.Authorization = decryptSecret(secrets.mcpHeadersEncrypted);
    }
    const result = await callMcpServerTool({
      server: plugin.id,
      tool: secrets.mcpTool || "send_email",
      args: { ...params.input, from },
      ctx: {
        userId: "",
        mcp: {
          mcpServers: {
            [plugin.id]: {
              url: secrets.mcpUrl,
              transport: "http",
              headers,
            },
          },
        },
      },
    });
    return { sent: true, provider: "mcp", to: params.input.to, result };
  }

  if (plugin.catalogId === "outlook" && secrets.accessTokenEncrypted) {
    return sendGraph(decryptSecret(secrets.accessTokenEncrypted), params.input, from);
  }
  if (plugin.catalogId === "gmail" && secrets.accessTokenEncrypted) {
    return sendGmail(decryptSecret(secrets.accessTokenEncrypted), params.input, from);
  }
  if (secrets.apiKeyEncrypted) {
    return sendHttp(
      decryptSecret(secrets.apiKeyEncrypted),
      secrets.extra?.endpoint || "https://api.resend.com/emails",
      from || "fairlx@localhost",
      params.input,
    );
  }
  return { error: "Mail plugin is missing credentials.", capability: "email.send" };
}

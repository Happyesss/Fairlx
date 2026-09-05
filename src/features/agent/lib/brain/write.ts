import type { AgentChatMessage, AgentKnowledgeItem } from "../../types";
import { unwrapMcpToolContent } from "../truncate";

const STATE_TITLE = "Agent STATE";

function asRecord(content: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(unwrapMcpToolContent(content)) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // ignore
  }
  return null;
}

export function factsFromTurn(messages: AgentChatMessage[]): string[] {
  const facts: string[] = [];
  for (const message of messages.slice(-16)) {
    if (message.role !== "tool") continue;
    const parsed = asRecord(message.content);
    if (!parsed) continue;
    if (typeof parsed.error === "string" && /not configured|reconnect|unauthorized|401|403/i.test(parsed.error)) {
      facts.push(`Last failure (${message.toolName ?? "tool"}): ${parsed.error.slice(0, 160)}`);
    }
    if (typeof parsed.html_url === "string" && parsed.html_url.includes("github.com")) {
      facts.push(`Opened GitHub URL: ${parsed.html_url}`);
    }
    if (typeof parsed.messageId === "string" || parsed.sent === true) {
      facts.push(`Mail sent to ${String(parsed.to ?? "recipient")}.`);
    }
    if (Array.isArray(parsed.findings) && parsed.findings.length) {
      facts.push(`Security review found ${parsed.findings.length} verified issue(s).`);
    }
  }
  return facts.slice(0, 4);
}

export function mergeStateKnowledge(
  knowledge: AgentKnowledgeItem[],
  facts: string[],
): AgentKnowledgeItem[] {
  if (!facts.length) return knowledge;
  const now = new Date().toISOString();
  const body = facts.map((fact) => `- ${fact}`).join("\n");
  const existing = knowledge.find((item) => item.title === STATE_TITLE);
  if (!existing) {
    return [
      ...knowledge,
      {
        id: crypto.randomUUID(),
        title: STATE_TITLE,
        content: body.slice(0, 4000),
        source: "brain",
        createdAt: now,
      },
    ].slice(-40);
  }
  const merged = `${existing.content}\n${body}`.slice(-4000);
  return knowledge.map((item) =>
    item.id === existing.id ? { ...item, content: merged, createdAt: now } : item,
  );
}

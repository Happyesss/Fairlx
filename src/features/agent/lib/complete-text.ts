import type { AgentAiConfigStored } from "../types";
import { resolveChatTarget } from "./runtime";

const COMPILE_TIMEOUT_MS = 45_000;

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "string" ? part : String((part as { text?: string })?.text ?? "")))
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

export async function completePlainText(params: {
  stored: AgentAiConfigStored;
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string> {
  const target = resolveChatTarget(params.stored);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), COMPILE_TIMEOUT_MS);
  try {
    const response = await fetch(target.url, {
      method: "POST",
      headers: target.headers,
      body: JSON.stringify({
        model: target.model,
        temperature: 0.2,
        max_tokens: params.maxTokens ?? Math.min(target.maxOutputTokens ?? 4096, 4096),
        messages: [
          { role: "system", content: params.system },
          { role: "user", content: params.user },
        ],
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await response.text();
    let json: { choices?: Array<{ message?: { content?: unknown } }>; error?: { message?: string } } = {};
    try {
      json = text ? (JSON.parse(text) as typeof json) : {};
    } catch {
      json = { error: { message: text } };
    }
    if (!response.ok) {
      throw new Error(json.error?.message || `Prompt compile failed (${response.status})`);
    }
    const content = extractText(json.choices?.[0]?.message?.content);
    if (!content.trim()) throw new Error("Prompt compiler returned an empty response.");
    return content.trim();
  } finally {
    clearTimeout(timer);
  }
}

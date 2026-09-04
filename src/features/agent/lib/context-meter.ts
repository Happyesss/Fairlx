import type { AgentChatMessage, AgentToolEvent } from "../types";

export function estimateTokensFromText(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

export function estimateRunTokens(messages: AgentChatMessage[], systemChars = 0): number {
  const body = messages.reduce((sum, message) => sum + (message.content?.length ?? 0), 0);
  const toolArgs = messages.reduce((sum, message) => {
    if (!message.toolCalls?.length) return sum;
    return sum + message.toolCalls.reduce((inner, call) => inner + call.arguments.length + call.name.length, 0);
  }, 0);
  return estimateTokensFromText("x".repeat(systemChars + body + toolArgs));
}

export function latestContextMeter(events: AgentToolEvent[]): {
  tokens: number;
  maxInputTokens: number;
  subagents: number;
} | undefined {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i]!;
    if (event.type !== "context_meter") continue;
    const payload = event.payload as { tokens?: number; maxInputTokens?: number; subagents?: number } | undefined;
    if (!payload) continue;
    return {
      tokens: Number(payload.tokens) || 0,
      maxInputTokens: Number(payload.maxInputTokens) || 0,
      subagents: Number(payload.subagents) || 0,
    };
  }
  return undefined;
}

export function activeSubagents(events: AgentToolEvent[]) {
  const started = events.filter((event) => event.type === "subagent_started");
  const done = new Set(
    events
      .filter((event) => event.type === "subagent_done")
      .map((event) => {
        const payload = event.payload as { id?: string } | undefined;
        return payload?.id;
      })
      .filter(Boolean),
  );
  return started
    .map((event) => {
      const payload = (event.payload ?? {}) as {
        id?: string;
        specialist?: string;
        parent?: string;
        task?: string;
      };
      return {
        id: payload.id || event.id,
        specialist: payload.specialist || "worker",
        parent: payload.parent || "orchestrator",
        task: payload.task || event.detail || event.title,
        done: done.has(payload.id || event.id),
        title: event.title,
      };
    })
    .filter((item) => !item.done);
}

export function editedFilePaths(events: AgentToolEvent[]): string[] {
  const paths: string[] = [];
  for (const event of events) {
    if (event.type !== "github_write_file" && event.type !== "git_stage") continue;
    const payload = event.payload as { path?: string } | undefined;
    const path = payload?.path || event.detail;
    if (path && !paths.includes(path)) paths.push(path);
  }
  return paths;
}

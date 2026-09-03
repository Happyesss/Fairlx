import type { AgentRun } from "../types";

export function runNeedsAgentTurn(run: Pick<AgentRun, "status" | "messages">): boolean {
  if (
    run.status === "completed" ||
    run.status === "failed" ||
    run.status === "stopped" ||
    run.status === "awaiting_confirmation"
  ) {
    return false;
  }
  const messages = run.messages ?? [];
  if (messages.length === 0) return true;
  const last = messages[messages.length - 1];
  if (!last) return true;
  if (last.role === "user") return true;
  if (last.role === "tool") return true;
  if (last.role === "assistant" && last.toolCalls?.length) {
    const answered = new Set(
      messages.filter((message) => message.role === "tool" && message.toolCallId).map((message) => message.toolCallId),
    );
    return last.toolCalls.some((call) => !answered.has(call.id));
  }
  return false;
}

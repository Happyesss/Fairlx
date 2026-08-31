export const AGENT_CHAT_TIMEOUT_MS = 60_000;

export function formatAgentTurnError(error: unknown, timeoutMs = AGENT_CHAT_TIMEOUT_MS): string {
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : String(error);
  const aborted =
    name === "AbortError" ||
    name === "TimeoutError" ||
    /this operation was aborted/i.test(message) ||
    /aborted due to timeout/i.test(message) ||
    /the operation was aborted/i.test(message);

  if (aborted) {
    return `The model request timed out after ${Math.round(timeoutMs / 1000)}s. Try again.`;
  }

  return message || "Agent turn failed.";
}

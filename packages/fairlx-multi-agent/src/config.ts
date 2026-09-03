export const DEFAULT_ORCHESTRATOR_MODEL = "grok-4.6";
export const DEFAULT_WORKER_MODEL = "DeepSeek-V4-Flash";

export const MAX_CONCURRENT_WORKERS = 3;
export const MAX_TOOL_ITERATIONS = 8;
export const MAX_INBOX = 32;
export const MAX_EVENTS = 80;
export const MAX_HISTORY = 24;
export const CONTEXT_TOKEN_BUDGET = 3500;
export const TIER3_ENTITY_CHAR_BUDGET = 1600; // ~400 tokens
export const CONFIRMATION_TTL_MS = 120_000;
export const MAX_CONSECUTIVE_FAILURES = 3;
export const MAX_DUPLICATE_SKIPS = 2;
export const MAX_NODE_ATTEMPTS = 2;
export const EVENT_BUFFER_MAX = 256;

export type MultiAgentConfig = {
  orchestratorModel: string;
  workerModel: string;
  maxConcurrentWorkers: number;
  maxToolIterations: number;
  inboxLimit: number;
  eventLimit: number;
  contextTokenBudget: number;
  confirmationTtlMs: number;
  maxConsecutiveFailures: number;
};

export function resolveConfig(partial?: Partial<MultiAgentConfig>): MultiAgentConfig {
  return {
    orchestratorModel: partial?.orchestratorModel ?? DEFAULT_ORCHESTRATOR_MODEL,
    workerModel: partial?.workerModel ?? DEFAULT_WORKER_MODEL,
    maxConcurrentWorkers: Math.max(1, partial?.maxConcurrentWorkers ?? MAX_CONCURRENT_WORKERS),
    maxToolIterations: Math.max(1, partial?.maxToolIterations ?? MAX_TOOL_ITERATIONS),
    inboxLimit: Math.max(4, partial?.inboxLimit ?? MAX_INBOX),
    eventLimit: Math.max(16, partial?.eventLimit ?? MAX_EVENTS),
    contextTokenBudget: Math.max(800, partial?.contextTokenBudget ?? CONTEXT_TOKEN_BUDGET),
    confirmationTtlMs: Math.max(5_000, partial?.confirmationTtlMs ?? CONFIRMATION_TTL_MS),
    maxConsecutiveFailures: Math.max(1, partial?.maxConsecutiveFailures ?? MAX_CONSECUTIVE_FAILURES),
  };
}

export const MODEL_PRICES: Record<string, { input: number; output: number }> = {
  "grok-4.6": { input: 3, output: 15 },
  "DeepSeek-V4-Flash": { input: 0.14, output: 0.28 },
  "gemini-2.5-flash": { input: 0.15, output: 0.6 },
  "gemini-2.5-pro": { input: 1.25, output: 10 },
  "claude-3.7-sonnet": { input: 3, output: 15 },
  "gpt-4o": { input: 2.5, output: 10 },
};

export function estimateCostUsd(modelId: string, inputTokens: number, outputTokens: number): number {
  const price = MODEL_PRICES[modelId] ?? MODEL_PRICES["DeepSeek-V4-Flash"]!;
  return (inputTokens / 1_000_000) * price.input + (outputTokens / 1_000_000) * price.output;
}

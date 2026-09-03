import type { AgentChatMessage, CompletionRequest, CompletionResult, TokenUsage } from "./types";
import { usageFromCounts } from "./connectors";
import { estimateTokens } from "./ids";

export class CancellationRegistry {
  private readonly controllers = new Map<string, AbortController>();

  controller(runId: string): AbortController {
    const existing = this.controllers.get(runId);
    if (existing) return existing;
    const controller = new AbortController();
    this.controllers.set(runId, controller);
    return controller;
  }

  cancel(runId: string): void {
    const controller = this.controllers.get(runId);
    controller?.abort();
  }

  isCancelled(runId: string): boolean {
    return this.controllers.get(runId)?.signal.aborted === true;
  }

  release(runId: string): void {
    this.controllers.delete(runId);
  }

  throwIfCancelled(runId: string): void {
    if (this.isCancelled(runId)) throw new Error("cancelled");
  }
}

export class WorkerPool {
  private active = 0;
  private readonly waiters: Array<() => void> = [];

  constructor(private readonly max: number) {}

  get activeCount(): number {
    return this.active;
  }

  get pendingCount(): number {
    return this.waiters.length;
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.active < this.max) {
      this.active += 1;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.waiters.push(() => {
        this.active += 1;
        resolve();
      });
    });
  }

  private release(): void {
    this.active -= 1;
    const next = this.waiters.shift();
    if (next) next();
  }
}

export type Scheduler = {
  schedule(task: () => Promise<void>): void;
};

export const immediateScheduler: Scheduler = {
  schedule(task) {
    void task();
  },
};

export function createManualScheduler() {
  const queue: Array<() => Promise<void>> = [];
  return {
    queue,
    schedule(task: () => Promise<void>) {
      queue.push(task);
    },
    async flush(): Promise<void> {
      while (queue.length) {
        const task = queue.shift();
        if (task) await task();
      }
    },
    async flushOne(): Promise<boolean> {
      const task = queue.shift();
      if (!task) return false;
      await task();
      return true;
    },
    get pending(): number {
      return queue.length;
    },
  };
}

export interface ModelRouter {
  complete(request: CompletionRequest): Promise<CompletionResult>;
}

export class EchoModelRouter implements ModelRouter {
  async complete(request: CompletionRequest): Promise<CompletionResult> {
    const last = [...request.messages].reverse().find((message) => message.role === "user");
    const content = last?.content || "";
    const inputTokens = estimateTokens(request.system + request.messages.map((m) => m.content).join("\n"));
    const outputTokens = estimateTokens(content);
    return {
      content: `Acknowledged: ${content.slice(0, 400)}`,
      toolCalls: [],
      usage: usageFromCounts(request.modelId, inputTokens, outputTokens),
    };
  }
}

export function toOpenAiMessages(system: string, messages: AgentChatMessage[]) {
  return [
    { role: "system" as const, content: system },
    ...messages.map((message) => ({
      role: message.role === "tool" ? ("tool" as const) : message.role,
      content: message.content,
    })),
  ];
}

export function emptyUsageResult(modelId: string, content: string, messages: AgentChatMessage[]): { usage: TokenUsage } {
  const inputTokens = estimateTokens(messages.map((m) => m.content).join("\n"));
  const outputTokens = estimateTokens(content);
  return { usage: usageFromCounts(modelId, inputTokens, outputTokens) };
}

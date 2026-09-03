import { EVENT_BUFFER_MAX } from "./config";
import { newId, nowIso } from "./ids";
import type { AgentEvent, AgentEventType, HierarchicalAgentRun, InboxMessage } from "./types";

export type EventListener = (event: AgentEvent) => void;

export class EventBus {
  private readonly listeners = new Set<EventListener>();
  private readonly buffer: AgentEvent[] = [];
  private dropped = 0;

  constructor(private readonly maxBuffer = EVENT_BUFFER_MAX) {}

  subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: AgentEvent): AgentEvent {
    if (this.buffer.length >= this.maxBuffer) {
      this.buffer.shift();
      this.dropped += 1;
    }
    this.buffer.push(event);
    for (const listener of this.listeners) listener(event);
    return event;
  }

  snapshot(): AgentEvent[] {
    return this.buffer.slice();
  }

  get droppedCount(): number {
    return this.dropped;
  }
}

export function makeEvent(
  type: AgentEventType,
  runId: string,
  title: string,
  detail?: string,
  payload?: unknown,
  clock: () => number = Date.now,
): AgentEvent {
  return {
    id: newId(),
    type,
    runId,
    title,
    detail,
    payload,
    createdAt: nowIso(clock),
  };
}

export function appendEvent(run: HierarchicalAgentRun, event: AgentEvent, limit: number): void {
  run.events.push(event);
  if (run.events.length > limit) run.events.splice(0, run.events.length - limit);
}

export function appendInbox(run: HierarchicalAgentRun, message: InboxMessage, limit: number): void {
  run.inbox.push(message);
  if (run.inbox.length > limit) run.inbox.splice(0, run.inbox.length - limit);
}

export function makeInbox(input: Omit<InboxMessage, "id" | "createdAt">, clock: () => number = Date.now): InboxMessage {
  return { ...input, id: newId(), createdAt: nowIso(clock) };
}

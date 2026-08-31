import { after } from "next/server";
import type { Databases } from "node-appwrite";

import type { AgentRun } from "../types";
import { runAgentTurn } from "./runtime";
import { updateRun } from "./runs";
import { formatAgentTurnError } from "./turn-errors";

const inFlight = new Map<string, Promise<void>>();

export function isAgentTurnInFlight(runId: string): boolean {
  return inFlight.has(runId);
}

function runAfterResponse(task: () => Promise<void>) {
  try {
    after(() => task());
  } catch {
    setTimeout(() => {
      void task();
    }, 0);
  }
  // Custom-server safety: if `after()` scheduled but never flushed, start shortly
  // after the typical response flush. `task` is idempotent via `started`.
  setTimeout(() => {
    void task();
  }, 300);
}

export function scheduleAgentTurn(params: {
  databases: Databases;
  user: { $id: string; name?: string; email?: string };
  run: AgentRun;
}): void {
  const { databases, user, run } = params;
  if (inFlight.has(run.id)) return;

  let started = false;
  const task = async () => {
    if (started) return;
    started = true;
    try {
      await runAgentTurn({ databases, user, run });
    } catch (error) {
      console.error(
        "[agent] turn failed",
        run.id,
        error instanceof Error ? error.message : error
      );
      try {
        await updateRun(databases, run.id, {
          status: "failed",
          error: formatAgentTurnError(error),
        });
      } catch (persistError) {
        console.error("[agent] failed to persist run error", persistError);
      }
    } finally {
      inFlight.delete(run.id);
    }
  };

  inFlight.set(run.id, Promise.resolve());
  runAfterResponse(task);
}

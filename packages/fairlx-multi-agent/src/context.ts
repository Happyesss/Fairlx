import { TIER3_ENTITY_CHAR_BUDGET } from "./config";
import { estimateTokens, truncate } from "./ids";
import { PERSONAS, compilePersonaPrompt, inferPersonaRole } from "./roles";
import type {
  BriefingSprint,
  BriefingWorkItem,
  ContextEntity,
  DailyBriefing,
  InjectedContext,
  PersonaRole,
} from "./types";

const TIER1_KEYS = ["id", "key", "title", "status", "priority", "assignees", "name", "role", "type"];

export function compactEntity(entity: ContextEntity, explicit = false): ContextEntity {
  const data = { ...entity.data };
  if (!explicit) {
    const description = data.description ?? data.markdownContent ?? data.content;
    if (typeof description === "string") {
      data.description = truncate(description, TIER3_ENTITY_CHAR_BUDGET);
      delete data.markdownContent;
      delete data.content;
    }
  }
  return { ...entity, data };
}

export function assembleContextPayload(
  context: InjectedContext,
  tokenBudget: number,
  explicitKeys: Set<string> = new Set(),
): { text: string; tokens: number; included: number; omitted: number } {
  const lines: string[] = [];
  if (context.workspaceName) {
    lines.push(`Workspace: ${context.workspaceName}${context.workspaceId ? ` (${context.workspaceId})` : ""}`);
  }
  if (context.projectName) {
    lines.push(`Project: ${context.projectName}${context.projectKey ? ` [${context.projectKey}]` : ""}`);
  }
  const packed: string[] = [];
  let omitted = 0;
  for (const entity of context.entities) {
    const compact = compactEntity(entity, explicitKeys.has(entity.referenceKey));
    const row = `- ${compact.entityType}:${compact.referenceKey} ${JSON.stringify(pickTier(compact.data))}`;
    const next = [...packed, row].join("\n");
    if (estimateTokens([...lines, "", "Context:", next].join("\n")) > tokenBudget) {
      omitted += 1;
      continue;
    }
    packed.push(row);
  }
  if (packed.length) {
    lines.push("", "Context:");
    lines.push(...packed);
  }
  const text = lines.join("\n");
  return { text, tokens: estimateTokens(text), included: packed.length, omitted };
}

function pickTier(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of TIER1_KEYS) {
    if (data[key] !== undefined) out[key] = data[key];
  }
  if (data.description) out.description = data.description;
  if (data.estimatePoints !== undefined) out.estimatePoints = data.estimatePoints;
  if (data.blockedBy) out.blockedBy = data.blockedBy;
  if (data.sprint) out.sprint = data.sprint;
  return Object.keys(out).length ? out : data;
}

export type BriefingInput = {
  userName?: string;
  personaRole?: PersonaRole;
  workspaceRole?: string;
  title?: string;
  prompt?: string;
  workItems?: BriefingWorkItem[];
  sprints?: BriefingSprint[];
  blockers?: BriefingWorkItem[];
  unassigned?: BriefingWorkItem[];
  now?: Date;
};

function itemLabel(item: BriefingWorkItem): string {
  return [item.key, item.title].filter(Boolean).join(" — ") || item.id;
}

function isOpen(status?: string): boolean {
  const value = String(status || "").toUpperCase();
  return value !== "DONE" && value !== "CLOSED" && value !== "COMPLETE";
}

function dueSoon(item: BriefingWorkItem, now: Date): boolean {
  if (!item.dueAt) return false;
  const due = new Date(item.dueAt).getTime();
  if (Number.isNaN(due)) return false;
  return due - now.getTime() <= 48 * 60 * 60 * 1000 && due >= now.getTime() - 24 * 60 * 60 * 1000;
}

export function generateDailyBriefing(input: BriefingInput): DailyBriefing {
  const started = performance.now();
  const personaRole = inferPersonaRole(input);
  const persona = PERSONAS[personaRole];
  const now = input.now ?? new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const name = input.userName?.split(/\s+/)[0] || "there";
  const workItems = (input.workItems ?? []).filter((item) => isOpen(item.status));
  const blockers = (input.blockers ?? workItems.filter((item) => (item.blockedBy?.length ?? 0) > 0)).slice(0, 5);
  const unassigned = (input.unassigned ?? []).slice(0, 5);
  const urgent = workItems.filter((item) => dueSoon(item, now) || item.priority === "HIGH" || item.priority === "URGENT");
  const activeSprint = (input.sprints ?? []).find((sprint) => /active|current|in_progress/i.test(sprint.status || "")) ?? input.sprints?.[0];

  const priorities: string[] = [];
  const suggested: string[] = [];

  if (personaRole === "tech_lead") {
    if (blockers.length) priorities.push(`Unblock ${blockers.length} item${blockers.length === 1 ? "" : "s"} before standup.`);
    if (unassigned.length) priorities.push(`Assign ${unassigned.length} unassigned ticket${unassigned.length === 1 ? "" : "s"}.`);
    if (activeSprint) {
      const used = activeSprint.committedPoints ?? 0;
      const total = activeSprint.totalPoints ?? 0;
      priorities.push(
        total
          ? `${activeSprint.name} is at ${used}/${total} points.`
          : `Keep ${activeSprint.name} on track.`,
      );
    }
    suggested.push("Ask the Personal Agent to decompose the riskiest epic and spawn a planner.");
  } else if (personaRole === "frontend") {
    const assigned = workItems.slice(0, 3);
    if (assigned.length) priorities.push(`Ship ${itemLabel(assigned[0]!)} next.`);
    if (urgent.length) priorities.push(`${urgent.length} high-priority UI item${urgent.length === 1 ? "" : "s"} due soon.`);
    suggested.push("Hand the overflow fix to a Builder sub-agent, then QA.");
  } else if (personaRole === "qa") {
    const ready = workItems.filter((item) => /review|qa|ready/i.test(item.status || ""));
    priorities.push(ready.length ? `${ready.length} item${ready.length === 1 ? "" : "s"} ready for browser QA.` : "No items sitting in review.");
    suggested.push("Spawn a QA sub-agent on the latest PR and attach video proof.");
  } else {
    if (activeSprint?.goal) priorities.push(`Sprint goal: ${activeSprint.goal}`);
    if (activeSprint?.endDate) priorities.push(`Sprint ends ${activeSprint.endDate}.`);
    priorities.push(`${workItems.length} open items in your view.`);
    suggested.push("Generate stories from the spec and let the swarm execute the cycle.");
  }

  if (!priorities.length) priorities.push("No urgent deadlines. Review unassigned work or start the next epic.");

  return {
    personaRole,
    greeting: `${greeting}, ${name}.`,
    headline: `${persona.name} cockpit — ${persona.focus}`,
    priorities: priorities.slice(0, 4),
    blockers: blockers.map(itemLabel),
    unassigned: unassigned.map(itemLabel),
    suggestedActions: suggested.slice(0, 3),
    generatedInMs: performance.now() - started,
  };
}

export function briefingFromContext(context: InjectedContext, userName?: string): DailyBriefing {
  return generateDailyBriefing({
    userName,
    personaRole: context.personaRole,
    workspaceRole: context.workspaceRole,
    workItems: context.workItems,
    sprints: context.sprints,
    blockers: context.blockers,
    unassigned: context.unassigned,
  });
}

export { compilePersonaPrompt };

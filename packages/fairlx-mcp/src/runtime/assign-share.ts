import { assigneeQueryMatches, type CompactAssignee } from "./output";

export type AssignShareItem = {
  key?: unknown;
  unassigned?: unknown;
  assignees?: CompactAssignee[];
};

export type AssignSharePlan = {
  total: number;
  percent: number;
  target: number;
  already: string[];
  pick: string[];
};

export function parseAssignPercent(raw: unknown): number | undefined {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const n = Number(raw.replace(/%/g, "").trim());
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

export function workItemKeyOf(item: AssignShareItem): string {
  return typeof item.key === "string" ? item.key.trim() : "";
}

export function assignmentSummary(items: AssignShareItem[]): {
  total: number;
  unassignedCount: number;
  unassignedKeys: string[];
  byAssignee: Record<string, string[]>;
} {
  const unassignedKeys: string[] = [];
  const byAssignee: Record<string, string[]> = {};
  for (const item of items) {
    const key = workItemKeyOf(item);
    if (!key) continue;
    const people = (item.assignees ?? [])
      .map((person) => person.name.trim())
      .filter(Boolean);
    if (item.unassigned === true || people.length === 0) {
      unassignedKeys.push(key);
      continue;
    }
    for (const name of people) {
      (byAssignee[name] ??= []).push(key);
    }
  }
  return {
    total: items.filter((item) => workItemKeyOf(item)).length,
    unassignedCount: unassignedKeys.length,
    unassignedKeys,
    byAssignee,
  };
}

function keyOrder(key: string): number {
  const match = key.match(/-(\d+)$/);
  return match ? Number(match[1]) : 0;
}

export function pickAssignShareKeys(
  items: AssignShareItem[],
  person: string,
  percent: number,
): AssignSharePlan {
  const total = items.filter((item) => workItemKeyOf(item)).length;
  const clamped = Math.min(100, Math.max(0, percent));
  const target = Math.round((total * clamped) / 100);
  const already: string[] = [];
  const unassigned: string[] = [];
  for (const item of items) {
    const key = workItemKeyOf(item);
    if (!key) continue;
    if (assigneeQueryMatches(item.assignees, person)) {
      already.push(key);
      continue;
    }
    if (item.unassigned === true || !item.assignees?.length) unassigned.push(key);
  }
  already.sort((left, right) => keyOrder(left) - keyOrder(right));
  unassigned.sort((left, right) => keyOrder(left) - keyOrder(right));
  const need = Math.max(0, target - already.length);
  return {
    total,
    percent: clamped,
    target,
    already,
    pick: unassigned.slice(0, need),
  };
}

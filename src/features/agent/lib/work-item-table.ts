export type AgentWorkItemAssignee = {
  name: string;
  imageUrl?: string | null;
  id?: string;
};

export type AgentWorkItem = {
  key?: string;
  title?: string;
  status?: string;
  type?: string;
  priority?: string;
  unassigned?: boolean;
  assignees?: Array<string | AgentWorkItemAssignee>;
};

const STATUS_ALIASES: Record<string, string> = {
  todo: "TODO",
  "to do": "TODO",
  assigned: "ASSIGNED",
  "in progress": "IN_PROGRESS",
  in_progress: "IN_PROGRESS",
  "in review": "IN_REVIEW",
  in_review: "IN_REVIEW",
  done: "DONE",
  completed: "DONE",
};

const PRIORITY_ALIASES: Record<string, string> = {
  low: "LOW",
  medium: "MEDIUM",
  med: "MEDIUM",
  high: "HIGH",
  urgent: "URGENT",
  critical: "URGENT",
};

const TYPE_ALIASES: Record<string, string> = {
  story: "STORY",
  bug: "BUG",
  task: "TASK",
  epic: "EPIC",
  subtask: "SUBTASK",
  "sub task": "SUBTASK",
  issue: "ISSUE",
};

export function stripCell(value: string): string {
  return value
    .replace(/^\*+|\*+$/g, "")
    .replace(/^`+|`+$/g, "")
    .replace(/^_+|_+$/g, "")
    .trim();
}

function aliasKey(value: string): string {
  return stripCell(value).toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

export function normalizeStatus(value?: string): string | undefined {
  if (!value) return value;
  const trimmed = stripCell(value);
  return STATUS_ALIASES[aliasKey(trimmed)] || trimmed;
}

export function normalizePriority(value?: string): string | undefined {
  if (!value) return value;
  const trimmed = stripCell(value);
  return PRIORITY_ALIASES[aliasKey(trimmed)] || trimmed;
}

export function normalizeType(value?: string): string | undefined {
  if (!value) return value;
  const trimmed = stripCell(value);
  return TYPE_ALIASES[aliasKey(trimmed)] || trimmed;
}

export function splitPipeRow(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.includes("|")) return null;
  const cells = trimmed
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => stripCell(cell));
  if (cells.length < 2) return null;
  return cells;
}

export function isSeparatorRow(line: string): boolean {
  return /^\s*\|?[\s:|-]+$/.test(line) && line.includes("-");
}

export function normalizeAssignees(
  assignees?: Array<string | AgentWorkItemAssignee>,
): AgentWorkItemAssignee[] {
  if (!assignees?.length) return [];
  return assignees.flatMap((item) => {
    if (typeof item === "string") {
      const name = item.trim();
      return name ? [{ name }] : [];
    }
    const name = String(item?.name ?? "").trim();
    if (!name) return [];
    return [{ name, imageUrl: item.imageUrl ?? null, id: item.id }];
  });
}

function mergeAssignees(
  base?: Array<string | AgentWorkItemAssignee>,
  extra?: Array<string | AgentWorkItemAssignee>,
): AgentWorkItemAssignee[] {
  const fromExtra = normalizeAssignees(extra);
  const fromBase = normalizeAssignees(base);
  if (!fromExtra.length) return fromBase;
  if (!fromBase.length) return fromExtra;
  return fromExtra.map((person) => {
    if (person.imageUrl) return person;
    const match = fromBase.find((item) => item.name.toLowerCase() === person.name.toLowerCase());
    return match?.imageUrl ? { ...person, imageUrl: match.imageUrl, id: person.id || match.id } : person;
  });
}

export function mergeWorkItem(base: AgentWorkItem, extra?: AgentWorkItem): AgentWorkItem {
  const source = extra ?? {};
  const unassigned = source.unassigned ?? base.unassigned;
  return {
    key: source.key || base.key,
    title: source.title || base.title,
    status: normalizeStatus(source.status || base.status),
    type: normalizeType(source.type || base.type),
    priority: normalizePriority(source.priority || base.priority),
    unassigned,
    assignees: unassigned ? [] : mergeAssignees(base.assignees, source.assignees),
  };
}

export function splitMarkdownWorkItemTable(content: string): {
  before: string;
  rows: AgentWorkItem[];
  after: string;
} | null {
  const lines = content.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const header = splitPipeRow(lines[index] ?? "");
    if (!header) continue;
    const labels = header.map((cell) => cell.toLowerCase().replace(/\s+/g, " ").trim());
    const keyIdx = labels.findIndex((cell) => cell === "key");
    if (keyIdx < 0) continue;
    const titleIdx = labels.findIndex((cell) => cell.includes("title") || cell === "task" || cell === "name");
    const statusIdx = labels.findIndex((cell) => cell.includes("status"));
    const priorityIdx = labels.findIndex((cell) => cell.includes("priority"));
    const assigneeIdx = labels.findIndex((cell) => cell.includes("assignee"));
    const typeIdx = labels.findIndex((cell) => cell === "type" || cell.includes("type"));
    if (statusIdx < 0 && priorityIdx < 0 && assigneeIdx < 0) continue;

    let cursor = index + 1;
    if (cursor < lines.length && isSeparatorRow(lines[cursor] ?? "")) cursor += 1;
    const rows: AgentWorkItem[] = [];
    while (cursor < lines.length) {
      const line = lines[cursor] ?? "";
      if (isSeparatorRow(line)) {
        cursor += 1;
        continue;
      }
      const cells = splitPipeRow(line);
      if (!cells) break;
      const key = cells[keyIdx]?.trim() || "";
      const assigneesRaw = assigneeIdx >= 0 ? cells[assigneeIdx] ?? "" : "";
      const unassigned = /unassigned/i.test(assigneesRaw) || !assigneesRaw.trim();
      rows.push({
        key,
        title: titleIdx >= 0 ? cells[titleIdx] : "",
        status: normalizeStatus(statusIdx >= 0 ? cells[statusIdx] : ""),
        type: normalizeType(typeIdx >= 0 ? cells[typeIdx] : ""),
        priority: normalizePriority(priorityIdx >= 0 ? cells[priorityIdx] : ""),
        unassigned,
        assignees: unassigned
          ? []
          : assigneesRaw
              .split(",")
              .map((name) => stripCell(name))
              .filter(Boolean)
              .map((name) => ({ name })),
      });
      cursor += 1;
    }
    if (!rows.length) continue;
    return {
      before: lines.slice(0, index).join("\n").trim(),
      rows,
      after: lines.slice(cursor).join("\n").trim(),
    };
  }
  return null;
}

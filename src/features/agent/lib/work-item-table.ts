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
  labels?: string[];
  description?: string;
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

export function stripEmojisAndSymbols(value: string): string {
  return value
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Emoji}]/gu, "")
    .replace(/[—–\-•·*`_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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
  const cleaned = stripEmojisAndSymbols(trimmed).toLowerCase();
  if (STATUS_ALIASES[cleaned]) return STATUS_ALIASES[cleaned];
  if (/in\s*progress/i.test(cleaned)) return "IN_PROGRESS";
  if (/in\s*review/i.test(cleaned)) return "IN_REVIEW";
  if (/todo|to\s*do|backlog/i.test(cleaned)) return "TODO";
  if (/done|completed/i.test(cleaned)) return "DONE";
  return STATUS_ALIASES[aliasKey(trimmed)] || trimmed;
}

export function normalizePriority(value?: string): string | undefined {
  if (!value) return value;
  const trimmed = stripCell(value);
  const cleaned = stripEmojisAndSymbols(trimmed).toLowerCase();
  if (PRIORITY_ALIASES[cleaned]) return PRIORITY_ALIASES[cleaned];
  if (/urgent|critical/i.test(cleaned)) return "URGENT";
  if (/high/i.test(cleaned)) return "HIGH";
  if (/medium|med/i.test(cleaned)) return "MEDIUM";
  if (/low/i.test(cleaned)) return "LOW";
  return PRIORITY_ALIASES[aliasKey(trimmed)] || (cleaned ? cleaned.toUpperCase() : trimmed);
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
    labels: source.labels?.length ? source.labels : base.labels,
    description: source.description || base.description,
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
    const keyIdx = labels.findIndex((cell) => cell === "key" || cell === "id");
    const numIdx = labels.findIndex(
      (cell) => cell === "#" || cell === "no" || cell === "num" || cell === "index" || cell === "item"
    );
    const titleIdx = labels.findIndex(
      (cell) => cell.includes("title") || cell === "task" || cell === "name" || cell === "summary"
    );
    const statusIdx = labels.findIndex((cell) => cell.includes("status"));
    const priorityIdx = labels.findIndex((cell) => cell.includes("priority"));
    const assigneeIdx = labels.findIndex((cell) => cell.includes("assignee"));
    const typeIdx = labels.findIndex((cell) => cell === "type" || cell.includes("type"));
    const labelsIdx = labels.findIndex((cell) => cell.includes("label") || cell.includes("tag"));
    const descIdx = labels.findIndex((cell) => cell.includes("desc") || cell.includes("detail") || cell.includes("criteria"));

    if (titleIdx < 0) continue;
    if (keyIdx < 0 && numIdx < 0 && typeIdx < 0) continue;
    if (statusIdx < 0 && priorityIdx < 0 && assigneeIdx < 0 && typeIdx < 0 && labelsIdx < 0) continue;

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
      const rawKey = keyIdx >= 0 ? cells[keyIdx]?.trim() : numIdx >= 0 ? cells[numIdx]?.trim() : "";
      const key = rawKey
        ? rawKey.startsWith("#") || /^[A-Z0-9]+-\d+$/i.test(rawKey)
          ? rawKey
          : `#${rawKey}`
        : `#${rows.length + 1}`;
      const assigneesRaw = assigneeIdx >= 0 ? cells[assigneeIdx] ?? "" : "";
      const unassigned = assigneeIdx < 0 || /unassigned/i.test(assigneesRaw) || !assigneesRaw.trim();
      const labelsRaw = labelsIdx >= 0 ? cells[labelsIdx] ?? "" : "";
      const rowLabels = labelsRaw ? labelsRaw.split(",").map((l) => stripCell(l)).filter(Boolean) : [];
      const description = descIdx >= 0 ? cells[descIdx]?.trim() : undefined;
      const type = typeIdx >= 0 ? normalizeType(cells[typeIdx]) : "";
      const row: AgentWorkItem = {
        key,
        title: titleIdx >= 0 ? cells[titleIdx] : "",
        status: statusIdx >= 0 ? normalizeStatus(cells[statusIdx]) : "TODO",
        type,
        priority: priorityIdx >= 0 ? normalizePriority(cells[priorityIdx]) : "MEDIUM",
        unassigned,
        assignees: unassigned
          ? []
          : assigneesRaw
              .split(",")
              .map((name) => stripCell(name))
              .filter(Boolean)
              .map((name) => ({ name })),
      };
      if (rowLabels.length > 0) row.labels = rowLabels;
      if (description) row.description = description;
      rows.push(row);
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

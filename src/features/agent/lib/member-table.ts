import { isSeparatorRow, splitPipeRow, stripCell } from "./work-item-table";

export type AgentMember = {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
  status?: string;
  imageUrl?: string | null;
};

const ROLE_ALIASES: Record<string, string> = {
  owner: "OWNER",
  admin: "ADMIN",
  member: "MEMBER",
  viewer: "WS_VIEWER",
  editor: "WS_EDITOR",
  "ws admin": "WS_ADMIN",
  ws_admin: "WS_ADMIN",
  "ws editor": "WS_EDITOR",
  ws_editor: "WS_EDITOR",
  "ws viewer": "WS_VIEWER",
  ws_viewer: "WS_VIEWER",
};

function aliasKey(value: string): string {
  return stripCell(value).toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

export function normalizeRole(value?: string): string | undefined {
  if (!value) return value;
  const trimmed = stripCell(value);
  return ROLE_ALIASES[aliasKey(trimmed)] || trimmed;
}

export function memberLookupKey(member: AgentMember): string {
  const email = String(member.email ?? "").trim().toLowerCase();
  if (email) return `email:${email}`;
  const name = String(member.name ?? "").trim().toLowerCase();
  return name ? `name:${name}` : "";
}

export function mergeMember(base: AgentMember, extra?: AgentMember): AgentMember {
  const source = extra ?? {};
  return {
    id: source.id || base.id,
    name: source.name || base.name,
    email: source.email || base.email,
    role: normalizeRole(source.role || base.role),
    status: source.status || base.status,
    imageUrl: source.imageUrl || base.imageUrl || null,
  };
}

export function splitMarkdownMemberTable(content: string): {
  before: string;
  rows: AgentMember[];
  after: string;
} | null {
  const lines = content.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const header = splitPipeRow(lines[index] ?? "");
    if (!header) continue;
    const labels = header.map((cell) => cell.toLowerCase().replace(/\s+/g, " ").trim());
    if (labels.some((cell) => cell === "key")) continue;
    const nameIdx = labels.findIndex((cell) => cell === "name" || cell === "member" || cell.includes("name"));
    const emailIdx = labels.findIndex((cell) => cell.includes("email") || cell === "mail");
    const roleIdx = labels.findIndex((cell) => cell.includes("role"));
    if (roleIdx < 0 || (nameIdx < 0 && emailIdx < 0)) continue;

    let cursor = index + 1;
    if (cursor < lines.length && isSeparatorRow(lines[cursor] ?? "")) cursor += 1;
    const rows: AgentMember[] = [];
    while (cursor < lines.length) {
      const line = lines[cursor] ?? "";
      if (isSeparatorRow(line)) {
        cursor += 1;
        continue;
      }
      const cells = splitPipeRow(line);
      if (!cells) break;
      const name = nameIdx >= 0 ? cells[nameIdx] ?? "" : "";
      const email = emailIdx >= 0 ? cells[emailIdx] ?? "" : "";
      const role = normalizeRole(roleIdx >= 0 ? cells[roleIdx] : "");
      if (!name && !email) {
        cursor += 1;
        continue;
      }
      rows.push({ name, email, role });
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

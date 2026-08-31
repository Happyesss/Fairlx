export type NamedMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
};

export type MemberMatch =
  | { kind: "one"; member: NamedMember }
  | { kind: "many"; members: NamedMember[] }
  | { kind: "none" };

const ROLE_ALIASES: Record<string, "OWNER" | "ADMIN" | "MEMBER"> = {
  OWNER: "OWNER",
  ADMIN: "ADMIN",
  ADMINISTRATOR: "ADMIN",
  WS_ADMIN: "ADMIN",
  MEMBER: "MEMBER",
  EDITOR: "MEMBER",
  WS_EDITOR: "MEMBER",
};

export function normalizeMemberRole(raw: string): "OWNER" | "ADMIN" | "MEMBER" {
  const key = raw.trim().toUpperCase().replace(/[\s-]+/g, "_");
  const mapped = ROLE_ALIASES[key];
  if (!mapped) {
    throw new Error(`Unknown role "${raw}". Use ADMIN, MEMBER, or OWNER.`);
  }
  return mapped;
}

export function isWorkspaceAdminRole(role: string): boolean {
  const key = role.trim().toUpperCase();
  return key === "OWNER" || key === "ADMIN" || key === "WS_ADMIN";
}

function fold(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9@.]+/g, " ").replace(/\s+/g, " ").trim();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i += 1) {
    const cur = [i + 1];
    for (let j = 0; j < b.length; j += 1) {
      const cost = a[i] === b[j] ? 0 : 1;
      cur.push(Math.min(cur[j]! + 1, prev[j + 1]! + 1, prev[j]! + cost));
    }
    for (let j = 0; j < cur.length; j += 1) prev[j] = cur[j]!;
  }
  return prev[b.length]!;
}

function scoreCandidate(query: string, member: NamedMember): number {
  const q = fold(query);
  if (!q) return 0;
  const name = fold(member.name);
  const email = fold(member.email);
  if (q === name || q === email) return 100;
  if (email && (q === email.split("@")[0] || email === q)) return 98;
  if (name.startsWith(q) || `${name} `.includes(` ${q} `) || name.endsWith(` ${q}`)) return 90;
  if (name.includes(q) || (email && email.includes(q))) return 80;
  const distance = levenshtein(q, name);
  const allowed = q.length >= 12 ? 2 : 1;
  if (distance <= allowed && q.length >= 5) return 70 - distance;
  const qTokens = q.split(" ");
  const nLast = name.split(" ").pop() ?? "";
  const qLast = qTokens[qTokens.length - 1] ?? "";
  const lastNameDistance = q.length >= 6 ? 2 : 1;
  if (qTokens.length === 1 && q.length >= 5 && nLast.length >= 5 && levenshtein(q, nLast) <= lastNameDistance) {
    return 75;
  }
  if (
    qLast.length >= 5 &&
    nLast.length >= 5 &&
    levenshtein(qLast, nLast) <= lastNameDistance &&
    qTokens[0] === name.split(" ")[0]
  ) {
    return 72;
  }
  return 0;
}

export function matchWorkspaceMember(query: string, members: NamedMember[]): MemberMatch {
  const ranked = members
    .map((member) => ({ member, score: scoreCandidate(query, member) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);
  if (ranked.length === 0) return { kind: "none" };
  const top = ranked[0]!;
  const close = ranked.filter((row) => row.score >= Math.min(70, top.score) && top.score - row.score <= 10);
  if (close.length > 1 && top.score < 100) {
    return { kind: "many", members: close.map((row) => row.member) };
  }
  return { kind: "one", member: top.member };
}

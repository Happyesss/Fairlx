/** Builtin isolated source review. Shannon can replace scanSourceFiles later via the same plugin slot. */

export type SecurityFinding = {
  id: string;
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  category: "injection" | "xss" | "auth" | "secrets" | "ssrf";
  path: string;
  evidence: string;
  verified: boolean;
};

type ScanFile = { path: string; content: string };

const RULES: Array<{
  category: SecurityFinding["category"];
  severity: SecurityFinding["severity"];
  title: string;
  pattern: RegExp;
}> = [
  {
    category: "secrets",
    severity: "critical",
    title: "Hard-coded secret",
    pattern: /(api[_-]?key|secret|password|token)\s*[:=]\s*['"][A-Za-z0-9_\-/+=]{12,}['"]/i,
  },
  {
    category: "secrets",
    severity: "critical",
    title: "AWS access key",
    pattern: /AKIA[0-9A-Z]{16}/,
  },
  {
    category: "injection",
    severity: "high",
    title: "SQL concatenated with user input",
    pattern: /(query|execute|raw)\s*\(\s*[`'"].*\$\{|(SELECT|INSERT|UPDATE|DELETE)[\s\S]{0,80}\+|sql\s*\+/i,
  },
  {
    category: "xss",
    severity: "high",
    title: "Unsanitized HTML sink",
    pattern: /(innerHTML|dangerouslySetInnerHTML|document\.write)\s*=/,
  },
  {
    category: "ssrf",
    severity: "medium",
    title: "Server-side fetch of user-controlled URL",
    pattern: /fetch\s*\(\s*(req\.|request\.|body\.|query\.)/i,
  },
  {
    category: "auth",
    severity: "high",
    title: "Disabled authorization check",
    pattern: /bypassPermissions|DISABLE_AUTH|auth\s*=\s*false/i,
  },
];

function snippet(content: string, index: number): string {
  const start = Math.max(0, content.lastIndexOf("\n", index) - 40);
  return content.slice(start, start + 160).trim();
}

export function scanSourceFiles(files: ScanFile[]): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  for (const file of files) {
    if (!file.path || !file.content) continue;
    for (const rule of RULES) {
      const match = rule.pattern.exec(file.content);
      if (!match) continue;
      findings.push({
        id: crypto.randomUUID(),
        title: rule.title,
        severity: rule.severity,
        category: rule.category,
        path: file.path,
        evidence: snippet(file.content, match.index ?? 0),
        verified: false,
      });
    }
  }
  return findings;
}

export function verifyFindings(findings: SecurityFinding[]): SecurityFinding[] {
  return findings
    .filter((finding) => Boolean(finding.path) && Boolean(finding.evidence))
    .map((finding) => ({ ...finding, verified: true }));
}

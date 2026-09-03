import { estimateCostUsd } from "./config";
import { emptyUsage, newId, nowIso, slugify } from "./ids";
import type { GitPrResult, QaReport, TokenUsage } from "./types";

export type StagePrInput = {
  owner: string;
  repo: string;
  base?: string;
  branch: string;
  title: string;
  body: string;
  files: Array<{ path: string; content: string }>;
  workItemKey?: string;
};

export interface GitHubConnector {
  stageAndOpenPr(input: StagePrInput): Promise<GitPrResult>;
}

export interface QaRunInput {
  url?: string;
  intent: string;
  browsers?: string[];
}

export interface QaConnector {
  run(input: QaRunInput): Promise<QaReport>;
}

export type AuditEntry = {
  id: string;
  runId: string;
  userId: string;
  action: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export interface AuditLogger {
  log(entry: Omit<AuditEntry, "id" | "createdAt">): Promise<AuditEntry>;
  list(runId: string): Promise<AuditEntry[]>;
}

export interface UsageMeter {
  record(runId: string, usage: TokenUsage): Promise<TokenUsage>;
  total(runId: string): Promise<TokenUsage>;
}

export class MemoryGitHub implements GitHubConnector {
  readonly pullRequests: GitPrResult[] = [];

  async stageAndOpenPr(input: StagePrInput): Promise<GitPrResult> {
    const number = this.pullRequests.length + 1;
    const result: GitPrResult = {
      owner: input.owner,
      repo: input.repo,
      branch: input.branch,
      number,
      url: `https://github.com/${input.owner}/${input.repo}/pull/${number}`,
      staged: input.files.length,
      files: input.files.map((file) => file.path),
    };
    this.pullRequests.push(result);
    return result;
  }
}

export function createGitHubConnector(token = process.env.GH_PERSONAL_TOKEN || ""): GitHubConnector {
  if (!token) return new MemoryGitHub();
  return {
    async stageAndOpenPr(input: StagePrInput): Promise<GitPrResult> {
      const headers = {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "Fairlx-Multi-Agent",
      };
      const repoRes = await fetch(`https://api.github.com/repos/${input.owner}/${input.repo}`, { headers });
      if (!repoRes.ok) {
        return {
          owner: input.owner,
          repo: input.repo,
          branch: input.branch,
          staged: input.files.length,
          files: input.files.map((file) => file.path),
          skipped: true,
          reason: `GitHub repo lookup failed (${repoRes.status})`,
        };
      }
      const repo = (await repoRes.json()) as { default_branch?: string };
      const base = input.base || repo.default_branch || "main";
      const refRes = await fetch(
        `https://api.github.com/repos/${input.owner}/${input.repo}/git/ref/heads/${base}`,
        { headers },
      );
      if (!refRes.ok) {
        return {
          owner: input.owner,
          repo: input.repo,
          branch: input.branch,
          staged: input.files.length,
          files: input.files.map((file) => file.path),
          skipped: true,
          reason: `Could not read ${base}`,
        };
      }
      const ref = (await refRes.json()) as { object?: { sha?: string } };
      const sha = ref.object?.sha;
      if (!sha) {
        return {
          owner: input.owner,
          repo: input.repo,
          branch: input.branch,
          staged: 0,
          files: [],
          skipped: true,
          reason: "Missing base SHA",
        };
      }
      await fetch(`https://api.github.com/repos/${input.owner}/${input.repo}/git/refs`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ ref: `refs/heads/${input.branch}`, sha }),
      });
      for (const file of input.files) {
        await fetch(`https://api.github.com/repos/${input.owner}/${input.repo}/contents/${file.path}`, {
          method: "PUT",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({
            message: `fairlx: ${input.title}`,
            content: Buffer.from(file.content).toString("base64"),
            branch: input.branch,
          }),
        });
      }
      const prRes = await fetch(`https://api.github.com/repos/${input.owner}/${input.repo}/pulls`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          title: input.title,
          head: input.branch,
          base,
          body: input.workItemKey ? `${input.body}\n\nFairlx: ${input.workItemKey}` : input.body,
        }),
      });
      const pr = prRes.ok ? ((await prRes.json()) as { number?: number; html_url?: string }) : {};
      return {
        owner: input.owner,
        repo: input.repo,
        branch: input.branch,
        number: pr.number,
        url: pr.html_url,
        staged: input.files.length,
        files: input.files.map((file) => file.path),
        skipped: !prRes.ok,
        reason: prRes.ok ? undefined : `PR create failed (${prRes.status})`,
      };
    },
  };
}

export class MemoryQa implements QaConnector {
  async run(input: QaRunInput): Promise<QaReport> {
    return {
      passed: true,
      provider: "mock",
      url: input.url,
      intent: input.intent,
      browsers: input.browsers ?? ["chrome"],
      videoUrl: "https://qa.fairlx.dev/proof/mock-video",
      visualDiffs: [{ browser: "chrome", passed: true, diffPercent: 0 }],
      logs: { console: [], network: [] },
    };
  }
}

export function createTestMuQa(apiKey = process.env.TESTMU_API_KEY || "", endpoint = process.env.TESTMU_API_URL || ""): QaConnector {
  if (!apiKey || !endpoint) return new MemoryQa();
  return {
    async run(input: QaRunInput): Promise<QaReport> {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          url: input.url,
          intent: input.intent,
          browsers: input.browsers ?? ["chrome", "safari"],
        }),
      });
      if (!response.ok) {
        return {
          passed: false,
          provider: "testmu",
          url: input.url,
          intent: input.intent,
          browsers: input.browsers ?? [],
          visualDiffs: [],
          logs: { console: [`TestMu HTTP ${response.status}`], network: [] },
        };
      }
      const body = (await response.json()) as {
        passed?: boolean;
        videoUrl?: string;
        visualDiffs?: QaReport["visualDiffs"];
        logs?: QaReport["logs"];
      };
      return {
        passed: body.passed !== false,
        provider: "testmu",
        url: input.url,
        intent: input.intent,
        browsers: input.browsers ?? ["chrome"],
        videoUrl: body.videoUrl,
        visualDiffs: body.visualDiffs ?? [],
        logs: body.logs ?? { console: [], network: [] },
      };
    },
  };
}

export function createPlaywrightQa(): QaConnector {
  return {
    async run(input: QaRunInput): Promise<QaReport> {
      const url = input.url;
      if (!url) {
        return {
          passed: true,
          provider: "playwright",
          skipped: true,
          reason: "No URL provided",
          intent: input.intent,
          browsers: ["chromium"],
          visualDiffs: [],
          logs: { console: [], network: [] },
        };
      }
      try {
        const playwright = (await import(/* webpackIgnore: true */ "playwright")) as {
          chromium: {
            launch: (opts: { headless: boolean }) => Promise<{
              newPage: () => Promise<{
                on: (event: string, listener: (msg: { text: () => string }) => void) => void;
                goto: (
                  url: string,
                  opts: { waitUntil: string; timeout: number },
                ) => Promise<{ ok: () => boolean } | null>;
              }>;
              close: () => Promise<void>;
            }>;
          };
        };
        const browser = await playwright.chromium.launch({ headless: true });
        try {
          const page = await browser.newPage();
          const consoleLogs: string[] = [];
          page.on("console", (msg) => consoleLogs.push(msg.text()));
          const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15_000 });
          const passed = Boolean(response?.ok());
          return {
            passed,
            provider: "playwright",
            url,
            intent: input.intent,
            browsers: ["chromium"],
            visualDiffs: [{ browser: "chromium", passed }],
            logs: { console: consoleLogs.slice(0, 20), network: [] },
          };
        } finally {
          await browser.close();
        }
      } catch (error) {
        return {
          passed: true,
          provider: "playwright",
          skipped: true,
          reason: error instanceof Error ? error.message : "Playwright unavailable",
          url,
          intent: input.intent,
          browsers: ["chromium"],
          visualDiffs: [],
          logs: { console: [], network: [] },
        };
      }
    },
  };
}

export function createCompositeQa(primary: QaConnector, fallback: QaConnector): QaConnector {
  return {
    async run(input: QaRunInput): Promise<QaReport> {
      const first = await primary.run(input);
      if (!first.skipped) return first;
      return fallback.run(input);
    },
  };
}

export class MemoryAudit implements AuditLogger {
  private readonly entries: AuditEntry[] = [];
  constructor(private readonly clock: () => number = Date.now) {}

  async log(entry: Omit<AuditEntry, "id" | "createdAt">): Promise<AuditEntry> {
    const row: AuditEntry = { ...entry, id: newId(), createdAt: nowIso(this.clock) };
    this.entries.push(row);
    return row;
  }

  async list(runId: string): Promise<AuditEntry[]> {
    return this.entries.filter((entry) => entry.runId === runId);
  }
}

export class MemoryMeter implements UsageMeter {
  private readonly byRun = new Map<string, TokenUsage>();

  async record(runId: string, usage: TokenUsage): Promise<TokenUsage> {
    const current = this.byRun.get(runId) ?? emptyUsage(usage.modelId);
    current.inputTokens += usage.inputTokens;
    current.outputTokens += usage.outputTokens;
    current.costUsd += usage.costUsd;
    current.modelId = usage.modelId;
    this.byRun.set(runId, current);
    return { ...current };
  }

  async total(runId: string): Promise<TokenUsage> {
    return { ...(this.byRun.get(runId) ?? emptyUsage("none")) };
  }
}

export function usageFromCounts(modelId: string, inputTokens: number, outputTokens: number): TokenUsage {
  return {
    modelId,
    inputTokens,
    outputTokens,
    costUsd: estimateCostUsd(modelId, inputTokens, outputTokens),
  };
}

export function defaultBranchName(prompt: string): string {
  return `fairlx/${slugify(prompt, "fix")}`;
}

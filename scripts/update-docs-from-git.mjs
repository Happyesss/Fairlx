#!/usr/bin/env node
/**
 * Regenerates changelog.md and the Latest block in README.md from git history.
 * Run on every commit (--commit) and every push (--push).
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const README = join(ROOT, "README.md");
const CHANGELOG = join(ROOT, "changelog.md");
const START = "<!-- docs:latest:start -->";
const END = "<!-- docs:latest:end -->";
const SKIP_SUBJECT = /^(docs: refresh README and changelog\b)/;

function git(args) {
  return execSync(`git ${args}`, {
    encoding: "utf8",
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function escapeTable(value) {
  return String(value ?? "")
    .replaceAll("|", "\\|")
    .replaceAll("\n", " ");
}

function commits(limit = 80) {
  let raw = "";
  try {
    raw = git(`log -${limit} --pretty=format:%h%x09%s%x09%ad%x09%an --date=short`);
  } catch {
    return [];
  }
  if (!raw) return [];
  return raw
    .split("\n")
    .map((line) => {
      const [hash, subject, date, author] = line.split("\t");
      return { hash, subject, date, author };
    })
    .filter((row) => row.hash && row.subject && !SKIP_SUBJECT.test(row.subject));
}

function stagedFiles() {
  let raw = "";
  try {
    raw = git("diff --cached --name-only");
  } catch {
    return [];
  }
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((file) => file && file !== "README.md" && file !== "changelog.md");
}

function buildChangelog(includeStaged) {
  const rows = commits(100);
  const staged = includeStaged ? stagedFiles() : [];
  const generatedAt = new Date().toISOString();
  const lines = [
    "# Changelog",
    "",
    "This file is generated on every `git commit` and `git push`. Do not edit it by hand.",
    "",
    "Older session notes live in [docs/changelog-history.md](docs/changelog-history.md).",
    "",
  ];
  if (staged.length) {
    lines.push("## Unreleased", "", "Files in this commit:", "");
    for (const file of staged) lines.push(`- \`${file}\``);
    lines.push("");
  }
  lines.push("## Recent commits", "");
  lines.push("| Date | Commit | Message | Author |");
  lines.push("|------|--------|---------|--------|");
  for (const row of rows) {
    lines.push(
      `| ${row.date} | \`${row.hash}\` | ${escapeTable(row.subject)} | ${escapeTable(row.author)} |`,
    );
  }
  if (!rows.length) {
    lines.push("| — | — | No commits yet | — |");
  }
  lines.push("", `Last generated: ${generatedAt}`, "");
  return `${lines.join("\n")}`;
}

function buildLatestBlock(includeStaged) {
  const rows = commits(8);
  const staged = includeStaged ? stagedFiles() : [];
  const generatedAt = new Date().toISOString();
  const lines = [
    `**Last updated:** ${generatedAt}`,
    "",
    "This block and [changelog.md](changelog.md) refresh on every `git commit` and `git push`.",
    "",
  ];
  if (staged.length) {
    lines.push("**This commit**", "");
    for (const file of staged.slice(0, 20)) lines.push(`- \`${file}\``);
    if (staged.length > 20) lines.push(`- …and ${staged.length - 20} more files`);
    lines.push("");
  }
  lines.push("**Latest commits**", "");
  if (!rows.length) {
    lines.push("- No commits yet.");
  } else {
    for (const row of rows) {
      lines.push(`- \`${row.hash}\` ${row.subject} (${row.date})`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

function patchReadme(block) {
  const text = readFileSync(README, "utf8");
  const start = text.indexOf(START);
  const end = text.indexOf(END);
  if (start < 0 || end < 0 || end < start) {
    throw new Error("README.md is missing <!-- docs:latest:start --> / <!-- docs:latest:end --> markers");
  }
  return `${text.slice(0, start + START.length)}\n${block}${text.slice(end)}`;
}

function main() {
  const includeStaged = process.argv.includes("--commit");
  writeFileSync(CHANGELOG, buildChangelog(includeStaged), "utf8");
  writeFileSync(README, patchReadme(buildLatestBlock(includeStaged)), "utf8");
}

main();

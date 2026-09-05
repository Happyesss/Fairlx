#!/usr/bin/env node
import { chmodSync, copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GIT_DIR = join(ROOT, ".git");
const HOOKS_SRC = join(ROOT, ".githooks");
const HOOKS_DEST = join(GIT_DIR, "hooks");

if (!existsSync(GIT_DIR)) {
  process.exit(0);
}

mkdirSync(HOOKS_DEST, { recursive: true });
for (const name of ["pre-commit", "pre-push"]) {
  const from = join(HOOKS_SRC, name);
  const to = join(HOOKS_DEST, name);
  if (!existsSync(from)) continue;
  copyFileSync(from, to);
  chmodSync(to, 0o755);
}

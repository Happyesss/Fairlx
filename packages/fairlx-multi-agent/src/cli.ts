#!/usr/bin/env tsx
import { createManualScheduler } from "./runtime";
import { createMultiAgentEngine } from "./engine";
import { generateDailyBriefing } from "./context";
import type { PersonaRole } from "./types";

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function flag(name: string): boolean {
  return process.argv.includes(name);
}

async function main() {
  const prompt = arg("--prompt", "Fix mobile sidebar overflow and test it.")!;
  const role = (arg("--role", "tech_lead") || "tech_lead") as PersonaRole;
  const json = flag("--json");
  const userName = arg("--user", "Ada");

  const briefing = generateDailyBriefing({
    userName,
    personaRole: role,
    workItems: [
      { id: "i1", key: "WEB-102", title: "Mobile sidebar overflow", status: "IN_PROGRESS", priority: "HIGH" },
      { id: "i2", key: "WEB-88", title: "Unassigned login polish", status: "OPEN" },
    ],
    unassigned: [{ id: "i2", key: "WEB-88", title: "Unassigned login polish", status: "OPEN" }],
    blockers: [{ id: "i3", key: "WEB-77", title: "Design tokens blocked on API", status: "BLOCKED", blockedBy: ["i9"] }],
    sprints: [{ id: "s24", name: "Sprint 24", status: "active", committedPoints: 38, totalPoints: 42, endDate: "2026-09-12" }],
  });

  const scheduler = createManualScheduler();
  const engine = createMultiAgentEngine({ scheduler });
  const started = Date.now();
  const parentId = await engine.startGoal({
    userId: "cli-user",
    prompt,
    personaRole: role,
    workspaceRole: "ADMIN",
    workspaceId: "w1",
    projectId: "p1",
    context: {
      user: { id: "cli-user", name: userName || "Ada", email: "ada@fairlx.dev" },
      personaRole: role,
      workspaceRole: "ADMIN",
      workspaceId: "w1",
      projectId: "p1",
      workspaceName: "Acme",
      projectName: "Website",
      projectKey: "WEB",
      entities: [],
      workItems: briefing.priorities.map((title, index) => ({ id: `b${index}`, title })),
      sprints: [],
      blockers: [],
      unassigned: [],
      repos: [{ id: "r1", owner: "acme", name: "website", branch: "main" }],
    },
  });

  let guard = 0;
  while (scheduler.pending > 0 && guard < 32) {
    guard += 1;
    await scheduler.flush();
  }

  const result = await engine.getRun(parentId);
  const children = result ? await engine.store.listByParent(parentId) : [];
  const elapsed = Date.now() - started;

  if (json) {
    console.log(
      JSON.stringify(
        {
          briefing,
          parent: result,
          children: children.map((child) => ({
            id: child.id,
            type: child.subAgentType,
            status: child.status,
            title: child.title,
          })),
          elapsedMs: elapsed,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(`${briefing.greeting}`);
  console.log(briefing.headline);
  for (const line of briefing.priorities) console.log(`  • ${line}`);
  console.log("");
  console.log(`Autonomous run ${parentId} → ${result?.status} (${elapsed}ms)`);
  for (const child of children) {
    console.log(`  ${child.subAgentType?.padEnd(10)} ${child.status.padEnd(22)} ${child.title}`);
  }
  const review = children.find((child) => child.subAgentType === "reviewer");
  if (review) console.log(`\nReview: ${review.messages.at(-1)?.content}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

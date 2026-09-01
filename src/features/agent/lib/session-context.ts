import type { AgentContextChip, AgentSessionMode } from "../types";

export const AGENT_SESSION_MODES: Array<{
  id: AgentSessionMode;
  label: string;
  icon: string;
  hint: string;
}> = [
  {
    id: "agent",
    label: "Agent",
    icon: "fa-solid fa-robot",
    hint: "Inspect, plan, then act with tools.",
  },
  {
    id: "plan",
    label: "Plan",
    icon: "fa-solid fa-sliders",
    hint: "Investigate and write a plan. Do not edit yet.",
  },
  {
    id: "debug",
    label: "Debug",
    icon: "fa-solid fa-bug",
    hint: "Find the failure and propose a fix.",
  },
  {
    id: "ask",
    label: "Ask",
    icon: "fa-regular fa-comment-dots",
    hint: "Answer from context. Tools stay off unless you switch mode.",
  },
];

export const SESSION_MODE_INSTRUCTIONS: Record<AgentSessionMode, string> = {
  agent: "Inspect Fairlx data, then act. Prefer tools. Ask before destructive changes.",
  plan: "Stay in Plan mode. Inspect and produce a concrete implementation plan. Do not claim you edited files or committed git.",
  debug: "Stay in Debug mode. Reproduce the failure from attached work items, logs, and code paths. Identify root cause, then a focused fix.",
  multitask: "Stay in Multitask mode. Delegate to planner, researcher, builder, git, or reviewer specialists when the work spans roles, then synthesize.",
  ask: "Stay in Ask mode. Answer from attached context and Fairlx data. Do not call tools unless the user explicitly asks you to take an action.",
};

export function runModeForSession(session: AgentSessionMode): "agent" | "manual" {
  return session === "ask" ? "manual" : "agent";
}

export function composeUserPrompt(text: string, chips: AgentContextChip[], sessionMode: AgentSessionMode) {
  const parts: string[] = [];
  if (sessionMode !== "agent") {
    parts.push(`[Session mode: ${sessionMode}] ${SESSION_MODE_INSTRUCTIONS[sessionMode]}`);
  }
  if (chips.length) {
    parts.push("[Attached context]");
    for (const chip of chips) {
      parts.push(`- ${chip.kind}: ${chip.label}${chip.meta ? ` (${chip.meta})` : ""} [${chip.id}]`);
    }
  }
  parts.push(text.trim());
  return parts.filter(Boolean).join("\n");
}

export function displayUserContent(content: string) {
  const lines = content.split("\n");
  let i = 0;
  if (lines[0]?.startsWith("[Session mode")) i = 1;
  if (lines[i]?.startsWith("[Attached context]")) {
    i += 1;
    while (i < lines.length && lines[i]?.startsWith("- ")) i += 1;
  }
  return lines.slice(i).join("\n").trim() || content;
}

export function chipKey(chip: AgentContextChip) {
  return `${chip.kind}:${chip.id}`;
}

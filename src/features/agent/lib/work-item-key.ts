import type { AgentContextWorkItem } from "../types";

export function matchWorkItem(
  items: AgentContextWorkItem[],
  key: string,
): AgentContextWorkItem | undefined {
  const needle = key.trim().toLowerCase();
  if (!needle) return undefined;
  return items.find((item) => item.id === key || (item.key ?? "").toLowerCase() === needle);
}

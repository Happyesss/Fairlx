import { getSkill as fromRegistry, listSkills, type McpSkill } from "./registry";

/** Skills are embedded in the registry so Next.js bundles do not depend on fs. */
export function getSkill(id: string): McpSkill | undefined {
  return fromRegistry(id);
}

export function loadAllSkills(): McpSkill[] {
  return listSkills();
}

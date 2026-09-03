import {
  agentContextToInjected,
  createMultiAgentEngine,
  generateDailyBriefing,
  type PersonaRole,
} from "@fairlx/multi-agent";

import type { AgentContext } from "../types";

export { createMultiAgentEngine, generateDailyBriefing, agentContextToInjected };

export function briefingFromAgentContext(
  context: AgentContext,
  options?: { workspaceId?: string; projectId?: string; personaRole?: PersonaRole },
) {
  const injected = agentContextToInjected(context, options);
  const assignedWork = context.workItems.map((item) => ({
    id: item.id,
    key: item.key,
    title: item.title,
    status: item.status,
    priority: item.priority,
    type: item.type,
    dueAt: item.dueDate,
    flagged: item.flagged,
    workspaceId: item.workspaceId,
    createdAt: item.createdAt,
  }));
  return generateDailyBriefing({
    userName: context.user.name,
    personaRole: options?.personaRole ?? injected.personaRole,
    workspaceRole: injected.workspaceRole,
    workItems: injected.workItems,
    assignedWork,
    sprints: injected.sprints,
    blockers: injected.blockers,
    unassigned: injected.unassigned,
  });
}

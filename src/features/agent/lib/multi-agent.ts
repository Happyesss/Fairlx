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
  return generateDailyBriefing({
    userName: context.user.name,
    personaRole: options?.personaRole ?? injected.personaRole,
    workspaceRole: injected.workspaceRole,
    workItems: injected.workItems,
    sprints: injected.sprints,
    blockers: injected.blockers,
    unassigned: injected.unassigned,
  });
}

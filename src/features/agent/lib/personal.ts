import type { AgentHarness, AgentRun } from "../types";

export const PERSONAL_RESOURCE_KINDS = [
  "harness",
  "skills",
  "knowledge",
  "rules",
  "automations",
  "chats",
  "staging",
] as const;

export type PersonalResourceKind = (typeof PERSONAL_RESOURCE_KINDS)[number];

export function personalResourceUri(kind: PersonalResourceKind) {
  return `fairlx://me/${kind}`;
}

export function listPersonalResources() {
  return PERSONAL_RESOURCE_KINDS.map((kind) => ({
    uri: personalResourceUri(kind),
    name: `Personal ${kind}`,
    description: `User-scoped ${kind} from the Fairlx Agent harness`,
    mimeType: "application/json",
  }));
}

export function readPersonalContent(params: {
  kind: string;
  harness: AgentHarness;
  runs?: AgentRun[];
  query?: string;
}): unknown {
  const { kind, harness, runs = [], query = "" } = params;
  const needle = query.trim().toLowerCase();
  const match = (value?: string) => !needle || (value ?? "").toLowerCase().includes(needle);

  switch (kind) {
    case "harness":
    case "summary":
      return {
        userId: harness.userId,
        mode: harness.settings.mode,
        defaultWorkspaceId: harness.settings.defaultWorkspaceId,
        defaultProjectId: harness.settings.defaultProjectId,
        skills: harness.skills.filter((item) => item.enabled).map((item) => item.name),
        automations: harness.automations.filter((item) => item.enabled).map((item) => item.name),
        knowledgeCount: harness.knowledge.length,
        rules: harness.workPatterns.filter((item) => item.enabled).map((item) => item.name),
        staged: harness.gitStaging.items.filter((item) => item.status === "staged").length,
        pinnedChats: harness.chatMeta.pinnedRunIds.length,
      };
    case "skills":
      return harness.skills.filter((item) => match(item.name) || match(item.description) || match(item.instructions));
    case "knowledge":
      return harness.knowledge.filter((item) => match(item.title) || match(item.content) || match(item.source));
    case "rules":
    case "work_patterns":
      return harness.workPatterns.filter((item) => match(item.name) || match(item.instructions));
    case "automations":
      return harness.automations.filter(
        (item) => match(item.name) || match(item.description) || match(item.trigger) || match(item.action),
      );
    case "chats":
    case "runs":
      return runs
        .filter((run) => !harness.chatMeta.archivedRunIds.includes(run.id))
        .filter((run) => match(run.title) || match(run.prompt))
        .slice(0, 30)
        .map((run) => ({
          id: run.id,
          title: run.title,
          status: run.status,
          pinned: harness.chatMeta.pinnedRunIds.includes(run.id),
          updatedAt: run.updatedAt,
        }));
    case "staging":
    case "git":
      return harness.gitStaging;
    default:
      return { error: `Unknown personal resource: ${kind}` };
  }
}

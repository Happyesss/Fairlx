import type { Databases } from "node-appwrite";

import type { AgentContext, PersonalPersonaRole, PersonalTrainingAnswer } from "../types";
import { completePlainText } from "./complete-text";
import { defaultAiStoredConfig, mergePlatformAiConfig } from "./defaults";
import {
  PERSONAL_PROMPT_COMPILER_SYSTEM,
  compilePersonalPrompt,
  compilerUserMessage,
} from "./personal-training";
import { getAiDocument, parseAiConfig } from "./store";

export async function compileTrainedPersonalPrompt(params: {
  databases: Databases;
  userId: string;
  userName: string;
  context: AgentContext;
  personaRole: PersonalPersonaRole;
  jobTitle?: string;
  workspaceRole?: string;
  workspaceId?: string;
  projectId?: string;
  answers: PersonalTrainingAnswer[];
}): Promise<{ prompt: string; source: "model" | "template" }> {
  const workspace =
    params.context.workspaces.find((item) => item.id === params.workspaceId) ??
    params.context.workspaces[0];
  const project =
    params.context.projects.find((item) => item.id === params.projectId) ??
    params.context.projects.find((item) => item.workspaceId === workspace?.id) ??
    params.context.projects[0];

  const input = {
    userName: params.userName,
    personaRole: params.personaRole,
    jobTitle: params.jobTitle,
    workspaceRole: params.workspaceRole || workspace?.role,
    workspaceName: workspace?.name,
    projectName: project?.name,
    answers: params.answers,
  };
  const fallback = compilePersonalPrompt(input);

  try {
    const aiDoc = await getAiDocument(params.databases, params.userId);
    const stored = mergePlatformAiConfig(aiDoc ? parseAiConfig(aiDoc) : defaultAiStoredConfig());
    const prompt = await completePlainText({
      stored,
      system: PERSONAL_PROMPT_COMPILER_SYSTEM,
      user: compilerUserMessage(input),
      maxTokens: 3500,
    });
    if (prompt.length < Math.min(400, fallback.length * 0.5)) return { prompt: fallback, source: "template" };
    return { prompt, source: "model" };
  } catch (error) {
    console.error("[personal-agent] compile via model failed, using template", error);
    return { prompt: fallback, source: "template" };
  }
}

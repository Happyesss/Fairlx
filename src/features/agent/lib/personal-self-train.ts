import type { Databases } from "node-appwrite";

import type { PersonalAgentProfile } from "../types";
import { firstName } from "./agent-ui";
import { loadAgentContext } from "./context";
import { upsertHarness } from "./harness";
import { compileTrainedPersonalPrompt, inferMissingTrainingAnswers } from "./personal-compile";
import { getPersonalAgent, upsertPersonalAgent } from "./personal-agent-store";
import {
  formatTrainingSnapshot,
  questionsForRole,
  suggestedPersonaRole,
  trainingProgress,
} from "./personal-training";

export type SelfTrainProgressEvent = {
  percent: number;
  stage: string;
  answered?: number;
  total?: number;
  done?: boolean;
  error?: string;
};

async function pulseWhile<T>(params: {
  emit: (event: SelfTrainProgressEvent) => Promise<void> | void;
  from: number;
  to: number;
  stage: string;
  work: () => Promise<T>;
}): Promise<T> {
  const { emit, from, to, stage, work } = params;
  let current = from;
  await emit({ percent: from, stage });
  const timer = setInterval(() => {
    current = Math.min(to - 1, current + 1);
    void emit({ percent: current, stage });
  }, 420);
  try {
    const result = await work();
    await emit({ percent: to, stage });
    return result;
  } finally {
    clearInterval(timer);
  }
}

export async function runPersonalSelfTrain(params: {
  databases: Databases;
  user: { $id: string; name?: string; email?: string };
  emit?: (event: SelfTrainProgressEvent) => Promise<void> | void;
}): Promise<PersonalAgentProfile> {
  const emit = async (event: SelfTrainProgressEvent) => {
    await params.emit?.(event);
  };

  const context = await pulseWhile({
    emit,
    from: 4,
    to: 18,
    stage: "Reading your workspace",
    work: () =>
      loadAgentContext(params.databases, {
        $id: params.user.$id,
        name: params.user.name,
        email: params.user.email,
      }),
  });

  const harness = await upsertHarness(params.databases, params.user.$id, {
    settings: { sessionMode: "personal", mode: "agent" },
  });
  const profile = await getPersonalAgent(params.databases, params.user.$id);
  const personaRole = profile?.personaRole ?? suggestedPersonaRole(context, harness.settings.defaultWorkspaceId);
  const workspace =
    context.workspaces.find((item) => item.id === harness.settings.defaultWorkspaceId) ?? context.workspaces[0];
  const project =
    context.projects.find((item) => item.id === harness.settings.defaultProjectId) ??
    context.projects.find((item) => item.workspaceId === workspace?.id) ??
    context.projects[0];

  await emit({ percent: 22, stage: "Learning your role and assigned work" });
  const snapshot = formatTrainingSnapshot(context, workspace?.id, project?.id);
  const questions = questionsForRole(personaRole);

  const answers = await pulseWhile({
    emit,
    from: 28,
    to: 62,
    stage: "Training from your workspace",
    work: () =>
      inferMissingTrainingAnswers({
        databases: params.databases,
        userId: params.user.$id,
        userName: firstName(params.user.name, params.user.email),
        personaRole,
        snapshot,
        questions,
        previous: profile?.answers,
        workspaceName: workspace?.name,
        projectName: project?.name,
        workspaceRole: workspace?.role,
      }),
  });
  const filled = trainingProgress(answers, personaRole);
  await emit({
    percent: 68,
    stage: `${filled.answered} of ${filled.total} topics drafted`,
    answered: filled.answered,
    total: filled.total,
  });

  const compiled = await pulseWhile({
    emit,
    from: 72,
    to: 90,
    stage: "Compiling your Personal Agent",
    work: () =>
      compileTrainedPersonalPrompt({
        databases: params.databases,
        userId: params.user.$id,
        userName: params.user.name || params.user.email || "this user",
        context,
        personaRole,
        jobTitle: profile?.jobTitle,
        workspaceRole: workspace?.role,
        workspaceId: workspace?.id,
        projectId: project?.id,
        answers,
      }),
  });

  await emit({ percent: 94, stage: "Saving trained profile" });
  const data = await upsertPersonalAgent(params.databases, params.user.$id, {
    personaRole,
    jobTitle: profile?.jobTitle,
    workspaceRole: workspace?.role,
    status: "trained",
    answers,
    compiledPrompt: compiled.prompt,
  });
  await emit({
    percent: 100,
    stage: "Ready",
    answered: filled.answered,
    total: filled.total,
    done: true,
  });
  return data;
}

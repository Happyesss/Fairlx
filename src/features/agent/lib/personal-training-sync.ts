import type { Databases } from "node-appwrite";

import type { AgentRun, PersonalAgentProfile, PersonalPersonaRole } from "../types";
import { upsertPersonalAgent } from "./personal-agent-store";
import {
  answersFromTrainingTranscript,
  findLatestTrainingRun,
  overlayTrainingAnswers,
  profileIsTrained,
  questionsForRole,
  trainingProgress,
} from "./personal-training";

export async function syncTrainingDraftFromRun(
  databases: Databases,
  userId: string,
  profile: PersonalAgentProfile | null,
  run: AgentRun | undefined,
  role: PersonalPersonaRole,
): Promise<PersonalAgentProfile | null> {
  if (!run || profileIsTrained(profile)) return profile;
  const questions = questionsForRole(profile?.personaRole ?? role);
  const extracted = answersFromTrainingTranscript(run.messages, questions);
  const merged = overlayTrainingAnswers(questions, profile?.answers, extracted);
  const nextProgress = trainingProgress(merged, profile?.personaRole ?? role);
  const savedProgress = trainingProgress(profile?.answers, profile?.personaRole ?? role);
  if (nextProgress.answered <= savedProgress.answered) return profile;

  return upsertPersonalAgent(databases, userId, {
    personaRole: profile?.personaRole ?? role,
    jobTitle: profile?.jobTitle,
    workspaceRole: profile?.workspaceRole,
    status: "draft",
    answers: merged,
    compiledPrompt: profile?.compiledPrompt || "",
  });
}

export async function syncTrainingDraftFromRuns(
  databases: Databases,
  userId: string,
  profile: PersonalAgentProfile | null,
  runs: AgentRun[],
  role: PersonalPersonaRole,
): Promise<PersonalAgentProfile | null> {
  return syncTrainingDraftFromRun(databases, userId, profile, findLatestTrainingRun(runs), role);
}

import type { Databases } from "node-appwrite";

import type { AgentContext, PersonalPersonaRole, PersonalTrainingAnswer, PersonalTrainingQuestion } from "../types";
import { completePlainText } from "./complete-text";
import { defaultAiStoredConfig, mergePlatformAiConfig } from "./defaults";
import {
  PERSONAL_PROMPT_COMPILER_SYSTEM,
  compilePersonalPrompt,
  compilerUserMessage,
  inferAnswersFromSnapshot,
  isFilledAnswer,
  personaLabel,
  questionsForRole,
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

const INFER_ANSWERS_SYSTEM = `You fill unanswered Personal Agent interview questions from a Fairlx workspace snapshot.
Return a JSON array of objects with questionId and answer only. No markdown.
Keep each answer 1-3 sentences, specific, and operational.
Never invent people, repos, or projects that are not in the snapshot.
If the workspace is empty or new, assume a competent professional in the given role.`;

export async function inferMissingTrainingAnswers(params: {
  databases: Databases;
  userId: string;
  userName: string;
  personaRole: PersonalPersonaRole;
  snapshot: string;
  questions?: PersonalTrainingQuestion[];
  previous?: PersonalTrainingAnswer[];
  workspaceName?: string;
  projectName?: string;
  workspaceRole?: string;
}): Promise<PersonalTrainingAnswer[]> {
  const fallback = inferAnswersFromSnapshot({
    role: params.personaRole,
    questions: params.questions,
    previous: params.previous,
    snapshot: params.snapshot,
    userName: params.userName,
    workspaceName: params.workspaceName,
    projectName: params.projectName,
    workspaceRole: params.workspaceRole,
  });
  const questions = params.questions ?? questionsForRole(params.personaRole);
  const missing = questions.filter((question) => {
    const existing = params.previous?.find((item) => item.questionId === question.id);
    return !isFilledAnswer(existing?.answer);
  });
  if (!missing.length) return fallback;

  try {
    const aiDoc = await getAiDocument(params.databases, params.userId);
    const stored = mergePlatformAiConfig(aiDoc ? parseAiConfig(aiDoc) : defaultAiStoredConfig());
    const raw = await completePlainText({
      stored,
      system: INFER_ANSWERS_SYSTEM,
      user: [
        `User: ${params.userName}`,
        `Role: ${personaLabel(params.personaRole)}`,
        params.workspaceRole ? `Workspace role: ${params.workspaceRole}` : "",
        params.workspaceName ? `Workspace: ${params.workspaceName}` : "",
        params.projectName ? `Project: ${params.projectName}` : "",
        "",
        "Snapshot:",
        params.snapshot,
        "",
        "Unanswered questions:",
        missing.map((question) => `${question.id}: ${question.prompt}`).join("\n"),
      ]
        .filter((line) => line !== "")
        .join("\n"),
      maxTokens: 2500,
    });
    const parsed = parseInferredAnswers(raw);
    if (!parsed.length) return fallback;
    return inferAnswersFromSnapshot({
      role: params.personaRole,
      questions,
      previous: [
        ...(params.previous ?? []),
        ...parsed.map((item) => ({
          questionId: item.questionId,
          question: missing.find((question) => question.id === item.questionId)?.prompt || item.questionId,
          answer: item.answer,
          source: "inferred" as const,
        })),
      ],
      snapshot: params.snapshot,
      userName: params.userName,
      workspaceName: params.workspaceName,
      projectName: params.projectName,
      workspaceRole: params.workspaceRole,
    });
  } catch (error) {
    console.error("[personal-agent] infer answers via model failed, using templates", error);
    return fallback;
  }
}

function parseInferredAnswers(raw: string): Array<{ questionId: string; answer: string }> {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start < 0 || end <= start) return [];
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
        return {
          questionId: String(row.questionId ?? "").trim(),
          answer: String(row.answer ?? "").trim(),
        };
      })
      .filter((item) => item.questionId && item.answer.length >= 8);
  } catch {
    return [];
  }
}

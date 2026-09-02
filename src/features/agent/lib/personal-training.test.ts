import { describe, expect, it } from "vitest";

import {
  compilePersonalPrompt,
  mergeAnswers,
  questionsForRole,
  requiredAnswersMissing,
  suggestedPersonaRole,
  trainingKickoffPrompt,
  isTrainingRun,
  buildTrainingInterviewPrompt,
  formatInterviewAgenda,
  TRAIN_PERSONAL_MARKER,
} from "./personal-training";
import type { AgentContext, PersonalTrainingAnswer } from "../types";

function context(): AgentContext {
  return {
    user: { id: "u1", name: "Ada", email: "ada@fairlx.dev" },
    workspaces: [{ id: "w1", name: "Acme", role: "ADMIN" }],
    projects: [{ id: "p1", name: "Website", workspaceId: "w1", key: "WEB" }],
    workItems: [],
    notifications: [],
    githubRepos: [],
    integrations: [],
    docs: [],
  };
}

function filled(role: "tech_lead" | "frontend" | "qa" | "pm"): PersonalTrainingAnswer[] {
  return questionsForRole(role).map((question) => ({
    questionId: question.id,
    question: question.prompt,
    answer: `Detailed answer for ${question.id}: I own this specifically and I never skip the quality bar.`,
  }));
}

describe("personal agent training", () => {
  it("suggests tech lead from admin membership and asks role-specific questions first", () => {
    expect(suggestedPersonaRole(context())).toBe("tech_lead");
    const questions = questionsForRole("tech_lead");
    expect(questions[0]?.id).toBe("tl_team");
    expect(questions.some((item) => item.id === "never_do")).toBe(true);
    expect(questions.length).toBeGreaterThanOrEqual(12);
  });

  it("compiles a detailed standing prompt from answers", () => {
    const prompt = compilePersonalPrompt({
      userName: "Ada",
      personaRole: "frontend",
      jobTitle: "Staff frontend",
      workspaceRole: "MEMBER",
      workspaceName: "Acme",
      projectName: "Website",
      answers: filled("frontend"),
    });
    expect(prompt).toContain("Ada's Fairlx Personal Agent");
    expect(prompt).toContain("Staff frontend");
    expect(prompt).toContain("## Identity and role");
    expect(prompt).toContain("## Training interview (verbatim)");
    expect(prompt).toContain("never_do");
    expect(prompt.length).toBeGreaterThan(800);
  });

  it("flags short required answers", () => {
    const questions = questionsForRole("qa");
    const answers = mergeAnswers(questions, undefined, [{ questionId: "qa_strategy", answer: "ok" }]);
    expect(requiredAnswersMissing(answers, questions).length).toBeGreaterThan(5);
  });

  it("detects training runs from kind or the kickoff marker", () => {
    expect(isTrainingRun({ kind: "training", prompt: "anything" })).toBe(true);
    expect(isTrainingRun({ kind: "chat", prompt: trainingKickoffPrompt() })).toBe(true);
    expect(isTrainingRun({ prompt: `${TRAIN_PERSONAL_MARKER}\nRetrain me` })).toBe(true);
    expect(isTrainingRun({ kind: "chat", prompt: "Plan a feature for checkout" })).toBe(false);
    expect(trainingKickoffPrompt()).toBe(TRAIN_PERSONAL_MARKER);
  });

  it("builds a one-question-at-a-time interview prompt covering the agenda", () => {
    const prompt = buildTrainingInterviewPrompt({
      userName: "Ada",
      personaRole: "tech_lead",
      workspaceRole: "ADMIN",
      workspaceName: "Acme",
    });
    expect(prompt).toContain("Open with \"Hi Ada,\"");
    expect(prompt).toContain("[[choices]]");
    expect(prompt).toContain("custom answer");
    expect(prompt).toContain("Fairlx snapshot");
    expect(prompt).toContain("save_personal_agent");
    expect(prompt).toContain("Describe your team");
    expect(prompt).not.toContain("You are the Fairlx Personal Agent, the user's Chief of Staff");
    expect(formatInterviewAgenda("tech_lead")).toContain("Describe your team");
  });
});

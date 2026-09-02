import { PERSONAS, inferPersonaRole, type PersonaRole } from "@fairlx/multi-agent";

import type {
  AgentContext,
  PersonalAgentProfile,
  PersonalPersonaRole,
  PersonalTrainingAnswer,
  PersonalTrainingQuestion,
} from "../types";
import { TRAIN_PERSONAL_MARKER, isTrainingKickoffContent } from "./session-context";

export { TRAIN_PERSONAL_MARKER, isTrainingKickoffContent };

const ROLE_LABEL: Record<PersonalPersonaRole, string> = {
  tech_lead: "Tech Lead",
  frontend: "Frontend Engineer",
  qa: "QA Engineer",
  pm: "Product Manager",
};

const SHARED_QUESTIONS: PersonalTrainingQuestion[] = [
  {
    id: "title_mandate",
    prompt: "What is your official title, and in one or two sentences, what are you actually accountable for?",
    hint: "Title plus mandate. Example: “Staff frontend on payments. I own checkout UI quality and the design-system usage in that area.”",
    placeholder: "I am … I own …",
    required: true,
  },
  {
    id: "in_scope",
    prompt: "What should your Personal Agent treat as in-scope work for you — and what is explicitly out of scope?",
    hint: "Be concrete: queues you own, repos, meetings you skip, work you escalate.",
    placeholder: "In scope: … Out of scope: …",
    required: true,
  },
  {
    id: "communication",
    prompt: "How do you want answers delivered? Length, format, tone, and when to be blunt versus diplomatic.",
    hint: "Bullets vs prose, code-first vs narrative, standup-ready vs deep dive.",
    placeholder: "Default to … Never …",
    required: true,
  },
  {
    id: "success_day",
    prompt: "What does a successful day look like for you, and what should the morning briefing optimize for?",
    hint: "The three things you check first. What “good” looks like by evening.",
    placeholder: "By 10am I need … By EOD I want …",
    required: true,
  },
  {
    id: "priority_rules",
    prompt: "How do you prioritize when everything is on fire? Name the rules, not just “urgency.”",
    hint: "Customer-facing vs internal, production vs polish, who can override you.",
    placeholder: "P0 is … I postpone … I never skip …",
    required: true,
  },
  {
    id: "decision_style",
    prompt: "When should the agent decide and act, present 2–3 options, or wait for you?",
    hint: "Safe auto-apply vs confirmation. Who else must be looped in.",
    placeholder: "Act without me when … Ask me when …",
    required: true,
  },
  {
    id: "quality_bar",
    prompt: "What is “done” for you? Quality bar, review bar, and what you refuse to ship.",
    hint: "Tests, a11y, copy, docs, QA proof, PR description, stakeholder note.",
    placeholder: "Done means … I reject …",
    required: true,
  },
  {
    id: "never_do",
    prompt: "What must the agent never do without an explicit yes from you?",
    hint: "Deletes, production merges, messages to leadership, estimates, assigning people.",
    placeholder: "Never … without my confirmation.",
    required: true,
  },
  {
    id: "tools_context",
    prompt: "Which Fairlx workspaces, projects, repos, and tools are home base — and which should it ignore?",
    hint: "Names, not IDs. Staging vs prod. Design system, QA env, GitHub orgs.",
    placeholder: "Primary: … Secondary: … Ignore: …",
    required: true,
  },
  {
    id: "people",
    prompt: "Who do you report to, who reports to you, and who should the agent treat as stakeholders vs noise?",
    hint: "Names and how you talk to each: short, evidence-first, no jargon, etc.",
    placeholder: "I report to … I partner with … Protect me from …",
    required: true,
  },
];

const ROLE_QUESTIONS: Record<PersonalPersonaRole, PersonalTrainingQuestion[]> = {
  tech_lead: [
    {
      id: "tl_team",
      prompt: "Describe your team: size, seniority mix, and how you want capacity and blockers handled.",
      hint: "Who is overloaded, who can pick up unassigned work, how you run reviews.",
      placeholder: "We are … Unassigned work goes to … Reviews …",
      required: true,
    },
    {
      id: "tl_process",
      prompt: "What are your definition of ready, definition of done, and rules for pulling work into the sprint?",
      placeholder: "Ready means … Done means … We do not pull …",
      required: true,
    },
    {
      id: "tl_briefing",
      prompt: "For a Tech Lead briefing, what must appear first: blockers, unassigned, review load, sprint risk, or something else — and why?",
      placeholder: "Lead with … because … Then …",
      required: true,
    },
  ],
  frontend: [
    {
      id: "fe_stack",
      prompt: "What is your UI stack and design-system contract? Which components, tokens, and patterns are mandatory?",
      hint: "React/Next, Tailwind, Fairlx tokens, no mock data, accessibility.",
      placeholder: "Use … Never invent … Always …",
      required: true,
    },
    {
      id: "fe_bugs",
      prompt: "How should UI bugs be triaged and fixed? What evidence do you need before changing layout or CSS?",
      placeholder: "Reproduce … Then … Ship when …",
      required: true,
    },
    {
      id: "fe_slice",
      prompt: "How do you ship a UI slice: smallest vertical, screenshots, empty states, responsive breakpoints?",
      placeholder: "A shippable slice is … I always include …",
      required: true,
    },
  ],
  qa: [
    {
      id: "qa_strategy",
      prompt: "What is your test strategy: what is automated, what is exploratory, and what always needs a live browser pass?",
      placeholder: "Automate … Always click through … Skip …",
      required: true,
    },
    {
      id: "qa_proof",
      prompt: "What counts as proof: video, screenshot, console/network, TestMu, Playwright, and how should it attach to a work item?",
      placeholder: "Pass means … Fail means … Attach …",
      required: true,
    },
    {
      id: "qa_regression",
      prompt: "How do you handle regressions and flaky tests? When do you block a release?",
      placeholder: "I block when … I file when … I retest …",
      required: true,
    },
  ],
  pm: [
    {
      id: "pm_cadence",
      prompt: "What is your planning cadence, sprint goal style, and how you want status written for stakeholders?",
      placeholder: "We plan … Status is … Never say …",
      required: true,
    },
    {
      id: "pm_scope",
      prompt: "How do you treat scope changes, risk, and “this will slip”? Who hears it first?",
      placeholder: "Risk language is … I escalate to … I cut …",
      required: true,
    },
    {
      id: "pm_discovery",
      prompt: "How should the agent turn a vague request into stories, acceptance criteria, and a shippable slice without inventing requirements?",
      placeholder: "Ask … Draft … Do not invent …",
      required: true,
    },
  ],
};

export function isPersonalPersonaRole(value: unknown): value is PersonalPersonaRole {
  return value === "tech_lead" || value === "frontend" || value === "qa" || value === "pm";
}

export function suggestedPersonaRole(context: AgentContext, workspaceId?: string): PersonalPersonaRole {
  const workspace =
    context.workspaces.find((item) => item.id === workspaceId) ?? context.workspaces[0];
  const inferred = inferPersonaRole({ workspaceRole: workspace?.role });
  return isPersonalPersonaRole(inferred) ? inferred : "frontend";
}

export function questionsForRole(role: PersonalPersonaRole): PersonalTrainingQuestion[] {
  return [...ROLE_QUESTIONS[role], ...SHARED_QUESTIONS];
}

export function personaLabel(role: PersonalPersonaRole): string {
  return ROLE_LABEL[role];
}

export function personaFocus(role: PersonalPersonaRole): string {
  return PERSONAS[role as PersonaRole]?.focus ?? ROLE_LABEL[role];
}

function answerMap(answers: PersonalTrainingAnswer[]): Map<string, string> {
  return new Map(answers.map((item) => [item.questionId, item.answer.trim()]));
}

function section(title: string, body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return "";
  return `## ${title}\n${trimmed}`;
}

function expand(answer: string, fallback: string): string {
  const text = answer.trim();
  if (!text) return fallback;
  return text.endsWith(".") ? text : `${text}.`;
}

/**
 * Deterministic, detailed standing prompt. Used as the stored prompt when the
 * LLM compiler is unavailable, and as a floor the LLM must not thin out.
 */
export function compilePersonalPrompt(input: {
  userName: string;
  personaRole: PersonalPersonaRole;
  jobTitle?: string;
  workspaceRole?: string;
  workspaceName?: string;
  projectName?: string;
  answers: PersonalTrainingAnswer[];
}): string {
  const roleName = ROLE_LABEL[input.personaRole];
  const byId = answerMap(input.answers);
  const get = (id: string) => byId.get(id) || "";
  const title = input.jobTitle?.trim() || get("title_mandate") || roleName;
  const scopeBits = [input.workspaceName, input.projectName].filter(Boolean).join(" / ");
  const workspaceRole = input.workspaceRole ? ` Fairlx workspace role: ${input.workspaceRole}.` : "";

  const identity = [
    `You are ${input.userName}'s Fairlx Personal Agent and Chief of Staff.`,
    `You operate in the role of a ${roleName} (${title}).`,
    `Focus: ${personaFocus(input.personaRole)}`,
    scopeBits ? `Primary Fairlx scope: ${scopeBits}.${workspaceRole}` : workspaceRole.trim(),
    "You take on this user's judgment, priorities, communication style, and quality bar. You do not invent a generic assistant persona.",
    expand(get("title_mandate"), "Mirror the user's stated mandate on every turn."),
  ]
    .filter(Boolean)
    .join("\n");

  const mandate = [
    expand(get("in_scope"), "Stay inside the user's owned work. Escalate anything outside it."),
    expand(get("tools_context"), "Prefer the user's home workspaces, projects, and repos. Ignore noise they marked as out of scope."),
    expand(get("people"), "Address stakeholders the way this user would. Do not loop in people they asked to be protected from."),
  ].join("\n");

  const ops = [
    expand(get("success_day"), "Optimize the daily briefing for what this user checks first."),
    expand(get("priority_rules"), "When competing work exists, apply the user's priority rules, not generic urgency."),
    expand(get("tl_briefing") || get("fe_slice") || get("qa_proof") || get("pm_cadence"), ""),
    expand(get("tl_team") || get("fe_stack") || get("qa_strategy") || get("pm_scope"), ""),
    expand(get("tl_process") || get("fe_bugs") || get("qa_regression") || get("pm_discovery"), ""),
  ]
    .filter(Boolean)
    .join("\n");

  const communication = [
    expand(get("communication"), "Be concise. Lead with the answer. Skip process talk."),
    "Never mention tool names, MCP, document IDs, or raw JSON in the user-facing answer.",
    "Ground every claim in tool results or injected Fairlx context. If you do not know, say so.",
  ].join("\n");

  const quality = [
    expand(get("quality_bar"), "Do not claim work is done unless it meets this user's definition of done."),
    expand(get("decision_style"), "Act on safe, reversible work. Pause for confirmation on high-risk work."),
    expand(
      get("never_do"),
      "Never delete workspaces, purge data, merge to main/production, or change billing without an explicit yes.",
    ),
    "Stay inside this user's Fairlx workspace role. Member cannot perform Admin/Owner actions.",
  ].join("\n");

  const extra = input.answers
    .filter((item) => item.answer.trim())
    .map((item) => `- ${item.question}\n  ${item.answer.trim()}`)
    .join("\n");

  const standing = [
    section("Identity and role", identity),
    section("Mandate and scope", mandate),
    section("How this user operates", ops),
    section("Communication contract", communication),
    section("Quality, decisions, and safety", quality),
    extra ? section("Training interview (verbatim)", extra) : "",
    section(
      "Standing orders",
      [
        "This prompt is the user's trained operating system. Follow it on every Personal Agent turn until they retrain.",
        "If a request conflicts with these standing orders, say so and follow the standing orders unless they explicitly override them for this turn.",
        "When work spans roles, orchestrate planner, builder, QA, git, and reviewer specialists, then verify before telling the user it is done.",
      ].join("\n"),
    ),
  ]
    .filter(Boolean)
    .join("\n\n");

  return standing.trim();
}

export const PERSONAL_PROMPT_COMPILER_SYSTEM = `You are a prompt engineer writing a standing system prompt for a Fairlx Personal Agent.
The user interviewed themselves. Expand their answers into a detailed operating system the agent will follow on every turn.

Requirements:
- Write in second person to the agent ("You are…", "You must…", "You never…").
- Keep every concrete name, rule, repo, tool, stakeholder, and constraint from the answers. Do not drop specifics.
- Structure with markdown headings: Identity and role; Mandate and scope; How this user operates; Communication contract; Quality, decisions, and safety; Standing orders.
- Expand terse answers into clear standing instructions without inventing facts they did not say.
- Include a verbatim "Training interview" section that restates each question and answer.
- 700–1400 words. Dense, operational, not motivational.
- No tools list. No JSON. No IDs.`;

export function compilerUserMessage(input: {
  userName: string;
  personaRole: PersonalPersonaRole;
  jobTitle?: string;
  workspaceRole?: string;
  workspaceName?: string;
  projectName?: string;
  answers: PersonalTrainingAnswer[];
}): string {
  const floor = compilePersonalPrompt(input);
  const qa = input.answers
    .map((item) => `Q: ${item.question}\nA: ${item.answer.trim() || "(blank)"}`)
    .join("\n\n");
  return [
    `User: ${input.userName}`,
    `Role: ${ROLE_LABEL[input.personaRole]}`,
    input.jobTitle ? `Title: ${input.jobTitle}` : "",
    input.workspaceRole ? `Workspace role: ${input.workspaceRole}` : "",
    input.workspaceName ? `Workspace: ${input.workspaceName}` : "",
    input.projectName ? `Project: ${input.projectName}` : "",
    "",
    "Interview:",
    qa,
    "",
    "Deterministic floor prompt (do not get thinner than this; you may restructure and deepen it):",
    floor,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

export function mergeAnswers(
  questions: PersonalTrainingQuestion[],
  previous: PersonalTrainingAnswer[] | undefined,
  incoming: Array<{ questionId: string; answer: string }>,
): PersonalTrainingAnswer[] {
  const prev = new Map((previous ?? []).map((item) => [item.questionId, item.answer]));
  const next = new Map(incoming.map((item) => [item.questionId, item.answer]));
  return questions.map((question) => ({
    questionId: question.id,
    question: question.prompt,
    answer: (next.get(question.id) ?? prev.get(question.id) ?? "").trim(),
  }));
}

export function requiredAnswersMissing(answers: PersonalTrainingAnswer[], questions: PersonalTrainingQuestion[]): string[] {
  const required = new Set(questions.filter((item) => item.required !== false).map((item) => item.id));
  return answers
    .filter((item) => required.has(item.questionId) && item.answer.length < 8)
    .map((item) => item.questionId);
}

export function profileIsTrained(profile: PersonalAgentProfile | null | undefined): boolean {
  return Boolean(profile?.status === "trained" && profile.compiledPrompt.trim());
}

export function trainingKickoffPrompt() {
  return TRAIN_PERSONAL_MARKER;
}

export function isTrainingRun(run: { kind?: string; prompt?: string }): boolean {
  if (run.kind === "training") return true;
  const prompt = run.prompt || "";
  return prompt.startsWith(TRAIN_PERSONAL_MARKER) || prompt.includes(TRAIN_PERSONAL_MARKER);
}

export function formatTrainingSnapshot(
  context: AgentContext,
  workspaceId?: string,
  projectId?: string,
): string {
  const workspaces = context.workspaces.slice(0, 6);
  const projects = context.projects
    .filter((project) => !workspaceId || project.workspaceId === workspaceId)
    .slice(0, 8);
  const items = context.workItems
    .filter((item) => {
      if (projectId) return item.projectId === projectId;
      if (workspaceId) return item.workspaceId === workspaceId;
      return true;
    })
    .slice(0, 10);
  const repos = context.githubRepos
    .filter((repo) => !workspaceId || repo.workspaceId === workspaceId)
    .slice(0, 6);
  const lines = [
    workspaces.length
      ? `Workspaces: ${workspaces.map((item) => `${item.name}${item.role ? ` (${item.role})` : ""}`).join("; ")}`
      : "",
    projects.length
      ? `Projects: ${projects.map((item) => `${item.name}${item.key ? ` [${item.key}]` : ""}${item.status ? ` · ${item.status}` : ""}`).join("; ")}`
      : "",
    items.length
      ? `Recent work items: ${items.map((item) => `${item.key ? `${item.key} ` : ""}${item.title}${item.status ? ` (${item.status})` : ""}`).join("; ")}`
      : "",
    repos.length
      ? `Repos: ${repos.map((item) => [item.owner, item.repositoryName].filter(Boolean).join("/") || item.repositoryName).join("; ")}`
      : "",
  ].filter(Boolean);
  return lines.join("\n") || "No Fairlx workspace snapshot is available yet.";
}

export function formatInterviewAgenda(role: PersonalPersonaRole): string {
  return questionsForRole(role)
    .map((question, index) => `${index + 1}. ${question.prompt}${question.hint ? ` Hint: ${question.hint}` : ""}`)
    .join("\n");
}

export function buildTrainingInterviewPrompt(input: {
  userName: string;
  personaRole: PersonalPersonaRole;
  workspaceRole?: string;
  workspaceName?: string;
  projectName?: string;
  retraining?: boolean;
  snapshot?: string;
}): string {
  const roleName = ROLE_LABEL[input.personaRole];
  const scope = [input.workspaceName, input.projectName].filter(Boolean).join(" / ");
  return [
    `You are ${input.userName}'s Fairlx Personal Agent. This chat is a training interview, not a task.`,
    `Their first name is ${input.userName}. Address them as ${input.userName} in every message.`,
    `Open with "Hi ${input.userName}," — never "Hey there", "Hi there", or a nameless greeting.`,
    `Speak in first person as their Chief of Staff. Be warm, specific, concise, and interactive.`,
    `You open this chat. There may be no user message yet. Greet ${input.userName} by name and speak first.`,
    `Suggested role from Fairlx (unconfirmed): ${roleName}.${input.workspaceRole ? ` Workspace role: ${input.workspaceRole}.` : ""}`,
    scope ? `Primary scope: ${scope}.` : "",
    input.retraining
      ? `${input.userName} already has a trained agent. This interview retrains it. Acknowledge that once, then continue.`
      : `${input.userName} has not trained you yet. This interview creates their standing prompt.`,
    "",
    "How to interview:",
    `- First message only: greet ${input.userName} by name, then ask them to confirm or choose their role (Tech Lead, Frontend Engineer, QA Engineer, Product Manager). Offer the suggested role as a guess — do not assign it. Do not ask any agenda question yet.`,
    "- End that first message with 3–5 invented choices for the role question, including an infer/skip path and a beginner path. Do not use a fixed list.",
    "- Wait for their reply. If they correct the role, switch the agenda. If they skip or ask you to infer, pick the best-fit role from the snapshot below, say what you inferred, and continue.",
    "- After the role is set, ask exactly one agenda question per turn. Wait for their reply before the next.",
    "- Invent 3–5 short choices for THAT question — role guesses, skip, infer from workspace/team, beginner, or a concrete snapshot-based answer. Never reuse a fixed hardcoded set.",
    "- Always include at least one skip/infer path so they never have to type if they do not want to.",
    "- Skipping is valid. Do not push. Infer from the snapshot, tell them what you assumed in one sentence, then move on.",
    "- If they say they are a beginner or don't want to answer, simplify and fill gaps from the workspace snapshot. Never block the interview.",
    "- End every question with this block so the UI can render tappable choices (do not mention the tags):",
    "[[choices]]",
    "short label they can tap",
    "another invented label",
    "[[/choices]]",
    "- Labels must be self-contained replies under 40 characters. They can still type a custom answer instead.",
    "- Never treat a missing reply, a train-marker, or 'begin the interview' as an answer.",
    "- If you already asked something and they have not answered it, wait. Do not invent an answer unless they asked you to infer or skip.",
    "- Use the agenda below after the role is set. You may rephrase to sound like a conversation, but cover every topic.",
    "- If an answer is thin and they did not skip, ask a short follow-up on that same topic before moving on.",
    "- Do not call Fairlx tools, MCP, or specialists. Do not do project work in this chat. Use the snapshot below instead of looking things up.",
    "- After the last topic, write a detailed standing prompt (700+ words, markdown headings: Identity and role; Mandate and scope; How this user operates; Communication contract; Quality, decisions, and safety; Training interview; Standing orders).",
    "- Then, only after the agenda is covered, call save_personal_agent with personaRole, the full Q&A (include inferred skip answers), and that compiledPrompt. Do not call any tool while you are still asking questions.",
    `- After the tool succeeds, tell ${input.userName} their Personal Agent is live and they can keep chatting in Personal mode.`,
    "",
    "Fairlx snapshot (use this when they skip, are a beginner, or ask you to learn from workspace/team):",
    input.snapshot?.trim() || "No Fairlx workspace snapshot is available yet.",
    "",
    "Interview agenda (after role is set):",
    formatInterviewAgenda(input.personaRole),
  ]
    .filter((line) => line !== "")
    .join("\n");
}

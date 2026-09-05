import { describe, expect, it } from "vitest";

import {
  attachedSearchPayload,
  buildSpecialistUserMessage,
  extractAttachedFiles,
  formatAttachedFiles,
  matchSubject,
  splitMarkdownSubjects,
  stripAttachedFiles,
  withAttachedFiles,
} from "./attachments";

const spec = `# Overview
Intro.

## Conversation
Chat and voice.

## Analytics
Dashboards.
`;

describe("attached files", () => {
  it("round-trips fenced file bodies", () => {
    const packed = formatAttachedFiles([{ name: "spec.md", body: spec }]);
    expect(extractAttachedFiles(packed)).toEqual([{ name: "spec.md", body: spec.trimEnd() }]);
    expect(stripAttachedFiles(`${packed}\n\nPlan the module.`)).toBe("Plan the module.");
  });

  it("splits markdown subjects and matches a module heading", () => {
    const subjects = splitMarkdownSubjects(spec, "spec.md");
    expect(subjects.map((item) => item.title)).toEqual(["Overview", "Conversation", "Analytics"]);
    expect(matchSubject(subjects, "analytics dashboard")?.title).toBe("Analytics");
  });

  it("returns attached spec content instead of an empty harness search", () => {
    const files = [{ name: "School Stacker spec.md", body: spec }];
    const payload = attachedSearchPayload("School Stacker AI Student Companion Product Feature", files);
    expect(payload?.source).toBe("attached_files");
    expect(JSON.stringify(payload)).toContain("Conversation");
  });

  it("gives a subject specialist only that heading", () => {
    const parent = `${formatAttachedFiles([{ name: "spec.md", body: spec }])}\n\nPlan everything.`;
    const message = buildSpecialistUserMessage({
      task: "Create stories for analytics.",
      parentPrompt: parent,
      subject: "Analytics",
    });
    expect(message).toContain("Dashboards");
    expect(message).not.toContain("Chat and voice");
    expect(message).toContain("Subject for this sub-agent: Analytics");
  });

  it("rehydrates truncated chat text from stored attachments", () => {
    const hydrated = withAttachedFiles("Plan the module.", [{ name: "spec.md", body: spec }]);
    expect(extractAttachedFiles(hydrated)[0]?.body).toContain("Conversation");
    expect(stripAttachedFiles(hydrated)).toBe("Plan the module.");
  });
});

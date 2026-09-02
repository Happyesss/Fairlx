import { describe, expect, it } from "vitest";

import { splitAssistantChoices } from "./assistant-choices";

describe("splitAssistantChoices", () => {
  it("reads AI-designed choices from a fence and strips them from the message", () => {
    const parsed = splitAssistantChoices(
      [
        "Hi Ada, does Tech Lead sound right?",
        "",
        "[[choices]]",
        "Yes, Tech Lead",
        "Frontend Engineer",
        "Infer from my workspace",
        "I'm newer to this",
        "[[/choices]]",
      ].join("\n"),
    );
    expect(parsed.text).toBe("Hi Ada, does Tech Lead sound right?");
    expect(parsed.choices).toEqual([
      "Yes, Tech Lead",
      "Frontend Engineer",
      "Infer from my workspace",
      "I'm newer to this",
    ]);
  });

  it("falls back to a trailing Options list", () => {
    const parsed = splitAssistantChoices(
      "What should mornings optimize for?\n\nOptions:\n- Unblock the team\n- Ship one slice\n- Skip — infer from my workspace",
    );
    expect(parsed.text).toBe("What should mornings optimize for?");
    expect(parsed.choices).toEqual(["Unblock the team", "Ship one slice", "Skip — infer from my workspace"]);
  });

  it("returns the original text when the model did not offer choices", () => {
    expect(splitAssistantChoices("Just a note.")).toEqual({ text: "Just a note.", choices: [] });
  });
});

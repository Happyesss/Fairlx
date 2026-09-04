import { describe, expect, it } from "vitest";

import { compressMessages } from "./compress";
import { wantedToolNames, selectToolsForTurn } from "./select";
import { factsFromTurn, mergeStateKnowledge } from "./write";
import { filterToolsForSpecialist } from "./isolate";
import type { AgentChatMessage } from "../../types";
import type { SelectableTool } from "./select";

function tool(name: string): SelectableTool {
  return { type: "function", function: { name, description: name, parameters: { type: "object", properties: {} } } };
}

describe("selectToolsForTurn", () => {
  it("keeps mail tools for send-mail prompts and drops unrelated catalog noise", () => {
    const tools = [
      tool("mail_send"),
      tool("fairlx_work_item_get"),
      tool("github_open_pr"),
      tool("security_review"),
      tool("delegate_agent"),
      tool("fairlx_sprint_delete"),
    ];
    const selected = selectToolsForTurn(tools, "Send a mail about WEB-12 to the client");
    const names = selected.map((item) => item.function.name);
    expect(names).toContain("mail_send");
    expect(names).toContain("delegate_agent");
    expect(wantedToolNames("Send a mail about WEB-12").has("mail_send")).toBe(true);
  });

  it("keeps GitHub write tools for PR prompts", () => {
    const names = wantedToolNames("open a pull request for the login fix");
    expect(names.has("github_open_pr")).toBe(true);
    expect(names.has("github_write_file")).toBe(true);
  });
});

describe("compressMessages", () => {
  it("compresses old tool results and keeps recent ones", () => {
    const messages: AgentChatMessage[] = Array.from({ length: 12 }, (_, index) => ({
      id: String(index),
      role: index % 2 === 0 ? "user" : "tool",
      content: index % 2 === 0 ? "hi" : JSON.stringify({ items: [1, 2, 3], title: "x" }),
      toolCallId: index % 2 ? `c${index}` : undefined,
      toolName: index % 2 ? "fairlx_work_item_list" : undefined,
      createdAt: new Date().toISOString(),
    }));
    const compressed = compressMessages(messages);
    const oldTool = compressed[1];
    const recentTool = compressed[compressed.length - 1];
    expect(oldTool?.content).toContain("compressed");
    expect(recentTool?.content).toContain("items");
  });
});

describe("isolate", () => {
  it("gives git specialists github tools and strips delegate_agent", () => {
    const filtered = filterToolsForSpecialist(
      [tool("delegate_agent"), tool("github_read_file"), tool("mail_send"), tool("git_status")],
      "git",
    );
    const names = filtered.map((item) => item.function.name);
    expect(names).toContain("github_read_file");
    expect(names).toContain("git_status");
    expect(names).not.toContain("delegate_agent");
    expect(names).not.toContain("mail_send");
  });

  it("gives builder GitHub write tools and not mail", () => {
    const filtered = filterToolsForSpecialist(
      [tool("delegate_agent"), tool("github_write_file"), tool("github_open_pr"), tool("mail_send")],
      "builder",
    );
    const names = filtered.map((item) => item.function.name);
    expect(names).toContain("github_write_file");
    expect(names).toContain("github_open_pr");
    expect(names).not.toContain("mail_send");
    expect(names).not.toContain("delegate_agent");
  });
});

describe("write facts", () => {
  it("merges STATE knowledge from tool outcomes", () => {
    const facts = factsFromTurn([
      {
        id: "t1",
        role: "tool",
        toolName: "mail_send",
        content: JSON.stringify({ sent: true, to: "ada@x.com" }),
        createdAt: new Date().toISOString(),
      },
    ]);
    expect(facts.some((fact) => /Mail sent/.test(fact))).toBe(true);
    const knowledge = mergeStateKnowledge([], facts);
    expect(knowledge[0]?.title).toBe("Agent STATE");
  });
});

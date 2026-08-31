import type { Databases } from "node-appwrite";

import { GROK_46_MODEL_ID } from "../constants";
import type {
  AgentAiConfigStored,
  AgentChatMessage,
  AgentContext,
  AgentHarness,
  AgentRun,
  AgentToolCall,
} from "../types";
import { loadAgentContext } from "./context";
import { getOrCreateHarness } from "./harness";
import { getPlatformProviderCredentials, overlayPlatformModel } from "./platform-credentials";
import { getAiDocument, getMcpDocument, parseAiConfig, parseMcpConfig } from "./store";
import { AgentEncryptionRequiredError, decryptSecret } from "./secrets";
import { executeTool, openaiToolsForMode } from "./tools";
import { updateRun } from "./runs";

const MAX_TOOL_ITERATIONS = 8;
const MAX_HISTORY = 24;
const CHAT_TIMEOUT_MS = 60_000;

export type ChatTarget = {
  url: string;
  headers: Record<string, string>;
  model: string;
  modelId: string;
};

function joinUrl(base: string, path: string): string {
  const trimmedBase = base.replace(/\/+$/, "");
  const trimmedPath = path.startsWith("/") ? path : `/${path}`;
  return `${trimmedBase}${trimmedPath}`;
}

function defaultByokBase(provider: string): string {
  switch (provider) {
    case "openai":
      return "https://api.openai.com/v1";
    case "openrouter":
      return "https://openrouter.ai/api/v1";
    case "xai":
      return "https://api.x.ai/v1";
    case "ollama":
      return "http://localhost:11434/v1";
    case "google":
      return "https://generativelanguage.googleapis.com/v1beta/openai";
    default:
      return "";
  }
}

export function resolveChatTarget(stored: AgentAiConfigStored): ChatTarget {
  const models = stored.models.map(overlayPlatformModel);
  const selectedId =
    stored.mode === "auto" || !stored.selectedModelId ? GROK_46_MODEL_ID : stored.selectedModelId;
  const model =
    models.find((item) => item.id === selectedId && item.isEnabled) ??
    models.find((item) => item.id === GROK_46_MODEL_ID) ??
    models[0];
  if (!model) throw new Error("No AI model is configured.");
  const provider = stored.providers.find((item) => item.id === model.providerId);
  if (!provider) throw new Error("Selected model has no provider.");

  if (provider.isPlatform) {
    const creds = getPlatformProviderCredentials(provider.id);
    if (!creds) {
      throw new Error(`Platform credentials are not configured for ${provider.displayName}.`);
    }
    return {
      url: joinUrl(creds.baseUrl, `${creds.openaiPath}/chat/completions`),
      headers: {
        "Content-Type": "application/json",
        [creds.authHeader]: creds.apiKey,
      },
      model: creds.deployment || model.modelId,
      modelId: model.id,
    };
  }

  const apiKey = provider.apiKeyEncrypted ? decryptSecret(provider.apiKeyEncrypted) : "";
  if (!apiKey) {
    throw new Error(`Add an API key for ${provider.displayName} to use this model.`);
  }
  const baseUrl = (provider.baseUrl || defaultByokBase(provider.provider)).replace(/\/+$/, "");
  if (!baseUrl) {
    throw new Error(`Set a base URL for ${provider.displayName}.`);
  }
  return {
    url: joinUrl(baseUrl, "/chat/completions"),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    model: model.modelId,
    modelId: model.id,
  };
}

function buildSystemPrompt(params: {
  harness: AgentHarness;
  context: AgentContext;
  run: AgentRun;
}): string {
  const { harness, context, run } = params;
  const enabledSkills = harness.skills.filter((skill) => skill.enabled);
  const enabledPatterns = harness.workPatterns.filter((pattern) => pattern.enabled);
  const workspace =
    context.workspaces.find((item) => item.id === run.workspaceId) ??
    context.workspaces.find((item) => item.id === harness.settings.defaultWorkspaceId) ??
    context.workspaces[0];
  const project =
    context.projects.find((item) => item.id === run.projectId) ??
    context.projects.find((item) => item.id === harness.settings.defaultProjectId);

  const lines = [
    "You are the Fairlx Agent harness. Help the user plan, inspect, and ship work across Fairlx workspaces, projects, and work items.",
    `Mode: ${run.mode === "agent" ? "Agent (tools enabled)" : "Manual (chat only, no tools)"}.`,
    `User: ${context.user.name} <${context.user.email}>.`,
    workspace ? `Current workspace: ${workspace.name} (${workspace.id}).` : "No workspace selected.",
    project ? `Current project: ${project.name} (${project.id}).` : "No project selected.",
    context.workspaces.length
      ? `Workspaces: ${context.workspaces.map((item) => `${item.name} (${item.id})`).join(", ")}.`
      : "The user has no workspaces yet.",
    "Rules:",
    "- Prefer Fairlx data from tools over guessing.",
    "- Use tools when they will improve the answer.",
    "- Never claim you executed a shell command on the Fairlx host. Terminal only records planned commands.",
    "- Be concise and actionable.",
    "- Do not invent work items, projects, or credentials.",
  ];

  if (enabledPatterns.length) {
    lines.push("Work patterns:");
    for (const pattern of enabledPatterns) {
      lines.push(`- ${pattern.name}: ${pattern.instructions}`);
    }
  }
  if (enabledSkills.length) {
    lines.push("Enabled skills:");
    for (const skill of enabledSkills) {
      lines.push(`- ${skill.name}: ${skill.description}. Instructions: ${skill.instructions}`);
    }
  }
  if (harness.knowledge.length) {
    lines.push("Knowledge base:");
    for (const item of harness.knowledge.slice(0, 12)) {
      lines.push(`- ${item.title}: ${item.content.slice(0, 400)}`);
    }
  }
  return lines.join("\n");
}

type OpenAiMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
};

function toOpenAiMessages(system: string, messages: AgentChatMessage[]): OpenAiMessage[] {
  const recent = messages.slice(-MAX_HISTORY);
  const mapped: OpenAiMessage[] = recent.map((message) => {
    if (message.role === "assistant") {
      return {
        role: "assistant",
        content: message.content || null,
        tool_calls: message.toolCalls?.map((call) => ({
          id: call.id,
          type: "function" as const,
          function: { name: call.name, arguments: call.arguments },
        })),
      };
    }
    if (message.role === "tool") {
      return {
        role: "tool",
        content: message.content,
        tool_call_id: message.toolCallId,
        name: message.toolName,
      };
    }
    return { role: "user", content: message.content };
  });
  return [{ role: "system", content: system }, ...mapped];
}

async function chatCompletion(target: ChatTarget, body: Record<string, unknown>): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);
  try {
    const response = await fetch(target.url, {
      method: "POST",
      headers: target.headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { error: { message: text } };
    }
    if (!response.ok) {
      const message = json?.error?.message || json?.message || `Chat completion failed (${response.status})`;
      throw new Error(message);
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

function extractToolCalls(choice: any): AgentToolCall[] {
  const message = choice?.message ?? {};
  const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
  if (toolCalls.length) {
    return toolCalls
      .map((call: any) => ({
        id: String(call.id || crypto.randomUUID()),
        name: String(call.function?.name || call.name || ""),
        arguments:
          typeof call.function?.arguments === "string"
            ? call.function.arguments
            : JSON.stringify(call.function?.arguments ?? {}),
      }))
      .filter((call: AgentToolCall) => call.name);
  }
  if (message.function_call?.name) {
    return [
      {
        id: crypto.randomUUID(),
        name: String(message.function_call.name),
        arguments:
          typeof message.function_call.arguments === "string"
            ? message.function_call.arguments
            : JSON.stringify(message.function_call.arguments ?? {}),
      },
    ];
  }
  return [];
}

export async function runAgentTurn(params: {
  databases: Databases;
  user: { $id: string; name?: string; email?: string };
  run: AgentRun;
}): Promise<AgentRun> {
  const { databases, user } = params;
  let run = params.run;

  const [harness, context, mcpDoc, aiDoc] = await Promise.all([
    getOrCreateHarness(databases, user.$id),
    loadAgentContext(databases, user),
    getMcpDocument(databases, user.$id),
    getAiDocument(databases, user.$id),
  ]);
  const mcp = parseMcpConfig(mcpDoc?.configJson);
  const stored = parseAiConfig(aiDoc);

  let target: ChatTarget;
  try {
    target = resolveChatTarget(stored);
  } catch (error) {
    if (error instanceof AgentEncryptionRequiredError) throw error;
    const message = error instanceof Error ? error.message : "Failed to resolve model.";
    return updateRun(databases, run.id, { status: "failed", error: message });
  }

  run = await updateRun(databases, run.id, {
    status: "running",
    modelId: target.modelId,
    error: "",
  });

  const tools = openaiToolsForMode(run.mode, harness.settings.enabledTools ?? []);
  const system = buildSystemPrompt({ harness, context, run });

  try {
    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration += 1) {
      const completion = await chatCompletion(target, {
        model: target.model,
        messages: toOpenAiMessages(system, run.messages),
        temperature: 0.3,
        ...(tools.length ? { tools, tool_choice: "auto" } : {}),
      });
      const choice = completion?.choices?.[0];
      const content = typeof choice?.message?.content === "string" ? choice.message.content : "";
      const toolCalls = extractToolCalls(choice);

      if (toolCalls.length) {
        const assistantMessage: AgentChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: content || "",
          toolCalls,
          createdAt: new Date().toISOString(),
        };
        const nextMessages = [...run.messages, assistantMessage];
        const nextEvents = [...run.events];

        for (const call of toolCalls) {
          const result = await executeTool(call.name, call.arguments, {
            runId: run.id,
            userId: user.$id,
            context,
            harness,
            mcp,
          });
          nextEvents.push(result.event);
          nextMessages.push({
            id: crypto.randomUUID(),
            role: "tool",
            content: result.content,
            toolCallId: call.id,
            toolName: call.name,
            createdAt: new Date().toISOString(),
          });
        }

        run = await updateRun(databases, run.id, {
          messages: nextMessages,
          events: nextEvents,
          status: "running",
        });
        continue;
      }

      const assistantMessage: AgentChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: content || "Done.",
        createdAt: new Date().toISOString(),
      };
      return updateRun(databases, run.id, {
        messages: [...run.messages, assistantMessage],
        status: "completed",
        error: "",
      });
    }

    const limitMessage: AgentChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "I reached the tool-call limit for this turn. Ask me to continue if you want another pass.",
      createdAt: new Date().toISOString(),
    };
    return updateRun(databases, run.id, {
      messages: [...run.messages, limitMessage],
      status: "completed",
      error: "",
    });
  } catch (error) {
    if (error instanceof AgentEncryptionRequiredError) throw error;
    const message = error instanceof Error ? error.message : "Agent turn failed.";
    return updateRun(databases, run.id, { status: "failed", error: message });
  }
}

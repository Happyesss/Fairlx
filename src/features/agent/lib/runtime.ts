import type { Databases } from "node-appwrite";

import { GROK_46_MODEL_ID } from "../constants";
import type {
  AgentAiConfigStored,
  AgentChatMessage,
  AgentRun,
  AgentSpecialistId,
  AgentToolCall,
  AgentToolEvent,
} from "../types";
import { loadAgentContext } from "./context";
import { getOrCreateHarness, upsertHarness } from "./harness";
import { ensurePersonalMcp } from "./mcp-bridge";
import { getPlatformProviderCredentials, overlayPlatformModel } from "./platform-credentials";
import { buildSystemPrompt } from "./prompt";
import { getAiDocument, getMcpDocument, parseAiConfig, parseMcpConfig } from "./store";
import { decryptSecret } from "./secrets";
import { executeTool, openaiToolsForMode } from "./tools";
import { getRun, listRuns, updateRun } from "./runs";
import { AGENT_CHAT_TIMEOUT_MS, formatAgentTurnError } from "./turn-errors";
import { specialistById } from "./graph";

const MAX_TOOL_ITERATIONS = 12;
const MAX_SPECIALIST_ITERATIONS = 4;
const MAX_HISTORY = 24;
const cancelledRuns = new Set<string>();

export function cancelAgentTurn(runId: string) {
  cancelledRuns.add(runId);
}

export function isAgentTurnCancelled(runId: string) {
  return cancelledRuns.has(runId);
}

function thoughtEvent(runId: string, title: string, detail?: string): AgentToolEvent {
  return {
    id: crypto.randomUUID(),
    type: "thought",
    title,
    detail,
    createdAt: new Date().toISOString(),
    runId,
  };
}

function chatHost(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return "unknown";
  }
}

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

type OpenAiRawToolCall = {
  id?: string;
  name?: string;
  function?: {
    name?: string;
    arguments?: string | Record<string, unknown>;
  };
};

type OpenAiChoiceMessage = {
  content?: string | null;
  tool_calls?: OpenAiRawToolCall[];
  function_call?: {
    name?: string;
    arguments?: string | Record<string, unknown>;
  };
};

type OpenAiChoice = {
  message?: OpenAiChoiceMessage;
};

type OpenAiChatCompletionResponse = {
  choices?: OpenAiChoice[];
  error?: {
    message?: string;
  };
  message?: string;
  [key: string]: unknown;
};

async function chatCompletion(
  target: ChatTarget,
  body: Record<string, unknown>,
  runId: string,
): Promise<OpenAiChatCompletionResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AGENT_CHAT_TIMEOUT_MS);
  const poll = setInterval(() => {
    if (cancelledRuns.has(runId)) controller.abort();
  }, 250);
  try {
    const response = await fetch(target.url, {
      method: "POST",
      headers: target.headers,
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await response.text();
    let json: OpenAiChatCompletionResponse | null = null;
    try {
      json = text ? (JSON.parse(text) as OpenAiChatCompletionResponse) : null;
    } catch {
      json = { error: { message: text } };
    }
    if (!response.ok) {
      const message = json?.error?.message || json?.message || `Chat completion failed (${response.status})`;
      throw new Error(message);
    }
    return json ?? {};
  } catch (error) {
    console.error("[agent] chat completion failed", {
      model: target.model,
      host: chatHost(target.url),
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    clearTimeout(timer);
    clearInterval(poll);
  }
}

function extractToolCalls(choice?: OpenAiChoice): AgentToolCall[] {
  const message = choice?.message ?? {};
  const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
  if (toolCalls.length) {
    return toolCalls
      .map((call: OpenAiRawToolCall) => ({
        id: String(call.id || crypto.randomUUID()),
        name: String(call.function?.name || call.name || ""),
        arguments:
          typeof call.function?.arguments === "string"
            ? call.function.arguments
            : JSON.stringify(call.function?.arguments ?? {}),
      }))
      .filter((call: AgentToolCall) => Boolean(call.name));
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

  cancelledRuns.delete(run.id);

  const persistUnlessStopped = async (
    patch: Parameters<typeof updateRun>[2],
  ): Promise<AgentRun> => {
    if (cancelledRuns.has(run.id)) {
      return (await getRun(databases, user.$id, run.id)) ?? run;
    }
    const latest = await getRun(databases, user.$id, run.id);
    if (latest?.status === "stopped") return latest;
    return updateRun(databases, run.id, patch);
  };

  const haltIfStopped = async (): Promise<AgentRun | null> => {
    if (cancelledRuns.has(run.id)) {
      return (await getRun(databases, user.$id, run.id)) ?? run;
    }
    const latest = await getRun(databases, user.$id, run.id);
    if (latest?.status === "stopped") return latest;
    return null;
  };

  const [initialHarness, context, mcpDoc, aiDoc, runs] = await Promise.all([
    getOrCreateHarness(databases, user.$id),
    loadAgentContext(databases, user),
    getMcpDocument(databases, user.$id),
    getAiDocument(databases, user.$id),
    listRuns(databases, user.$id, 40),
  ]);
  let harness = initialHarness;
  const mcp = ensurePersonalMcp(parseMcpConfig(mcpDoc?.configJson));
  const stored = parseAiConfig(aiDoc);

  const stoppedBeforeModel = await haltIfStopped();
  if (stoppedBeforeModel) return stoppedBeforeModel;

  let target: ChatTarget;
  try {
    target = resolveChatTarget(stored);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to resolve model.";
    return persistUnlessStopped({ status: "failed", error: message });
  }

  run = await persistUnlessStopped({
    status: "running",
    modelId: target.modelId,
    error: "",
    events: [
      ...run.events,
      thoughtEvent(run.id, "Calling model", `Waiting for ${target.model}…`),
    ],
  });
  if (run.status === "stopped") return run;

  const tools = openaiToolsForMode(run.mode, harness.settings.enabledTools ?? []);
  const specialistTools = tools.filter((tool) => tool.function.name !== "delegate_agent");

  const toolContext = () => ({
    runId: run.id,
    userId: user.$id,
    context,
    harness,
    mcp,
    databases,
    runs,
  });

  const runSpecialistPass = async (
    specialist: AgentSpecialistId,
    task: string,
  ): Promise<{ content: string; events: AgentToolEvent[] }> => {
    const events: AgentToolEvent[] = [];
    const specialistRun: AgentRun = {
      ...run,
      prompt: task,
      messages: [
        {
          id: crypto.randomUUID(),
          role: "user",
          content: task,
          createdAt: new Date().toISOString(),
        },
      ],
    };
    let messages = specialistRun.messages;
    const system = buildSystemPrompt({ harness, context, run: specialistRun, mcp, specialist });
    for (let iteration = 0; iteration < MAX_SPECIALIST_ITERATIONS; iteration += 1) {
      if (cancelledRuns.has(run.id)) break;
      const completion = await chatCompletion(
        target,
        {
          model: target.model,
          messages: toOpenAiMessages(system, messages),
          temperature: 0.2,
          ...(specialistTools.length ? { tools: specialistTools, tool_choice: "auto" } : {}),
        },
        run.id,
      );
      const choice = completion?.choices?.[0];
      const content = typeof choice?.message?.content === "string" ? choice.message.content : "";
      const toolCalls = extractToolCalls(choice);
      if (!toolCalls.length) {
        return { content: content || "Specialist finished with no additional notes.", events };
      }
      messages = [
        ...messages,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: content || "",
          toolCalls,
          createdAt: new Date().toISOString(),
        },
      ];
      for (const call of toolCalls) {
        if (call.name === "delegate_agent") continue;
        const result = await executeTool(call.name, call.arguments, toolContext());
        if (result.harnessPatch) {
          harness = await upsertHarness(databases, user.$id, result.harnessPatch);
        }
        events.push(result.event);
        messages.push({
          id: crypto.randomUUID(),
          role: "tool",
          content: result.content,
          toolCallId: call.id,
          toolName: call.name,
          createdAt: new Date().toISOString(),
        });
      }
    }
    const last = [...messages].reverse().find((message) => message.role === "assistant" && message.content);
    return { content: last?.content || "Specialist reached its tool limit.", events };
  };

  try {
    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration += 1) {
      const stopped = await haltIfStopped();
      if (stopped) return stopped;

      const system = buildSystemPrompt({ harness, context, run, mcp });
      const completion = await chatCompletion(
        target,
        {
          model: target.model,
          messages: toOpenAiMessages(system, run.messages),
          temperature: 0.3,
          ...(tools.length ? { tools, tool_choice: "auto" } : {}),
        },
        run.id,
      );
      const stoppedAfterChat = await haltIfStopped();
      if (stoppedAfterChat) return stoppedAfterChat;

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
          const stoppedBeforeTool = await haltIfStopped();
          if (stoppedBeforeTool) return stoppedBeforeTool;
          const result = await executeTool(call.name, call.arguments, toolContext());
          if (result.harnessPatch) {
            harness = await upsertHarness(databases, user.$id, result.harnessPatch);
          }
          nextEvents.push(result.event);
          let toolContent = result.content;
          if (result.delegate) {
            const specialist = await runSpecialistPass(
              specialistById(result.delegate.agent),
              result.delegate.task,
            );
            nextEvents.push(...specialist.events);
            nextEvents.push(thoughtEvent(run.id, `${result.delegate.agent} specialist`, specialist.content.slice(0, 280)));
            toolContent = JSON.stringify({
              agent: result.delegate.agent,
              task: result.delegate.task,
              result: specialist.content,
            });
          }
          nextMessages.push({
            id: crypto.randomUUID(),
            role: "tool",
            content: toolContent,
            toolCallId: call.id,
            toolName: call.name,
            createdAt: new Date().toISOString(),
          });
        }

        run = await persistUnlessStopped({
          messages: nextMessages,
          events: nextEvents,
          status: "running",
        });
        if (run.status === "stopped") return run;
        continue;
      }

      const assistantMessage: AgentChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: content || "Done.",
        createdAt: new Date().toISOString(),
      };
      return persistUnlessStopped({
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
    return persistUnlessStopped({
      messages: [...run.messages, limitMessage],
      status: "completed",
      error: "",
    });
  } catch (error) {
    const stopped = await haltIfStopped();
    if (stopped) return stopped;
    return persistUnlessStopped({
      status: "failed",
      error: formatAgentTurnError(error, AGENT_CHAT_TIMEOUT_MS),
    });
  }
}

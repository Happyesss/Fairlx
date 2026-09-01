import type { Databases } from "node-appwrite";

import { DEEPSEEK_FLASH_MODEL_ID, GROK_46_MODEL_ID } from "../constants";
import type {
  AgentAiConfigStored,
  AgentChatMessage,
  AgentRun,
  AgentSpecialistId,
  AgentToolCall,
  AgentToolEvent,
} from "../types";
import { buildAgentMcpAuth, mcpToolsForAuth } from "./agent-auth";
import { loadAgentContext } from "./context";
import { getOrCreateHarness, upsertHarness } from "./harness";
import { ensurePersonalMcp } from "./mcp-bridge";
import { compileFairlxListIntent } from "./intent-compiler";
import { extractToolCallsFromText, mergeToolCalls, normalizeAgentToolCall, stripToolCallMarkup } from "./parse-tool-calls";
import { displayUserContent } from "./session-context";
import { getPlatformProviderCredentials, overlayPlatformModel } from "./platform-credentials";
import { buildSystemPrompt } from "./prompt";
import { getAiDocument, getMcpDocument, parseAiConfig, parseMcpConfig } from "./store";
import { decryptSecret } from "./secrets";
import {
  coalescedListMessage,
  collapseWorkItemListFanOut,
  fingerprintsFromMessages,
  hydrateListSliceCache,
  isFailedToolContent,
  MAX_CONSECUTIVE_TOOL_FAILURES,
  MAX_DUPLICATE_SKIPS,
  rememberListSlice,
  repeatedToolMessage,
  resolveListSliceCall,
  toolCallFingerprint,
  unwrapListCall,
} from "./tool-loop";
import { executeTool, openaiToolsForTurn } from "./tools";
import { compactJsonString } from "./truncate";
import { getRun, listRuns, updateRun } from "./runs";
import { AGENT_CHAT_TIMEOUT_MS, formatAgentTurnError } from "./turn-errors";
import { sanitizeAssistantVisible } from "./visible-content";
import { confirmationSummary, findPendingConfirmation, isWriteToolCall } from "./write-guard";
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
  maxOutputTokens?: number;
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
    models.find((item) => item.id === GROK_46_MODEL_ID && item.isEnabled) ??
    models.find((item) => item.id === DEEPSEEK_FLASH_MODEL_ID && item.isEnabled) ??
    models.find((item) => item.isEnabled) ??
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
      maxOutputTokens: model.maxOutputTokens,
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
    maxOutputTokens: model.maxOutputTokens,
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
        content: compactJsonString(message.content ?? "", 8000),
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
  content?: string | null | Array<{ type?: string; text?: string }>;
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

function extractMessageContent(message?: OpenAiChoiceMessage): string {
  const content = message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "string" ? part : String(part?.text ?? "")))
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function collectToolCalls(
  choice: OpenAiChoice | undefined,
  mcpToolNames: string[],
): { content: string; toolCalls: AgentToolCall[] } {
  const rawContent = extractMessageContent(choice?.message);
  const native = extractToolCalls(choice).map((call) => normalizeAgentToolCall(call, mcpToolNames));
  const fromText = extractToolCallsFromText(rawContent, mcpToolNames);
  return {
    content: stripToolCallMarkup(rawContent),
    toolCalls: mergeToolCalls(native, fromText),
  };
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

function unmatchedToolCalls(run: AgentRun): AgentToolCall[] {
  const lastAssistant = [...run.messages].reverse().find((message) => message.role === "assistant" && message.toolCalls?.length);
  if (!lastAssistant?.toolCalls?.length) return [];
  const answered = new Set(
    run.messages.filter((message) => message.role === "tool" && message.toolCallId).map((message) => message.toolCallId),
  );
  return lastAssistant.toolCalls.filter((call) => !answered.has(call.id));
}

export async function runAgentTurn(params: {
  databases: Databases;
  user: { $id: string; name?: string; email?: string };
  run: AgentRun;
  resume?: { decision: "accept" | "deny" };
}): Promise<AgentRun> {
  const { databases, user, resume } = params;
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

  const mcpAuth = await buildAgentMcpAuth({ databases, userId: user.$id, context, run });
  const mcpToolDefs = run.mode === "agent" ? mcpToolsForAuth(mcpAuth) : [];
  const mcpToolNames = mcpToolDefs.map((tool) => tool.name);

  run = await persistUnlessStopped({
    status: "running",
    modelId: target.modelId,
    error: "",
    events: resume ? run.events : [...run.events, thoughtEvent(run.id, "Working")],
  });
  if (run.status === "stopped") return run;

  const tools = openaiToolsForTurn({
    mode: run.mode,
    enabledTools: harness.settings.enabledTools ?? [],
    mcpTools: mcpToolDefs,
  });
  const specialistTools = tools.filter((tool) => tool.function.name !== "delegate_agent");
  const system = buildSystemPrompt({ harness, context, run, mcp });

  const toolContext = () => ({
    runId: run.id,
    userId: user.$id,
    context,
    harness,
    mcp,
    databases,
    runs,
    workspaceId: run.workspaceId || mcpAuth.workspaceId,
    projectId: run.projectId || mcpAuth.projectId,
    mcpAuth,
  });

  const seenCalls = fingerprintsFromMessages(run.messages);
  const listSlices = hydrateListSliceCache(run.messages);
  let failStreak = 0;
  let duplicateSkips = 0;
  let forceAnswer = false;

  const applyToolCall = async (
    call: AgentToolCall,
    nextMessages: AgentChatMessage[],
    nextEvents: AgentToolEvent[],
    options?: { coalesced?: boolean },
  ) => {
    const fingerprint = toolCallFingerprint(call.name, call.arguments);
    const previous = seenCalls.get(fingerprint);
    if (previous !== undefined) {
      duplicateSkips += 1;
      nextEvents.push(thoughtEvent(run.id, options?.coalesced ? "Combined overlapping lists" : "Reused previous result"));
      nextMessages.push({
        id: crypto.randomUUID(),
        role: "tool",
        content: options?.coalesced ? coalescedListMessage(previous) : repeatedToolMessage(previous),
        toolCallId: call.id,
        toolName: call.name,
        createdAt: new Date().toISOString(),
      });
      return;
    }

    const listed = unwrapListCall(call);
    const slice = resolveListSliceCall(listSlices, listed.tool, listed.args);
    if (slice.action === "skip") {
      duplicateSkips += 1;
      seenCalls.set(fingerprint, slice.content);
      nextEvents.push(thoughtEvent(run.id, "Skipped extra list page"));
      nextMessages.push({
        id: crypto.randomUUID(),
        role: "tool",
        content: slice.content,
        toolCallId: call.id,
        toolName: call.name,
        createdAt: new Date().toISOString(),
      });
      return;
    }

    const result = await executeTool(call.name, call.arguments, toolContext());
    if (result.harnessPatch) {
      harness = await upsertHarness(databases, user.$id, result.harnessPatch);
    }
    nextEvents.push(result.event);
    let toolContent = compactJsonString(result.content, 8000);
    if (result.delegate) {
      const specialist = await runSpecialistPass(
        specialistById(result.delegate.agent),
        result.delegate.task,
      );
      nextEvents.push(...specialist.events);
      toolContent = compactJsonString(
        JSON.stringify({
          agent: result.delegate.agent,
          task: result.delegate.task,
          result: specialist.content,
        }),
        8000,
      );
    }
    seenCalls.set(fingerprint, toolContent);
    rememberListSlice(listSlices, listed.tool, listed.args, toolContent);
    failStreak = isFailedToolContent(toolContent) ? failStreak + 1 : 0;
    nextMessages.push({
      id: crypto.randomUUID(),
      role: "tool",
      content: toolContent,
      toolCallId: call.id,
      toolName: call.name,
      createdAt: new Date().toISOString(),
    });
  };

  const pauseForConfirmation = async (
    nextMessages: AgentChatMessage[],
    nextEvents: AgentToolEvent[],
    writes: AgentToolCall[],
  ) => {
    const summary = writes.map((call) => confirmationSummary(call)).join(" · ");
    nextEvents.push({
      id: crypto.randomUUID(),
      type: "confirmation",
      title: summary,
      payload: { calls: writes, summary },
      createdAt: new Date().toISOString(),
      runId: run.id,
    });
    return persistUnlessStopped({
      messages: nextMessages,
      events: nextEvents,
      status: "awaiting_confirmation",
      error: "",
    });
  };

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
    const specialistSystem = buildSystemPrompt({ harness, context, run: specialistRun, mcp, specialist });
    for (let iteration = 0; iteration < MAX_SPECIALIST_ITERATIONS; iteration += 1) {
      if (cancelledRuns.has(run.id)) break;
      const completion = await chatCompletion(
        target,
        {
          model: target.model,
          messages: toOpenAiMessages(specialistSystem, messages),
          temperature: 0.2,
          ...(target.maxOutputTokens ? { max_tokens: target.maxOutputTokens } : {}),
          ...(specialistTools.length ? { tools: specialistTools, tool_choice: "auto" } : {}),
        },
        run.id,
      );
      const collected = collectToolCalls(completion?.choices?.[0], mcpToolNames);
      if (!collected.toolCalls.length) {
        return {
          content: sanitizeAssistantVisible(collected.content) || "Specialist finished with no additional notes.",
          events,
        };
      }
      messages = [
        ...messages,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: collected.content || "",
          toolCalls: collected.toolCalls,
          createdAt: new Date().toISOString(),
        },
      ];
      for (const call of collected.toolCalls) {
        if (call.name === "delegate_agent") continue;
        const result = await executeTool(call.name, call.arguments, toolContext());
        if (result.harnessPatch) {
          harness = await upsertHarness(databases, user.$id, result.harnessPatch);
        }
        events.push(result.event);
        messages.push({
          id: crypto.randomUUID(),
          role: "tool",
          content: compactJsonString(result.content, 8000),
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
    if (resume) {
      const pending = findPendingConfirmation(run.events) ?? { calls: unmatchedToolCalls(run), summary: "" };
      const pendingCalls = pending.calls.length ? pending.calls : unmatchedToolCalls(run);
      const nextMessages = [...run.messages];
      const nextEvents = [
        ...run.events,
        {
          id: crypto.randomUUID(),
          type: "confirmation_resolved" as const,
          title: resume.decision === "accept" ? "Accepted" : "Denied",
          createdAt: new Date().toISOString(),
          runId: run.id,
        },
      ];
      // Persist resolved immediately so the UI drops Accept/Deny even if the
      // following tool/model work takes a while or another poller is stale.
      run = await persistUnlessStopped({
        events: nextEvents,
        status: "running",
        error: "",
      });
      if (run.status === "stopped") return run;
      if (resume.decision === "deny") {
        for (const call of pendingCalls) {
          nextMessages.push({
            id: crypto.randomUUID(),
            role: "tool",
            content: JSON.stringify({ error: "The user denied this action." }),
            toolCallId: call.id,
            toolName: call.name,
            createdAt: new Date().toISOString(),
          });
        }
      } else {
        for (const call of pendingCalls) {
          const stoppedBeforeTool = await haltIfStopped();
          if (stoppedBeforeTool) return stoppedBeforeTool;
          await applyToolCall(call, nextMessages, nextEvents);
        }
      }
      run = await persistUnlessStopped({
        messages: nextMessages,
        events: nextEvents,
        status: "running",
        error: "",
      });
      if (run.status === "stopped") return run;
    }

    if (!resume && run.mode === "agent") {
      const lastUser = [...run.messages].reverse().find((message) => message.role === "user");
      const intent = compileFairlxListIntent(displayUserContent(lastUser?.content || run.prompt || ""), {
        projectId: run.projectId || mcpAuth.projectId,
      });
      if (intent) {
        const call: AgentToolCall = {
          id: crypto.randomUUID(),
          name: intent.tool,
          arguments: JSON.stringify(intent.args),
        };
        if (!seenCalls.has(toolCallFingerprint(call.name, call.arguments))) {
          const nextMessages: AgentChatMessage[] = [
            ...run.messages,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: "",
              toolCalls: [call],
              createdAt: new Date().toISOString(),
            },
          ];
          const nextEvents = [...run.events];
          await applyToolCall(call, nextMessages, nextEvents);
          run = await persistUnlessStopped({
            messages: nextMessages,
            events: nextEvents,
            status: "running",
          });
          if (run.status === "stopped") return run;
        }
      }
    }

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration += 1) {
      const stopped = await haltIfStopped();
      if (stopped) return stopped;

      const completion = await chatCompletion(
        target,
        {
          model: target.model,
          messages: toOpenAiMessages(system, run.messages),
          temperature: 0.2,
          ...(target.maxOutputTokens ? { max_tokens: target.maxOutputTokens } : {}),
          ...(tools.length && !forceAnswer ? { tools, tool_choice: "auto" } : {}),
        },
        run.id,
      );
      const stoppedAfterChat = await haltIfStopped();
      if (stoppedAfterChat) return stoppedAfterChat;

      const collected = collectToolCalls(completion?.choices?.[0], mcpToolNames);
      const content = sanitizeAssistantVisible(collected.content);

      if (collected.toolCalls.length && !forceAnswer) {
        const assistantMessage: AgentChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content,
          toolCalls: collected.toolCalls,
          createdAt: new Date().toISOString(),
        };
        const nextMessages = [...run.messages, assistantMessage];
        const nextEvents = [...run.events];
        const writes = collected.toolCalls.filter((call) => isWriteToolCall(call));
        const rawReads = collected.toolCalls.filter((call) => !isWriteToolCall(call));
        const { calls: reads, coalescedIds } = collapseWorkItemListFanOut(rawReads);

        for (const call of reads) {
          const stoppedBeforeTool = await haltIfStopped();
          if (stoppedBeforeTool) return stoppedBeforeTool;
          await applyToolCall(call, nextMessages, nextEvents, { coalesced: coalescedIds.has(call.id) });
        }

        if (writes.length) {
          return pauseForConfirmation(nextMessages, nextEvents, writes);
        }

        run = await persistUnlessStopped({
          messages: nextMessages,
          events: nextEvents,
          status: "running",
        });
        if (run.status === "stopped") return run;
        if (failStreak >= MAX_CONSECUTIVE_TOOL_FAILURES || duplicateSkips >= MAX_DUPLICATE_SKIPS) {
          forceAnswer = true;
        }
        continue;
      }

      const assistantMessage: AgentChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          content ||
          (forceAnswer
            ? "I could not complete the lookup. Please retry or rephrase the request."
            : "Done."),
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

import { PLATFORM_GROK_DEFAULT_ENDPOINT } from "./platform-credentials";

export const DEFAULT_TRANSCRIBE_DEPLOYMENT = "gpt-4o-transcribe-diarize";
export const DEFAULT_TRANSCRIBE_API_VERSION = "2025-03-01-preview";
export const MAX_TRANSCRIBE_BYTES = 20 * 1024 * 1024;
export const TRANSCRIBE_TIMEOUT_MS = 60_000;

export class TranscribeConfigError extends Error {
  constructor(message = "Voice transcription is not configured.") {
    super(message);
    this.name = "TranscribeConfigError";
  }
}

export class TranscribeRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TranscribeRequestError";
  }
}

export type TranscribeCredentials = {
  apiKey: string;
  url: string;
  deployment: string;
};

function trimSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function getTranscribeApiKey(env: NodeJS.ProcessEnv = process.env): string {
  return (
    env.AGENT_TRANSCRIBE_AZURE_API_KEY?.trim() ||
    env.AGENT_GROK_AZURE_API_KEY?.trim() ||
    ""
  );
}

export function getTranscribeDeployment(env: NodeJS.ProcessEnv = process.env): string {
  return env.AGENT_TRANSCRIBE_AZURE_DEPLOYMENT?.trim() || DEFAULT_TRANSCRIBE_DEPLOYMENT;
}

export function getTranscribeApiVersion(env: NodeJS.ProcessEnv = process.env): string {
  return env.AGENT_TRANSCRIBE_AZURE_API_VERSION?.trim() || DEFAULT_TRANSCRIBE_API_VERSION;
}

export function getTranscribeEndpoint(env: NodeJS.ProcessEnv = process.env): string {
  return (
    env.AGENT_TRANSCRIBE_AZURE_ENDPOINT?.trim() ||
    env.AGENT_GROK_AZURE_ENDPOINT?.trim() ||
    PLATFORM_GROK_DEFAULT_ENDPOINT
  );
}

export function buildTranscribeUrl(env: NodeJS.ProcessEnv = process.env): string {
  const full = env.AGENT_TRANSCRIBE_AZURE_URL?.trim();
  if (full) return full;
  const endpoint = trimSlash(getTranscribeEndpoint(env));
  const deployment = encodeURIComponent(getTranscribeDeployment(env));
  const version = encodeURIComponent(getTranscribeApiVersion(env));
  return `${endpoint}/openai/deployments/${deployment}/audio/transcriptions?api-version=${version}`;
}

export function getTranscribeCredentials(
  env: NodeJS.ProcessEnv = process.env,
): TranscribeCredentials | null {
  const apiKey = getTranscribeApiKey(env);
  if (!apiKey) return null;
  return {
    apiKey,
    url: buildTranscribeUrl(env),
    deployment: getTranscribeDeployment(env),
  };
}

export function extractTranscriptionText(payload: unknown): string {
  if (typeof payload === "string") {
    const trimmed = payload.trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return extractTranscriptionText(JSON.parse(trimmed));
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }
  if (!payload || typeof payload !== "object") return "";
  const record = payload as Record<string, unknown>;
  if (typeof record.text === "string" && record.text.trim()) {
    return record.text.trim();
  }
  if (Array.isArray(record.segments)) {
    const joined = record.segments
      .map((segment) => {
        if (!segment || typeof segment !== "object") return "";
        const text = (segment as { text?: unknown }).text;
        return typeof text === "string" ? text.trim() : "";
      })
      .filter(Boolean)
      .join(" ");
    if (joined) return joined;
  }
  return "";
}

export function parseAzureErrorMessage(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as {
      error?: { message?: unknown };
      message?: unknown;
    };
    if (typeof parsed.error?.message === "string" && parsed.error.message.trim()) {
      return parsed.error.message.trim();
    }
    if (typeof parsed.message === "string" && parsed.message.trim()) {
      return parsed.message.trim();
    }
  } catch {
    /* not JSON */
  }
  const trimmed = raw.replace(/\s+/g, " ").trim();
  return trimmed ? trimmed.slice(0, 280) : "Transcription failed.";
}

export async function transcribeAudioBlob(
  blob: Blob,
  filename = "voice.webm",
  env: NodeJS.ProcessEnv = process.env,
): Promise<string> {
  const credentials = getTranscribeCredentials(env);
  if (!credentials) {
    throw new TranscribeConfigError();
  }
  if (!blob.size) {
    throw new TranscribeRequestError("Didn't catch any audio. Try again.");
  }
  if (blob.size > MAX_TRANSCRIBE_BYTES) {
    throw new TranscribeRequestError("Recording is too long. Keep it under about a minute.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TRANSCRIBE_TIMEOUT_MS);

  const post = async (includeChunking: boolean) => {
    const form = new FormData();
    form.append("file", blob, filename);
    form.append("model", credentials.deployment);
    if (includeChunking) form.append("chunking_strategy", "auto");
    const response = await fetch(credentials.url, {
      method: "POST",
      headers: { "api-key": credentials.apiKey },
      body: form,
      signal: controller.signal,
    });
    return { ok: response.ok, status: response.status, raw: await response.text() };
  };

  try {
    let result = await post(true);
    if (!result.ok && result.status === 400 && /chunking_strategy/i.test(result.raw)) {
      result = await post(false);
    }
    if (!result.ok) {
      throw new TranscribeRequestError(parseAzureErrorMessage(result.raw));
    }
    const text = extractTranscriptionText(result.raw);
    if (!text) {
      throw new TranscribeRequestError("No speech was recognized. Try again.");
    }
    return text;
  } catch (error) {
    if (error instanceof TranscribeRequestError || error instanceof TranscribeConfigError) {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new TranscribeRequestError("Transcription timed out. Try a shorter clip.");
    }
    throw new TranscribeRequestError("Couldn't reach the transcription service.");
  } finally {
    clearTimeout(timer);
  }
}

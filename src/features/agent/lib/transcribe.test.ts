import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildTranscribeUrl,
  extractTranscriptionText,
  getTranscribeCredentials,
  parseAzureErrorMessage,
  transcribeAudioBlob,
} from "./transcribe";
import { audioFilenameForMime } from "./voice-input";

describe("Azure transcription helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("builds the Azure deployment transcription URL", () => {
    vi.stubEnv("AGENT_TRANSCRIBE_AZURE_ENDPOINT", "https://personal-use-g1-resource.openai.azure.com/");
    vi.stubEnv("AGENT_TRANSCRIBE_AZURE_DEPLOYMENT", "gpt-4o-transcribe-diarize");
    vi.stubEnv("AGENT_TRANSCRIBE_AZURE_API_VERSION", "2025-03-01-preview");
    expect(buildTranscribeUrl(process.env)).toBe(
      "https://personal-use-g1-resource.openai.azure.com/openai/deployments/gpt-4o-transcribe-diarize/audio/transcriptions?api-version=2025-03-01-preview",
    );
  });

  it("uses an explicit URL override when set", () => {
    vi.stubEnv(
      "AGENT_TRANSCRIBE_AZURE_URL",
      "https://example.openai.azure.com/openai/deployments/custom/audio/transcriptions?api-version=2025-03-01-preview",
    );
    expect(buildTranscribeUrl(process.env)).toContain("/deployments/custom/");
  });

  it("falls back to the Grok Azure key on the same resource", () => {
    vi.stubEnv("AGENT_TRANSCRIBE_AZURE_API_KEY", "");
    vi.stubEnv("AGENT_GROK_AZURE_API_KEY", "grok-key");
    vi.stubEnv("AGENT_GROK_AZURE_ENDPOINT", "https://personal-use-g1-resource.openai.azure.com");
    const credentials = getTranscribeCredentials(process.env);
    expect(credentials?.apiKey).toBe("grok-key");
    expect(credentials?.deployment).toBe("gpt-4o-transcribe-diarize");
    expect(credentials?.url).toContain("gpt-4o-transcribe-diarize");
  });

  it("prefers a dedicated transcribe key", () => {
    vi.stubEnv("AGENT_GROK_AZURE_API_KEY", "grok-key");
    vi.stubEnv("AGENT_TRANSCRIBE_AZURE_API_KEY", "transcribe-key");
    expect(getTranscribeCredentials(process.env)?.apiKey).toBe("transcribe-key");
  });

  it("returns null when no key is configured", () => {
    expect(getTranscribeCredentials({} as NodeJS.ProcessEnv)).toBeNull();
  });

  it("extracts plain text and diarized segments", () => {
    expect(extractTranscriptionText({ text: " Plan the sprint " })).toBe("Plan the sprint");
    expect(
      extractTranscriptionText({
        segments: [{ speaker: "A", text: "Create" }, { speaker: "B", text: "the board" }],
      }),
    ).toBe("Create the board");
    expect(extractTranscriptionText('{"text":"Ship it"}')).toBe("Ship it");
  });

  it("maps Azure error payloads", () => {
    expect(parseAzureErrorMessage('{"error":{"message":"Deployment not found"}}')).toBe(
      "Deployment not found",
    );
    expect(audioFilenameForMime("audio/webm;codecs=opus")).toBe("voice.webm");
    expect(audioFilenameForMime("audio/mp4")).toBe("voice.m4a");
  });

  it("retries without chunking_strategy when Azure rejects it", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => '{"error":{"message":"chunking_strategy is invalid"}}',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '{"text":"hello board"}',
      });
    vi.stubGlobal("fetch", fetchMock);
    const blob = new Blob([new Uint8Array(512)], { type: "audio/webm" });
    const text = await transcribeAudioBlob(blob, "voice.webm", {
      AGENT_GROK_AZURE_API_KEY: "k",
      AGENT_GROK_AZURE_ENDPOINT: "https://personal-use-g1-resource.openai.azure.com",
    } as NodeJS.ProcessEnv);
    expect(text).toBe("hello board");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  DEEPSEEK_FLASH_MODEL_ID,
  GROK_46_MODEL_ID,
  PLATFORM_DEEPSEEK_PROVIDER_ID,
  PLATFORM_XAI_PROVIDER_ID,
  getPlatformDefaultModelId,
  getPlatformModels,
  getPlatformProviders,
  isPlatformGrokEnabled,
} from "../constants";
import { defaultAiStoredConfig, mergePlatformAiConfig } from "./defaults";
import {
  getPlatformGrokApiKey,
  getPlatformProviderCredentials,
  platformGrokHasKey,
} from "./platform-credentials";
import { resolveChatTarget } from "./runtime";

describe("Platform Grok environment-based visibility", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("Development / local environment", () => {
    beforeEach(() => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("AGENT_GROK_AZURE_API_KEY", "test-grok-key");
      vi.stubEnv("AGENT_DEEPSEEK_AZURE_API_KEY", "test-deepseek-key");
    });

    it("enables Grok by default in development", () => {
      expect(isPlatformGrokEnabled()).toBe(true);
      expect(getPlatformDefaultModelId()).toBe(GROK_46_MODEL_ID);

      const providers = getPlatformProviders();
      expect(providers.map((p) => p.id)).toContain(PLATFORM_XAI_PROVIDER_ID);
      expect(providers.map((p) => p.id)).toContain(PLATFORM_DEEPSEEK_PROVIDER_ID);

      const models = getPlatformModels();
      expect(models.map((m) => m.id)).toContain(GROK_46_MODEL_ID);
      expect(models.map((m) => m.id)).toContain(DEEPSEEK_FLASH_MODEL_ID);
    });

    it("returns Grok credentials in development when API key is set", () => {
      expect(getPlatformGrokApiKey()).toBe("test-grok-key");
      expect(platformGrokHasKey()).toBe(true);

      const creds = getPlatformProviderCredentials(PLATFORM_XAI_PROVIDER_ID);
      expect(creds).not.toBeNull();
      expect(creds?.apiKey).toBe("test-grok-key");
      expect(creds?.deployment).toBe("grok-4.6");
    });

    it("defaults stored config to Grok in development", () => {
      const config = defaultAiStoredConfig();
      expect(config.selectedModelId).toBe(GROK_46_MODEL_ID);
      expect(config.models.some((m) => m.id === GROK_46_MODEL_ID)).toBe(true);
      expect(config.providers.some((p) => p.id === PLATFORM_XAI_PROVIDER_ID)).toBe(true);
    });

    it("resolves auto mode chat target to Grok in development", () => {
      const config = defaultAiStoredConfig();
      const target = resolveChatTarget(config);
      expect(target.modelId).toBe(GROK_46_MODEL_ID);
    });
  });

  describe("Production environment", () => {
    beforeEach(() => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("AGENT_GROK_AZURE_API_KEY", "test-grok-key");
      vi.stubEnv("AGENT_DEEPSEEK_AZURE_API_KEY", "test-deepseek-key");
    });

    it("hides and disables Grok in production", () => {
      expect(isPlatformGrokEnabled()).toBe(false);
      expect(getPlatformDefaultModelId()).toBe(DEEPSEEK_FLASH_MODEL_ID);

      const providers = getPlatformProviders();
      expect(providers.map((p) => p.id)).not.toContain(PLATFORM_XAI_PROVIDER_ID);
      expect(providers.map((p) => p.id)).toEqual([PLATFORM_DEEPSEEK_PROVIDER_ID]);

      const models = getPlatformModels();
      expect(models.map((m) => m.id)).not.toContain(GROK_46_MODEL_ID);
      expect(models.map((m) => m.id)).toEqual([DEEPSEEK_FLASH_MODEL_ID]);
      expect(models[0]?.role).toBe("default");
    });

    it("returns empty Grok API key and null credentials in production", () => {
      expect(getPlatformGrokApiKey()).toBe("");
      expect(platformGrokHasKey()).toBe(false);

      const creds = getPlatformProviderCredentials(PLATFORM_XAI_PROVIDER_ID);
      expect(creds).toBeNull();
    });

    it("defaults stored config to DeepSeek in production", () => {
      const config = defaultAiStoredConfig();
      expect(config.selectedModelId).toBe(DEEPSEEK_FLASH_MODEL_ID);
      expect(config.models.some((m) => m.id === GROK_46_MODEL_ID)).toBe(false);
      expect(config.providers.some((p) => p.id === PLATFORM_XAI_PROVIDER_ID)).toBe(false);
    });

    it("strips Grok from legacy / dev stored configs in production", () => {
      const legacyDevConfig = {
        mode: "auto" as const,
        selectedModelId: GROK_46_MODEL_ID,
        providers: [
          {
            id: PLATFORM_XAI_PROVIDER_ID,
            provider: "azure" as const,
            displayName: "Azure Grok (Fairlx)",
            isEnabled: true,
            isPlatform: true,
          },
          {
            id: PLATFORM_DEEPSEEK_PROVIDER_ID,
            provider: "azure" as const,
            displayName: "Azure DeepSeek (Fairlx)",
            isEnabled: true,
            isPlatform: true,
          },
        ],
        models: [
          {
            id: GROK_46_MODEL_ID,
            providerId: PLATFORM_XAI_PROVIDER_ID,
            modelId: "grok-4.6",
            displayName: "Grok 4.6",
            role: "default" as const,
            isEnabled: true,
            isPlatform: true,
          },
          {
            id: DEEPSEEK_FLASH_MODEL_ID,
            providerId: PLATFORM_DEEPSEEK_PROVIDER_ID,
            modelId: "DeepSeek-V4-Flash",
            displayName: "DeepSeek V4 Flash",
            role: "flash" as const,
            isEnabled: true,
            isPlatform: true,
          },
        ],
      };

      const merged = mergePlatformAiConfig(legacyDevConfig);
      expect(merged.providers.some((p) => p.id === PLATFORM_XAI_PROVIDER_ID)).toBe(false);
      expect(merged.models.some((m) => m.id === GROK_46_MODEL_ID)).toBe(false);
      expect(merged.selectedModelId).toBe(DEEPSEEK_FLASH_MODEL_ID);
    });

    it("resolves auto mode chat target to DeepSeek in production", () => {
      const config = defaultAiStoredConfig();
      const target = resolveChatTarget(config);
      expect(target.modelId).toBe(DEEPSEEK_FLASH_MODEL_ID);
    });
  });

  describe("ENABLE_PLATFORM_GROK override", () => {
    it("allows explicitly enabling Grok even if NODE_ENV is production", () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("ENABLE_PLATFORM_GROK", "true");
      expect(isPlatformGrokEnabled()).toBe(true);
      expect(getPlatformDefaultModelId()).toBe(GROK_46_MODEL_ID);
    });

    it("allows explicitly disabling Grok even if NODE_ENV is development", () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("ENABLE_PLATFORM_GROK", "false");
      expect(isPlatformGrokEnabled()).toBe(false);
      expect(getPlatformDefaultModelId()).toBe(DEEPSEEK_FLASH_MODEL_ID);
    });
  });
});

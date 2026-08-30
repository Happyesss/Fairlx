import {
  PLATFORM_DEEPSEEK_PROVIDER_ID,
  PLATFORM_MODELS,
  PLATFORM_PROVIDERS,
  PLATFORM_XAI_PROVIDER_ID,
} from "../constants";
import type {
  AgentAiConfigPublic,
  AgentAiConfigStored,
  AgentApiKeySource,
  AgentProviderPublic,
  AgentProviderStored,
} from "../types";
import { last4FromEncrypted, maskEncryptedSecret } from "./secrets";

export { defaultMcpConfig, enabledModels, selectedModelLabel } from "./client-defaults";

export function defaultAiStoredConfig(): AgentAiConfigStored {
  return {
    mode: "auto",
    selectedModelId: PLATFORM_MODELS[0]?.id,
    providers: PLATFORM_PROVIDERS.map((provider) => ({ ...provider })),
    models: PLATFORM_MODELS.map((model) => ({ ...model })),
  };
}

export function platformXaiHasKey(): boolean {
  return Boolean(process.env.XAI_API_KEY || process.env.GROK_API_KEY);
}

export function platformDeepseekHasKey(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY);
}

export function mergePlatformAiConfig(config: AgentAiConfigStored): AgentAiConfigStored {
  const providers = [...config.providers];
  for (const platform of PLATFORM_PROVIDERS) {
    const index = providers.findIndex((provider) => provider.id === platform.id);
    if (index === -1) {
      providers.unshift({ ...platform });
      continue;
    }
    const existing = providers[index]!;
    providers[index] = {
      ...platform,
      ...existing,
      id: platform.id,
      provider: platform.provider,
      isPlatform: true,
    };
  }

  const models = [...config.models];
  for (const platform of PLATFORM_MODELS) {
    const index = models.findIndex((model) => model.id === platform.id);
    if (index === -1) {
      models.unshift({ ...platform });
      continue;
    }
    const existing = models[index]!;
    models[index] = {
      ...platform,
      ...existing,
      id: platform.id,
      providerId: platform.providerId,
      modelId: existing.modelId || platform.modelId,
      isPlatform: true,
    };
  }

  return {
    ...config,
    mode: config.mode === "manual" ? "manual" : "auto",
    providers,
    models,
  };
}

function providerApiKeySource(provider: AgentProviderStored): AgentApiKeySource {
  if (provider.apiKeyEncrypted) return "user";
  if (provider.id === PLATFORM_XAI_PROVIDER_ID && platformXaiHasKey()) return "platform";
  if (provider.id === PLATFORM_DEEPSEEK_PROVIDER_ID && platformDeepseekHasKey()) return "platform";
  return "none";
}

export function toPublicProvider(provider: AgentProviderStored): AgentProviderPublic {
  const apiKeySource = providerApiKeySource(provider);
  return {
    id: provider.id,
    provider: provider.provider,
    displayName: provider.displayName,
    apiKeyMasked: apiKeySource === "user" ? maskEncryptedSecret(provider.apiKeyEncrypted) : undefined,
    apiKeyLast4: apiKeySource === "user" ? provider.apiKeyLast4 || last4FromEncrypted(provider.apiKeyEncrypted) : undefined,
    hasApiKey: apiKeySource !== "none",
    apiKeySource,
    baseUrl: provider.baseUrl,
    extra: provider.extra,
    isEnabled: provider.isEnabled,
    isPlatform: provider.isPlatform,
  };
}

export function toPublicAiConfig(config: AgentAiConfigStored): AgentAiConfigPublic {
  const merged = mergePlatformAiConfig(config);
  return {
    mode: merged.mode,
    selectedModelId: merged.selectedModelId,
    providers: merged.providers.map(toPublicProvider),
    models: merged.models.map((model) => ({ ...model })),
  };
}

export function parseJson<T>(raw: string | undefined | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

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
import {
  overlayPlatformModel,
  overlayPlatformProvider,
  platformDeepseekHasKey,
  platformGrokHasKey,
} from "./platform-credentials";
import { last4FromEncrypted, maskEncryptedSecret } from "./secrets";

export { defaultMcpConfig, enabledModels, selectedModelLabel } from "./client-defaults";
export { platformDeepseekHasKey, platformGrokHasKey, platformXaiHasKey } from "./platform-credentials";

export function defaultAiStoredConfig(): AgentAiConfigStored {
  return {
    mode: "auto",
    selectedModelId: PLATFORM_MODELS[0]?.id,
    providers: PLATFORM_PROVIDERS.map((provider) => overlayPlatformProvider(provider)),
    models: PLATFORM_MODELS.map((model) => overlayPlatformModel(model)),
  };
}

export function mergePlatformAiConfig(config: AgentAiConfigStored): AgentAiConfigStored {
  const platformProviderIds = new Set(PLATFORM_PROVIDERS.map((p) => p.id));
  const providers = config.providers.filter((p) => !p.isPlatform || platformProviderIds.has(p.id));
  for (const platform of PLATFORM_PROVIDERS) {
    const nextPlatform = overlayPlatformProvider(platform);
    const index = providers.findIndex((provider) => provider.id === platform.id);
    if (index === -1) {
      providers.unshift({ ...nextPlatform });
      continue;
    }
    const existing = providers[index]!;
    providers[index] = {
      ...nextPlatform,
      isEnabled: existing.isEnabled,
      apiKeyEncrypted: existing.apiKeyEncrypted,
      apiKeyLast4: existing.apiKeyLast4,
      id: nextPlatform.id,
      isPlatform: true,
    };
  }

  const platformModelIds = new Set(PLATFORM_MODELS.map((m) => m.id));
  const models = config.models.filter((m) => !m.isPlatform || platformModelIds.has(m.id));
  for (const platform of PLATFORM_MODELS) {
    const nextPlatform = overlayPlatformModel(platform);
    const index = models.findIndex((model) => model.id === platform.id);
    if (index === -1) {
      models.unshift({ ...nextPlatform });
      continue;
    }
    const existing = models[index]!;
    models[index] = {
      ...nextPlatform,
      isEnabled: existing.isEnabled,
      id: nextPlatform.id,
      isPlatform: true,
    };
  }

  const selectedModelId =
    !config.selectedModelId || !models.some((m) => m.id === config.selectedModelId)
      ? (PLATFORM_MODELS[0]?.id ?? "")
      : config.selectedModelId;

  return {
    ...config,
    mode: config.mode === "manual" ? "manual" : "auto",
    selectedModelId,
    providers,
    models,
  };
}

function providerApiKeySource(provider: AgentProviderStored): AgentApiKeySource {
  if (provider.apiKeyEncrypted) return "user";
  if (provider.id === PLATFORM_XAI_PROVIDER_ID && platformGrokHasKey()) return "platform";
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

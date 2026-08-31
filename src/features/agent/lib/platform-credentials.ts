import {
  DEEPSEEK_FLASH_MODEL_ID,
  GROK_46_MODEL_ID,
  PLATFORM_DEEPSEEK_PROVIDER_ID,
  PLATFORM_XAI_PROVIDER_ID,
} from "../constants";
import type { AgentModel, AgentProviderStored } from "../types";

export const PLATFORM_GROK_DEFAULT_ENDPOINT =
  "https://personal-use-g1-resource.openai.azure.com";
export const PLATFORM_DEEPSEEK_DEFAULT_ENDPOINT =
  "https://projectfairlx-resource.services.ai.azure.com/api/projects/projectfairlx";
export const PLATFORM_GROK_DEFAULT_DEPLOYMENT = "grok-4.6";
export const PLATFORM_DEEPSEEK_DEFAULT_DEPLOYMENT = "DeepSeek-V4-Flash";
export const PLATFORM_AZURE_OPENAI_PATH = "/openai/v1";

export function getPlatformGrokApiKey(): string {
  return (
    process.env.AGENT_GROK_AZURE_API_KEY?.trim() ||
    process.env.GROK_API_KEY?.trim() ||
    process.env.XAI_API_KEY?.trim() ||
    ""
  );
}

export function getPlatformDeepseekApiKey(): string {
  return (
    process.env.AGENT_DEEPSEEK_AZURE_API_KEY?.trim() ||
    process.env.DEEPSEEK_API_KEY?.trim() ||
    ""
  );
}

export function platformGrokHasKey(): boolean {
  return Boolean(getPlatformGrokApiKey());
}

export function platformDeepseekHasKey(): boolean {
  return Boolean(getPlatformDeepseekApiKey());
}

/** @deprecated Use platformGrokHasKey */
export const platformXaiHasKey = platformGrokHasKey;

export function getPlatformGrokEndpoint(): string {
  return process.env.AGENT_GROK_AZURE_ENDPOINT?.trim() || PLATFORM_GROK_DEFAULT_ENDPOINT;
}

export function getPlatformDeepseekEndpoint(): string {
  return (
    process.env.AGENT_DEEPSEEK_AZURE_ENDPOINT?.trim() || PLATFORM_DEEPSEEK_DEFAULT_ENDPOINT
  );
}

export function getPlatformGrokDeployment(): string {
  return process.env.AGENT_GROK_AZURE_DEPLOYMENT?.trim() || PLATFORM_GROK_DEFAULT_DEPLOYMENT;
}

export function getPlatformDeepseekDeployment(): string {
  return (
    process.env.AGENT_DEEPSEEK_AZURE_DEPLOYMENT?.trim() || PLATFORM_DEEPSEEK_DEFAULT_DEPLOYMENT
  );
}

export type PlatformRuntimeCredentials = {
  providerId: string;
  apiKey: string;
  baseUrl: string;
  deployment: string;
  openaiPath: string;
  authHeader: "api-key";
  extra: Record<string, unknown>;
};

export function getPlatformProviderCredentials(
  providerId: string
): PlatformRuntimeCredentials | null {
  if (providerId === PLATFORM_XAI_PROVIDER_ID) {
    const apiKey = getPlatformGrokApiKey();
    if (!apiKey) return null;
    return {
      providerId,
      apiKey,
      baseUrl: getPlatformGrokEndpoint(),
      deployment: getPlatformGrokDeployment(),
      openaiPath: PLATFORM_AZURE_OPENAI_PATH,
      authHeader: "api-key",
      extra: {
        vendor: "azure",
        toolCalling: true,
        vision: true,
        maxInputTokens: 72000,
        maxOutputTokens: 128000,
      },
    };
  }

  if (providerId === PLATFORM_DEEPSEEK_PROVIDER_ID) {
    const apiKey = getPlatformDeepseekApiKey();
    if (!apiKey) return null;
    return {
      providerId,
      apiKey,
      baseUrl: getPlatformDeepseekEndpoint(),
      deployment: getPlatformDeepseekDeployment(),
      openaiPath: PLATFORM_AZURE_OPENAI_PATH,
      authHeader: "api-key",
      extra: {
        vendor: "azure",
        project: "projectfairlx",
      },
    };
  }

  return null;
}

export function overlayPlatformProvider(platform: AgentProviderStored): AgentProviderStored {
  if (platform.id === PLATFORM_XAI_PROVIDER_ID) {
    return {
      ...platform,
      baseUrl: getPlatformGrokEndpoint(),
      extra: {
        ...platform.extra,
        vendor: "azure",
        deployment: getPlatformGrokDeployment(),
        openaiPath: PLATFORM_AZURE_OPENAI_PATH,
        authHeader: "api-key",
      },
    };
  }

  if (platform.id === PLATFORM_DEEPSEEK_PROVIDER_ID) {
    return {
      ...platform,
      baseUrl: getPlatformDeepseekEndpoint(),
      extra: {
        ...platform.extra,
        vendor: "azure",
        deployment: getPlatformDeepseekDeployment(),
        openaiPath: PLATFORM_AZURE_OPENAI_PATH,
        authHeader: "api-key",
        project: "projectfairlx",
      },
    };
  }

  return platform;
}

export function overlayPlatformModel(model: AgentModel): AgentModel {
  if (model.id === GROK_46_MODEL_ID) {
    return { ...model, modelId: getPlatformGrokDeployment() };
  }
  if (model.id === DEEPSEEK_FLASH_MODEL_ID) {
    return { ...model, modelId: getPlatformDeepseekDeployment() };
  }
  return model;
}

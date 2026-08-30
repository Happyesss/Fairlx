import {
  decryptToken,
  encryptToken,
  isEncryptionConfigured,
} from "@/features/github-integration/lib/encryption";

import { isEncryptedPayload, last4, maskSecret } from "./mask";

export { isEncryptionConfigured };

export class AgentEncryptionRequiredError extends Error {
  constructor(message = "INTEGRATION_ENCRYPTION_SECRET is required to store API keys and MCP secrets.") {
    super(message);
    this.name = "AgentEncryptionRequiredError";
  }
}

export function encryptSecret(plaintext: string): string {
  if (!isEncryptionConfigured()) {
    throw new AgentEncryptionRequiredError();
  }
  return encryptToken(plaintext);
}

export function decryptSecret(value: string): string {
  if (!isEncryptedPayload(value)) {
    return value;
  }

  try {
    return decryptToken(value);
  } catch {
    return value;
  }
}

export function maskEncryptedSecret(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return maskSecret(decryptSecret(value));
}

export function last4FromEncrypted(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return last4(decryptSecret(value));
}

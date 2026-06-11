import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Get the encryption key from environment.
 * Must be a 32-byte hex string (64 hex characters).
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.INTEGRATION_ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error(
      "INTEGRATION_ENCRYPTION_SECRET is required for token encryption"
    );
  }
  if (secret.length !== 64) {
    throw new Error(
      "INTEGRATION_ENCRYPTION_SECRET must be a 64-character hex string (32 bytes)"
    );
  }
  return Buffer.from(secret, "hex");
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a string in the format: `iv:ciphertext:authTag` (all base64).
 */
export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");
  const authTag = cipher.getAuthTag();

  return `${iv.toString("base64")}:${encrypted}:${authTag.toString("base64")}`;
}

/**
 * Decrypt a token string produced by `encryptToken`.
 * Expects format: `iv:ciphertext:authTag` (all base64).
 */
export function decryptToken(encryptedString: string): string {
  const key = getEncryptionKey();
  const parts = encryptedString.split(":");

  if (parts.length !== 3) {
    throw new Error("Invalid encrypted token format");
  }

  const [ivBase64, ciphertext, authTagBase64] = parts;
  const iv = Buffer.from(ivBase64!, "base64");
  const authTag = Buffer.from(authTagBase64!, "base64");

  if (iv.length !== IV_LENGTH) {
    throw new Error("Invalid IV length");
  }
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error("Invalid auth tag length");
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext!, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Check if the encryption secret is configured.
 * Use this to gracefully degrade when encryption is not available.
 */
export function isEncryptionConfigured(): boolean {
  const secret = process.env.INTEGRATION_ENCRYPTION_SECRET;
  return !!secret && secret.length === 64;
}

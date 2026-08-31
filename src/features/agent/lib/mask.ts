const MASKED_SECRET_RE = /^[•*]{2,}/;

export function last4(value: string): string {
  if (!value) return "";
  return value.slice(-4);
}

export function maskSecret(plaintext: string): string {
  if (!plaintext) return "";
  return `••••${last4(plaintext)}`;
}

export function isMaskedSecret(value: string | undefined | null): boolean {
  if (value == null || value === "") return true;
  return MASKED_SECRET_RE.test(value);
}

export function isEncryptedPayload(value: string): boolean {
  const parts = value.split(":");
  return parts.length === 3 && parts.every((part) => part.length > 0);
}

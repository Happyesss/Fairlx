import { createHmac, timingSafeEqual } from "node:crypto";

function base64UrlDecode(input: string): Buffer {
  const padded =
    input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (input.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

/**
 * Verify an HS256 JWT. Missing MCP_JWT_SECRET / AUTH_SECRET returns null
 * so hash-based secret tokens still work.
 */
export async function verifyMcpJwt(token: string): Promise<{ userId: string } | null> {
  const secret = process.env.MCP_JWT_SECRET || process.env.AUTH_SECRET;
  if (!secret) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerPart, payloadPart, signaturePart] = parts;

  try {
    const header = JSON.parse(base64UrlDecode(headerPart).toString("utf8")) as {
      alg?: string;
    };
    if (header.alg !== "HS256") return null;

    const expected = createHmac("sha256", secret)
      .update(`${headerPart}.${payloadPart}`)
      .digest();
    const actual = base64UrlDecode(signaturePart);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      return null;
    }

    const payload = JSON.parse(base64UrlDecode(payloadPart).toString("utf8")) as {
      sub?: string;
      userId?: string;
      exp?: number;
    };
    if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) {
      return null;
    }
    const userId = payload.sub || payload.userId;
    if (!userId || typeof userId !== "string") return null;
    return { userId };
  } catch {
    return null;
  }
}

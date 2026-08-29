import { INVALID_REQUEST, PARSE_ERROR, jsonRpcError } from "./errors";
import type { JsonRpcRequest, JsonRpcResponse } from "./types";
import { MCP_PROTOCOL_VERSIONS, PREFERRED_PROTOCOL_VERSION } from "./types";

export function parseJsonRpc(body: string): { request?: JsonRpcRequest; error?: JsonRpcResponse } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { error: jsonRpcError(null, PARSE_ERROR, "Parse error") };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { error: jsonRpcError(null, INVALID_REQUEST, "Invalid Request") };
  }

  const req = parsed as JsonRpcRequest;
  if (req.jsonrpc !== "2.0" || typeof req.method !== "string" || !req.method) {
    const id = (req as JsonRpcRequest).id ?? null;
    return { error: jsonRpcError(id, INVALID_REQUEST, "Invalid Request") };
  }

  return { request: req };
}

export function isNotification(req: JsonRpcRequest): boolean {
  return req.id === undefined;
}

export function negotiateProtocolVersion(requested?: string): string {
  if (requested && (MCP_PROTOCOL_VERSIONS as readonly string[]).includes(requested)) {
    return requested;
  }
  return PREFERRED_PROTOCOL_VERSION;
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function asBoolean(value: unknown): boolean {
  return value === true;
}

export function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === "string");
}

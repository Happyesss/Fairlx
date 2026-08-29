import type { JsonRpcFailure, JsonRpcId } from "./types";

export const PARSE_ERROR = -32700;
export const INVALID_REQUEST = -32600;
export const METHOD_NOT_FOUND = -32601;
export const INVALID_PARAMS = -32602;
export const INTERNAL_ERROR = -32603;
export const AUTH_ERROR = -32001;
export const FORBIDDEN_ERROR = -32003;
export const NOT_FOUND_ERROR = -32004;

export class McpError extends Error {
  readonly code: number;
  readonly data?: unknown;
  readonly httpStatus: number;

  constructor(code: number, message: string, options?: { data?: unknown; httpStatus?: number }) {
    super(message);
    this.name = "McpError";
    this.code = code;
    this.data = options?.data;
    this.httpStatus = options?.httpStatus ?? 200;
  }
}

export function authError(message = "Unauthorized"): McpError {
  return new McpError(AUTH_ERROR, message, { httpStatus: 401 });
}

export function forbiddenError(message = "Forbidden"): McpError {
  return new McpError(FORBIDDEN_ERROR, message, { httpStatus: 403 });
}

export function notFoundError(message = "Not found"): McpError {
  return new McpError(NOT_FOUND_ERROR, message, { httpStatus: 404 });
}

export function invalidParams(message: string, data?: unknown): McpError {
  return new McpError(INVALID_PARAMS, message, { data });
}

export function methodNotFound(method: string): McpError {
  return new McpError(METHOD_NOT_FOUND, `Method not found: ${method}`);
}

export function jsonRpcError(
  id: JsonRpcId,
  code: number,
  message: string,
  data?: unknown
): JsonRpcFailure {
  return {
    jsonrpc: "2.0",
    id,
    error: data === undefined ? { code, message } : { code, message, data },
  };
}

export function errorToRpc(id: JsonRpcId, error: unknown): JsonRpcFailure {
  if (error instanceof McpError) {
    return jsonRpcError(id, error.code, error.message, error.data);
  }
  const message = error instanceof Error ? error.message : "Internal error";
  return jsonRpcError(id, INTERNAL_ERROR, message);
}

#!/usr/bin/env tsx
/**
 * Local stdio MCP proxy. Speaks Content-Length (LSP/SDK) and newline-delimited JSON.
 * Forwards JSON-RPC to POST /api/mcp. This is not a second server.
 */
import process from "node:process";

const DEFAULT_URL = "https://app.fairlx.com/api/mcp";

const token = process.env.FAIRLX_API_TOKEN?.trim();
if (!token) {
  process.stderr.write("FAIRLX_API_TOKEN is required\n");
  process.exit(1);
}

const url = process.env.FAIRLX_API_URL?.trim() || DEFAULT_URL;

type Framing = "lsp" | "ndjson";

async function proxy(body: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body,
    });
    if (res.status === 202) return null;
    const text = await res.text();
    return text || null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Proxy error";
    return JSON.stringify({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32603, message },
    });
  }
}

function writeResponse(framing: Framing, payload: string) {
  if (framing === "lsp") {
    const data = Buffer.from(payload, "utf8");
    process.stdout.write(`Content-Length: ${data.length}\r\n\r\n`);
    process.stdout.write(data);
    return;
  }
  process.stdout.write(payload.endsWith("\n") ? payload : `${payload}\n`);
}

function findHeaderEnd(buf: Buffer): { index: number; size: number } | null {
  const crlf = buf.indexOf("\r\n\r\n");
  if (crlf >= 0) return { index: crlf, size: 4 };
  const lf = buf.indexOf("\n\n");
  if (lf >= 0) return { index: lf, size: 2 };
  return null;
}

function looksLikeLsp(buf: Buffer): boolean {
  const head = buf.subarray(0, Math.min(buf.length, 80)).toString("utf8").trimStart();
  return /^content-length:/i.test(head);
}

let buffer = Buffer.alloc(0);
let framing: Framing | null = null;
let chain = Promise.resolve();

function enqueue(fn: () => Promise<void>) {
  chain = chain.then(fn).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  });
}

function consume() {
  while (buffer.length > 0) {
    if (!framing) {
      framing = looksLikeLsp(buffer) ? "lsp" : "ndjson";
    }

    if (framing === "lsp") {
      const headerEnd = findHeaderEnd(buffer);
      if (!headerEnd) return;
      const header = buffer.subarray(0, headerEnd.index).toString("utf8");
      const match = header.match(/content-length:\s*(\d+)/i);
      if (!match) {
        buffer = buffer.subarray(headerEnd.index + headerEnd.size);
        continue;
      }
      const length = Number(match[1]);
      const start = headerEnd.index + headerEnd.size;
      if (buffer.length < start + length) return;
      const body = buffer.subarray(start, start + length).toString("utf8");
      buffer = buffer.subarray(start + length);
      const current = framing;
      enqueue(async () => {
        const response = await proxy(body);
        if (response) writeResponse(current, response);
      });
      continue;
    }

    const nl = buffer.indexOf("\n");
    if (nl < 0) return;
    const line = buffer.subarray(0, nl).toString("utf8").replace(/\r$/, "").trim();
    buffer = buffer.subarray(nl + 1);
    if (!line) continue;
    const current = framing;
    enqueue(async () => {
      const response = await proxy(line);
      if (response) writeResponse(current, response);
    });
  }
}

process.stdin.on("data", (chunk: Buffer | string) => {
  buffer = Buffer.concat([buffer, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)]);
  consume();
});

process.stdin.on("end", () => {
  enqueue(async () => {
    if (framing !== "lsp" && buffer.length > 0) {
      const line = buffer.toString("utf8").trim();
      buffer = Buffer.alloc(0);
      if (line) {
        const response = await proxy(line);
        if (response) writeResponse("ndjson", response);
      }
    }
  });
});

process.stdin.resume();

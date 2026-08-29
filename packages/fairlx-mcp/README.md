# @fairlx/mcp-server

One Fairlx MCP server with:

- Remote Streamable HTTP at `POST /api/mcp`
- Local stdio CLI that proxies JSON-RPC to that HTTP endpoint
- Skills, prompts, resources, and 40 tools

This package cannot import Next.js `@/` modules. The Next.js app injects an `McpRuntime` at bind time.

## Local stdio (Cursor / Claude Code)

```bash
export FAIRLX_API_URL=https://app.fairlx.com/api/mcp
export FAIRLX_API_TOKEN=flx_live_sec_...
npm run mcp
```

Or:

```bash
npx tsx packages/fairlx-mcp/src/cli/stdio.ts
```

`FAIRLX_API_TOKEN` is required. Missing token prints to stderr and exits 1.

Default `FAIRLX_API_URL` is `https://app.fairlx.com/api/mcp`.

The CLI speaks both Content-Length (LSP/SDK) framing and newline-delimited JSON.

## Remote MCP

```
POST /api/mcp
Authorization: Bearer <flx_live_sec_... or OAuth JWT>
Content-Type: application/json
```

Protocol: MCP `2026-07-28` (Streamable HTTP). Legacy HTTP+SSE is not implemented.

## Auth

- Tokens starting with `flx_` or `flx_live_sec_` are hashed (SHA-256) and looked up in `mcp_api_tokens`.
- Anything else is treated as an OAuth 2.1 JWT (`MCP_JWT_SECRET` or `AUTH_SECRET`).
- Unscoped tokens and OAuth JWTs inherit the actor's project role: write and delete tools are allowed when `resolveUserProjectAccess` grants them. Explicit token scopes remain an optional least-privilege ceiling.
- `tools/list` is filtered to those scopes and, for project-scoped tokens, the creator's current project permissions.

## Troubleshooting

- **401 / -32001**: missing or invalid bearer token.
- **403 / -32003**: token scopes or project RBAC denied the tool.
- **CONFIRMATION_REQUIRED**: destructive tools need `confirm: true` and a one-time `challengeToken` (120s, Redis, fail-closed).
- Rate limits fail open if Redis is down. Confirmation challenges fail closed.

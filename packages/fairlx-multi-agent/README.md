# @fairlx/multi-agent

Autonomous multi-agent hierarchy for Fairlx: a high-reasoning **Personal Agent** delegates to Planner, Builder, QA, and Reviewer sub-agents, then sleeps until they finish.

Implements [`docs/AUTONOMOUS_MULTI_AGENT_SYSTEM.md`](../../docs/AUTONOMOUS_MULTI_AGENT_SYSTEM.md) against the existing Fairlx HLD/LLD (context injection, MCP tool contracts, write-guard / challenge tokens, RBAC, git staging, metering).

## Run

```bash
npx tsx packages/fairlx-multi-agent/src/cli.ts --prompt "Fix mobile sidebar overflow and test it." --role tech_lead
```

```bash
npm run multi-agent -- --json
```

## Test

```bash
npx vitest run packages/fairlx-multi-agent
```

## Architecture

1. Orchestrator decomposes a goal into a DAG: planner → builder → QA → reviewer.
2. Parent status becomes `waiting_for_subagent` (sleep, $0 orchestrator tokens).
3. Workers run with least-privilege tool scopes and a bounded pool.
4. Child completion appends an inbox report and wakes the parent.
5. Verification gateway auto-applies safe work and issues a 120s challenge token for high-risk actions.

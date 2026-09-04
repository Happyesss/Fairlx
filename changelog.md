# Changelog

This file is generated on every `git commit` and `git push`. Do not edit it by hand.

Older session notes live in [docs/changelog-history.md](docs/changelog-history.md).

## Unreleased

Files in this commit:

- `.env.example`
- `packages/fairlx-mcp/src/runtime/output.test.ts`
- `packages/fairlx-mcp/src/runtime/output.ts`
- `packages/fairlx-mcp/src/tools/catalog.ts`
- `packages/fairlx-mcp/src/tools/write-work-item.test.ts`
- `packages/fairlx-mcp/src/tools/write.ts`
- `scripts/database-initialization/collections/agent-jobs.ts`
- `scripts/database-initialization/collections/agent-runs.ts`
- `scripts/database-initialization/db-helpers.test.ts`
- `scripts/database-initialization/lib/db-helpers.ts`
- `src/app/api/[[...route]]/route.ts`
- `src/features/agent/components/agent-plus-menu.tsx`
- `src/features/agent/lib/agent-core.test.ts`
- `src/features/agent/lib/attach-files.ts`
- `src/features/agent/lib/attachments.test.ts`
- `src/features/agent/lib/attachments.ts`
- `src/features/agent/lib/brain/brain.test.ts`
- `src/features/agent/lib/brain/compress.ts`
- `src/features/agent/lib/brain/definitions.ts`
- `src/features/agent/lib/brain/select.ts`
- `src/features/agent/lib/intent-compiler.test.ts`
- `src/features/agent/lib/intent-compiler.ts`
- `src/features/agent/lib/limits.test.ts`
- `src/features/agent/lib/limits.ts`
- `src/features/agent/lib/prompt.ts`
- `src/features/agent/lib/runs.ts`
- `src/features/agent/lib/runtime.ts`
- `src/features/agent/lib/session-context.ts`
- `src/features/agent/lib/tools.ts`
- `src/features/agent/lib/turn-errors.test.ts`
- `src/features/agent/lib/turn-errors.ts`
- `src/features/agent/server/route.ts`
- `src/features/agent/types.ts`

## Recent commits

| Date | Commit | Message | Author |
|------|--------|---------|--------|
| 2026-09-04 | `13c0f8e` | feat: add Fairlx Agent harness with plugins, GitHub PRs, and isolated jobs | ANCIENTINSANE |
| 2026-09-03 | `3426bbe` | chore: bump version to 0.2.93 [skip ci] | github-actions[bot] |
| 2026-09-04 | `5c99783` | Merge pull request #298 from Happyesss/main | Shashank Kumar Rathour |
| 2026-09-03 | `5c24ef5` | chore: bump version to 0.2.92 [skip ci] | github-actions[bot] |
| 2026-09-04 | `16f1b6d` | feat: implement personalized agent training workflows, task prioritization, and project team management tools. | Happyesss |
| 2026-09-03 | `ab595ff` | chore: bump version to 0.2.91 [skip ci] | github-actions[bot] |
| 2026-09-03 | `b8eb6dd` | refactor: standardize priority UI logic and introduce modular project-based quick actions for agent commands | Happyesss |
| 2026-09-02 | `7cf95d2` | chore: bump version to 0.2.90 [skip ci] | github-actions[bot] |
| 2026-09-03 | `6661845` | feat: introduce personal agent functionality with new tools, update environment configurations, and enhance agent run management | Happyesss |
| 2026-09-01 | `9f29adb` | chore: bump version to 0.2.89 [skip ci] | github-actions[bot] |
| 2026-09-02 | `3481abe` | Merge pull request #297 from Happyesss/main | Shashank Kumar Rathour |
| 2026-09-01 | `b14b78f` | chore: bump version to 0.2.88 [skip ci] | github-actions[bot] |
| 2026-09-02 | `36d43ba` | refactor: add runtime-scoped run management to AgentScopeBar and conditionally toggle Grok availability based on environment configuration | Happyesss |
| 2026-09-01 | `531c9d9` | chore: bump version to 0.2.87 [skip ci] | github-actions[bot] |
| 2026-09-02 | `2ba8883` | Merge pull request #296 from Happyesss/main | Shashank Kumar Rathour |
| 2026-09-01 | `b37fa04` | chore: bump version to 0.2.86 [skip ci] | github-actions[bot] |
| 2026-09-02 | `e791b19` | feat: add workspace member removal, implement intent compiler for work item queries, and introduce agent-side member/work-item table components. | Happyesss |
| 2026-09-01 | `9f76456` | chore: bump version to 0.2.85 [skip ci] | github-actions[bot] |
| 2026-09-01 | `a3a5d2e` | feat: add Grok 4.6 support, introduce run deletion confirmation, and refine MCP work item pagination and polling logic. | Happyesss |
| 2026-09-01 | `589cab6` | chore: bump version to 0.2.84 [skip ci] | github-actions[bot] |
| 2026-09-01 | `05ee50e` | feat: add collapsible navigation sections to agent app shell and remove unused model picker and mode switcher | Happyesss |
| 2026-09-01 | `950b4f7` | chore: bump version to 0.2.83 [skip ci] | github-actions[bot] |
| 2026-09-01 | `ebccefa` | Merge pull request #295 from Happyesss/main | Shashank Kumar Rathour |
| 2026-09-01 | `41cd28d` | chore: bump version to 0.2.82 [skip ci] | github-actions[bot] |
| 2026-09-01 | `af9d275` | refactor: implement adaptive message truncation logic with priority for assistant content and add comprehensive test suite for tool loops and state management | Happyesss |
| 2026-08-31 | `bce5065` | chore: bump version to 0.2.81 [skip ci] | github-actions[bot] |
| 2026-09-01 | `c10f872` | Merge pull request #294 from Happyesss/main | Shashank Kumar Rathour |
| 2026-08-31 | `c2d53c1` | chore: bump version to 0.2.80 [skip ci] | github-actions[bot] |
| 2026-09-01 | `c3c8fda` | feat: add workspace member management and user profile lookup to MCP runtime | Happyesss |
| 2026-08-31 | `9b686e2` | chore: bump version to 0.2.79 [skip ci] | github-actions[bot] |
| 2026-09-01 | `fd92b85` | feat: add project selection to workflow view and exclude internal servers from external MCP counts | Happyesss |
| 2026-08-31 | `ae4218a` | chore: bump version to 0.2.78 [skip ci] | github-actions[bot] |
| 2026-09-01 | `8a1701e` | refactor: update agent dashboard UI components to use standardized design system tokens and typography | Happyesss |
| 2026-08-31 | `a91edfc` | chore: bump version to 0.2.77 [skip ci] | github-actions[bot] |
| 2026-09-01 | `41bee0b` | Merge pull request #293 from Happyesss/main | Shashank Kumar Rathour |
| 2026-08-31 | `9121a98` | chore: bump version to 0.2.76 [skip ci] | github-actions[bot] |
| 2026-09-01 | `263ce1f` | refactor: improve performance with useMemo hooks, strengthen agent runtime type safety, and update deployment environment variables. | Happyesss |
| 2026-08-31 | `b359c75` | chore: bump version to 0.2.75 [skip ci] | github-actions[bot] |
| 2026-08-31 | `bdab4c8` | Merge pull request #292 from ANCIENTINSANE/main | Shashank Kumar Rathour |
| 2026-08-31 | `fd1ef9c` | Changes — harness staging (paths, status, branch) | ANCIENTINSANE |
| 2026-08-31 | `a095820` | feat: expand agent harness with specialists, MCP, and chat ops | ANCIENTINSANE |
| 2026-08-31 | `a83ccf3` | fix: keep agent workflow live while model turns run in the background | ANCIENTINSANE |
| 2026-08-31 | `c54459b` | chore: bump version to 0.2.74 [skip ci] | github-actions[bot] |
| 2026-08-31 | `45ab287` | Merge pull request #291 from ANCIENTINSANE/main | Shashank Kumar Rathour |
| 2026-08-31 | `8050192` | feat: replace static agent dashboard with live harness screens and run loop | ANCIENTINSANE |
| 2026-08-31 | `bc96244` | fix: add targeted setup for agent MCP and AI Appwrite collections | ANCIENTINSANE |
| 2026-08-31 | `527582e` | feat: seed Azure Grok 4.6 and DeepSeek V4 Flash as agent platform models | ANCIENTINSANE |
| 2026-08-30 | `6cbc2cb` | feat: add agent MCP servers and AI model configuration | ANCIENTINSANE |
| 2026-08-30 | `5ef28b8` | chore: bump version to 0.2.73 [skip ci] | github-actions[bot] |
| 2026-08-30 | `a44a939` | Merge pull request #290 from ANCIENTINSANE/main | Shashank Kumar Rathour |
| 2026-08-30 | `3fd5675` | Merge branch 'stemlen:main' into main | Surendra Codes |
| 2026-08-30 | `2709267` | chore: bump version to 0.2.72 [skip ci] | github-actions[bot] |
| 2026-08-30 | `2d5db2e` | Merge pull request #289 from Happyesss/main | Shashank Kumar Rathour |
| 2026-08-30 | `15a2169` | chore: bump version to 0.2.71 [skip ci] | github-actions[bot] |
| 2026-08-30 | `e490237` | feat: add support for subtask, saved view, and webhook management tools to MCP registry | Happyesss |
| 2026-08-30 | `904542e` | Merge branch 'stemlen:main' into main | Shashank Kumar Rathour |
| 2026-08-29 | `a9b20be` | chore: bump version to 0.2.71 [skip ci] | github-actions[bot] |
| 2026-08-30 | `95d3471` | Merge pull request #288 from Happyesss/main | Shashank Kumar Rathour |
| 2026-08-29 | `f9946da` | chore: bump version to 0.2.70 [skip ci] | github-actions[bot] |
| 2026-08-30 | `f26a57b` | feat: implement Model Context Protocol (MCP) server package and workspace integration panel | Happyesss |
| 2026-08-28 | `5cc9f57` | fix: align org usage costs to USD billing with local display currency | ANCIENTINSANE |
| 2026-08-28 | `1fa59fc` | chore: bump version to 0.2.69 [skip ci] | github-actions[bot] |
| 2026-08-28 | `16d13e5` | Merge pull request #287 from ANCIENTINSANE/main | Shashank Kumar Rathour |
| 2026-08-28 | `3a527cd` | Merge branch 'stemlen:main' into main | Surendra Codes |
| 2026-08-28 | `34fb666` | fix: load organization audit logs on /organization | ANCIENTINSANE |
| 2026-08-28 | `7ca56a1` | chore: bump version to 0.2.68 [skip ci] | github-actions[bot] |
| 2026-08-28 | `7881912` | Merge pull request #286 from Happyesss/main | Shashank Kumar Rathour |
| 2026-08-28 | `cf0bec8` | chore: bump version to 0.2.67 [skip ci] | github-actions[bot] |
| 2026-08-28 | `e535814` | refactor: remove codebase QA feature and associated GitHub integration modules | Happyesss |
| 2026-08-28 | `28a345f` | fix: resolve Invoices View All 404 for organization billing | ANCIENTINSANE |
| 2026-08-28 | `cded1dd` | chore: bump version to 0.2.66 [skip ci] | github-actions[bot] |
| 2026-08-28 | `47f5602` | Merge pull request #285 from ANCIENTINSANE/main | Shashank Kumar Rathour |
| 2026-08-28 | `975cf12` | fix: implement Timeline PNG and PDF export via canvas Gantt renderer | ANCIENTINSANE |
| 2026-08-28 | `942694e` | fix: accept Appwrite Document in department permission parser | ANCIENTINSANE |
| 2026-08-28 | `64d9c95` | fix: align department member/permission writes with live Appwrite schema | ANCIENTINSANE |
| 2026-08-28 | `5c0dd5c` | fix: restore core pages for members and return JSON on department create errors | ANCIENTINSANE |
| 2026-08-04 | `8dae912` | fix: resolve AZURE_HOST resolution by fallback to secrets.AZURE_HOST | ANCIENTINSANE |
| 2026-08-04 | `21c837a` | fix: correct deploy user/path, add standalone build support, fail-fast health check | ANCIENTINSANE |
| 2026-08-04 | `18fbb45` | ci: update deployment workflow name to Azure Cloud VM | ANCIENTINSANE |
| 2026-07-27 | `354ca26` | chore: bump version to 0.2.65 [skip ci] | github-actions[bot] |
| 2026-07-27 | `81d9f8a` | Merge pull request #284 from ANCIENTINSANE/main | Surendra Codes |
| 2026-07-27 | `89af89e` | Merge branch 'stemlen:main' into main | Surendra Codes |
| 2026-07-27 | `64cf484` | fix: team membership/permission changes don’t bust the 10‑minute access cache, and team permission queries can truncate past Appwrite’s default limit of 25 | ANCIENTINSANE |
| 2026-07-27 | `e2929d2` | chore: bump version to 0.2.64 [skip ci] | github-actions[bot] |
| 2026-07-27 | `19d99c2` | Merge pull request #283 from ANCIENTINSANE/main | Surendra Codes |
| 2026-07-27 | `fcc4216` | Merge branch 'stemlen:main' into main | Surendra Codes |
| 2026-07-22 | `68576eb` | Added a backing session and an enhancer to the UI design. | ANCIENTINSANE |
| 2026-07-22 | `762e435` | Added a backing session and an enhancer to the UI design. | ANCIENTINSANE |
| 2026-07-21 | `fa0a12a` | Slack code test and integrate all applications: - Slack - discord - gitlab - bitbucket - custom MCP servers - Claude Code - codex | ANCIENTINSANE |
| 2026-06-22 | `9961e7f` | chore: bump version to 0.2.63 [skip ci] | github-actions[bot] |
| 2026-06-23 | `1a5fa62` | Merge pull request #277 from ANCIENTINSANE/main | Surendra Codes |
| 2026-06-23 | `445856c` | lyf-cycle fix | ANCIENTINSANE |
| 2026-06-22 | `c9b9a29` | chore: bump version to 0.2.62 [skip ci] | github-actions[bot] |
| 2026-06-23 | `2d54295` | Merge pull request #276 from ANCIENTINSANE/main | Surendra Codes |
| 2026-06-23 | `ab54b8e` | lyf-cycle fix | ANCIENTINSANE |
| 2026-06-22 | `7469e81` | chore: bump version to 0.2.61 [skip ci] | github-actions[bot] |
| 2026-06-22 | `262cb75` | Merge pull request #275 from ANCIENTINSANE/main | Surendra Codes |
| 2026-06-22 | `7540e3a` | Fix typescript error in image-sync.test.ts | ANCIENTINSANE |
| 2026-06-22 | `e9daecf` | lyf-cycle fix | ANCIENTINSANE |
| 2026-06-22 | `bddb158` | Merge pull request #51 from ANCIENTINSANE/dev | Surendra Codes |

Last generated: 2026-09-04T20:24:01.211Z

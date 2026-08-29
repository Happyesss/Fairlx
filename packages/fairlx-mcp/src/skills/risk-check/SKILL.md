---
name: risk-check
description: Find blockers, cycles, and delivery risk
---

# Risk check

Identify delivery risk before a sprint review or release.

## Steps
1. `fairlx_link_list` and inspect BLOCKS edges. Cycle detection uses targetItemId only.
2. `fairlx_work_item_list` for flagged items, URGENT priority, and stale IN_PROGRESS.
3. `fairlx_agent_context_get` on the top 5 risks.
4. Report: blockers, possible cycles, overloaded assignees, missing estimates.

Do not delete links or complete the sprint unless asked (those need confirmation).

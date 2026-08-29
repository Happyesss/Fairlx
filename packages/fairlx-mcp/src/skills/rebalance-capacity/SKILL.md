---
name: rebalance-capacity
description: Rebalance sprint load across assignees
---

# Rebalance capacity

Move work so no assignee is overloaded relative to story points.

## Steps
1. `fairlx_sprint_get` / active sprint list.
2. `fairlx_work_item_list` for the sprint; group by assigneeIds and sum storyPoints.
3. Propose moves. Prefer unstarted TODO items.
4. Apply with `fairlx_work_item_update` or `fairlx_work_item_bulk_update` (confirm:true). Do not change DONE items.

Respect existing BLOCKS links — do not assign a blocked item as if it were ready.

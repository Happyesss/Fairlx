---
name: standup
description: Generate a daily standup from the active sprint
---

# Standup

Produce yesterday / today / blockers for the active sprint.

## Steps
1. `fairlx_sprint_list` status=ACTIVE.
2. `fairlx_work_item_list` for that sprintId.
3. For IN_PROGRESS and IN_REVIEW items, `fairlx_comment_list` (recent).
4. Summarize per assignee. Call out BLOCKS links via `fairlx_link_list`.

Keep it under one page. No writes.

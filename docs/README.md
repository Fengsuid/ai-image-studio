# Documentation

This directory only tracks product-facing planning material that is useful for future development.

## Active planning documents

- `PROJECT_PROGRESS_STATUS.md`: current handoff status; use this first for completion state, active task, and next steps.
- `IMAGE_STUDIO_UNIFIED_MASTER_PLAN.md`: unified product and implementation plan; primary reference for "what to build next".
- `IMAGE_STUDIO_CANVAS_RANKING_PROMPT_DEVELOPMENT_PLAN.md`: canvas workspace, leaderboard, prompt database, and gallery reliability development plan; tracks landed milestones and pending feedback.
- `IMAGE_STUDIO_MOBILE_WEB_OPTIMIZATION_PLAN.md`: mobile web layout and interaction optimization plan for home, chat, gallery, editor, works, and QA screenshot coverage.
- `IMAGE_STUDIO_AGENT_PLAYGROUND_IMPROVEMENT_PLAN.md`: next-stage improvement plan inspired by `gpt_image_playground`, focused on persistent generation queues, Agent creation workflows, provider diagnostics, IndexedDB caching, and frontend modularization.
- `IMAGE_STUDIO_TRELLIS_TASK_ALLOCATION.md`: Trellis board allocation table; maps all active development tasks, lanes, statuses, and legacy T016-T031 aliases.
- `IMAGE_STUDIO_RELLIS_TASKS.md`: Rellis/Trellis task-spec archive; useful for task descriptions, but current completion state is superseded by `PROJECT_PROGRESS_STATUS.md` and `IMAGE_STUDIO_TRELLIS_TASK_ALLOCATION.md`.
- `IMAGE_STUDIO_QA_RELEASE_CHECKLIST.md`: local and production smoke checks, screenshot checklist, release record, and rollback steps.
- `mobile-qa/visual-regression/README.md`: visual regression smoke harness, baseline promotion, diff thresholds, and screenshot cleanup rules.

## Design references

- `IMAGE_STUDIO_FRONTEND_ADMIN_DESIGN.md`: front-end and admin-console design notes; merged into the unified master plan and partially implemented through subsequent canvas/admin batches.

## Status legend

- "Current handoff": authoritative for current completion state; supersedes stale backlog labels in older planning documents.
- "Active": kept current; new feedback and progress are appended here first.
- "Design reference": the original design intent is preserved; per-section status updates are tracked at the top of the document and inside the unified master plan.
- "Task-spec archive": original task breakdown text is preserved; old `Ready` / `Backlog` suggestions are historical unless repeated in the current handoff.

## Excluded from this repository

Local deployment logs, server validation notes, private domain checks, and historical archive notes are intentionally excluded from the GitHub repository. They live in `docs/private/` in the local workspace and are filtered by `.gitignore` (see the project root `.gitignore` and `.git/info/exclude`).

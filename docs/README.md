# Documentation

This directory only tracks product-facing planning material that is useful for future development.

## Active planning documents

- `IMAGE_STUDIO_UNIFIED_MASTER_PLAN.md`: unified product and implementation plan; primary reference for "what to build next".
- `IMAGE_STUDIO_CANVAS_RANKING_PROMPT_DEVELOPMENT_PLAN.md`: canvas workspace, leaderboard, prompt database, and gallery reliability development plan; tracks landed milestones and pending feedback.
- `IMAGE_STUDIO_TRELLIS_TASK_ALLOCATION.md`: Trellis board allocation table; maps all active development tasks, lanes, statuses, and legacy T016-T031 aliases.
- `IMAGE_STUDIO_RELLIS_TASKS.md`: Rellis/Trellis-ready task breakdown for the current development plan.
- `IMAGE_STUDIO_QA_RELEASE_CHECKLIST.md`: local and production smoke checks, screenshot checklist, release record, and rollback steps.

## Design references

- `IMAGE_STUDIO_FRONTEND_ADMIN_DESIGN.md`: front-end and admin-console design notes; merged into the unified master plan and partially implemented through subsequent canvas/admin batches.

## Status legend

- "Active": kept current; new feedback and progress are appended here first.
- "Design reference": the original design intent is preserved; per-section status updates are tracked at the top of the document and inside the unified master plan.

## Excluded from this repository

Local deployment logs, server validation notes, private domain checks, and historical archive notes are intentionally excluded from the GitHub repository. They live alongside this directory in the local workspace but are filtered by `.gitignore` (see the project root `.gitignore` and `.git/info/exclude`).

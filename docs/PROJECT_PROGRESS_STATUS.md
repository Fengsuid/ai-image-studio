# Project Progress Status

Updated: 2026-07-28

This is the current handoff entry point for project progress. Older planning documents keep historical design detail, but this file reflects the local Trellis board, Git state, and current working tree.

> **2026-07-28 Quality Hardening Closeout** — `AIS-RLS-161`, `AIS-RLS-162`, `AIS-RLS-173`, `AIS-RLS-174`, and `AIS-RLS-175` are complete. Root Vitest collects Canvas Core tests in CI; the default check gate grows from 8 to 24 deterministic smoke commands; Agent generation is bound to the confirmed latest server plan; model enrichment has a 12-second deterministic fallback; and all affected authenticated Agent smokes pass on `APP_VERSION=20260728-agent-smoke-confirm-v1`. `AIS-RLS-176` closes the public/private evidence and status-documentation gap without rewriting the already-pushed implementation commits.

> **2026-06-19 Audit Record** — Session `019edd5f-b1d0-7842-8142-1775bdbf84de` audited. Full record: `docs/private/AUDIT_codex-session-019edd5f_20260619_4c9c2d8.md`. Result: **0 含水分 / 0 需重做**. AIS-RLS-136 和 AIS-RLS-138 五关全过；AIS-RLS-118/AIS-RLS-139 阻塞状态合理。HEAD `4c9c2d8`，工作树干净。
>
> **2026-06-19 Terminal Handoff** — Trellis has been advanced until every task is either `done` or `blocked`. Current HEAD is `4c9c2d8` on `main` / `origin/main`. `AIS-RLS-118` and `AIS-RLS-139` were moved from `active` to `blocked` by operator decision because their remaining acceptance items require external evidence: 48h CSP report-volume proof for `AIS-RLS-118`, and actual-device mobile QA matrix proof for `AIS-RLS-139`. No implementation task is currently startable.
>
> **2026-07-02 Maintenance Resume** — Board was rechecked after inactivity. `AIS-RLS-154` through `AIS-RLS-158` were implemented and locally closed. `AIS-RLS-118` and `AIS-RLS-139` remain external-evidence blockers, and `AIS-RLS-159` remains blocked by the Canvas v2 30-day no-regression gate. Live API/database gaps that require local admin credentials, a running server, or MySQL access are documented in `docs/IMAGE_STUDIO_QA_RELEASE_CHECKLIST.md`. No implementation task is currently startable.
>
> **2026-05-26 Documentation Lane Update** — `AIS-RLS-131` expanded the public changelog and contributor guide, and `AIS-RLS-128` adds the roadmap Mermaid gantt in `docs/IMAGE_STUDIO_FOLLOWUP_OPTIMIZATION_PLAN_202605.md` §6.1. Runtime and deployment details remain in their dedicated release/checklist documents.
>
> **2026-05-25 Handoff Note** — read before resuming work.
>
> The previous Codex session (`019e5a5e-651d-7c31-a9c0-11f4bfdb63d9`) was audited and reconciled on 2026-05-25. Full record: `docs/private/CODEX_SESSION_AUDIT_20260524_019e5a5e.md`. Key items the next agent must respect:
>
> - **`AIS-RLS-105` is complete** as of commits `b0043f0` and `8bfdc4b`. The wrapper-only draft was not reused; legacy admin route files were deleted and replaced by real `src/routes/admin/*` business-domain modules.
> - **`AIS-RLS-107` is complete** as of commits `f449a01` and `f3e2ece`. `public/app-auth.js` is now a real 690-line auth controller module, `public/app.js` is down to 6623 lines, and production `/api/version` reports `20260525-app-auth-split-v1`.
> - **`AIS-RLS-108` is complete** as of commit `fc93f17`. `public/app-settings.js` is now a real settings controller module, `public/app.js` is down to 5929 lines, and production `/api/version` reports `20260525-app-settings-split-v1`.
> - **`AIS-RLS-109` is complete** as of commit `987ab86`. `.github/workflows/check.yml` now runs GitHub Actions on `push` / `pull_request` to `main` with Node `20.20.2`, `npm ci`, `npm run check`, and `npm test --if-present`.
> - **`AIS-RLS-110` is complete** as of commit `489a9a6`. `npm run frontend:build` now emits `public/dist/app.a4dfaf24076c.css`, the public homepage loads one local hashed CSS bundle, and production `/api/version` reports `20260525-css-bundle-v1`.
> - **`AIS-RLS-111` is complete** as of commit `ae6cf24`. Public homepage JS now loads from content-hashed `/dist/<name>.<hash>.js` assets without manual `?v=` query strings, and production `/api/version` reports `20260525-js-bundle-v1`.
> - **`AIS-RLS-099` ESLint rules** were landed as all-`warn`, which means `npm run check` can still pass with lint warnings. `AIS-RLS-130` should tighten `no-undef` / `no-unused-vars` / `no-empty` to `error`.
> - **`archive/codex-handoff-20260524/`** holds three Codex draft artifacts (admin wrapper, CI workflow `check.yml`, `14-premium-polish.css`). They are reference-only; do not `git add` directly. The directory is under `.gitignore` (`/archive/`).
> - **`AIS-RLS-106` is complete** as of commit `74babe1`. `src/mysql-store.js` now builds the store facade from ordered export groups with a collision guard, and production `/api/version` reports `20260525-mysql-store-facade-v1`.
> - **Working tree was clean after the audit** at `8769d85`; subsequent completed work has advanced `main` through `AIS-RLS-109`.
> - **Recommended cadence**: one task at a time, with audit §7.2 ordering (105 redo → 106 → 107 → 108 → 109). Stop and report after each task instead of batch-closing.

## Source Of Truth

- Trellis task state: `D:\生图广场\.trelis\tasks`
- Release and smoke checklist: `docs/IMAGE_STUDIO_QA_RELEASE_CHECKLIST.md`
- Current implementation repository: `D:\生图广场\remote-edit`
- Latest implementation baseline: current `main` / `origin/main`, including the Quality & Stability Hardening work through `AIS-RLS-176`.

## Current Summary

- Trellis total: 207 tasks.
- Done: 195 tasks.
- Blocked: 3 tasks (`AIS-RLS-118`, `AIS-RLS-139`, `AIS-RLS-159`).
- Active / review tasks: 0.
- Backlog tasks: 9 (`AIS-RLS-163` ~ `AIS-RLS-171`).
- Ready/executable tasks: 4 (`AIS-RLS-163`, `AIS-RLS-164`, `AIS-RLS-167`, `AIS-RLS-168`).
- Working tree handoff: implementation and release evidence are committed through `AIS-RLS-176`; local deployment archives are disposable and excluded from Git.
- Current blocker class: external acceptance evidence (`118`, `139`), the Canvas v1 archive time/regression gate (`159`), and dependency-gated backlog items (`165`, `166`, `169`, `170`, `171`).

## AIS-RLS-100~176 Status Snapshot

| Group | Board status | Count | Tasks |
| --- | --- | ---: | --- |
| Completed implementation / docs / QA tasks | Done | 66 | `AIS-RLS-100` ~ `AIS-RLS-117`, `AIS-RLS-119` ~ `AIS-RLS-138`, `AIS-RLS-140` ~ `AIS-RLS-158`, `AIS-RLS-160` ~ `AIS-RLS-162`, `AIS-RLS-172` ~ `AIS-RLS-176` |
| External/product evidence blockers | Blocked | 3 | `AIS-RLS-118`, `AIS-RLS-139`, `AIS-RLS-159` |
| Ready backlog | Backlog | 4 | `AIS-RLS-163`, `AIS-RLS-164`, `AIS-RLS-167`, `AIS-RLS-168` |
| Dependency-gated backlog | Backlog | 5 | `AIS-RLS-165`, `AIS-RLS-166`, `AIS-RLS-169`, `AIS-RLS-170`, `AIS-RLS-171` |
| Storage follow-ups | Done | 3 | `AIS-RLS-156`, `AIS-RLS-157`, `AIS-RLS-158` |

Dependency note: the `task.py list` `ready` column only reflects dependency satisfaction. A task with `status=blocked` and `ready=yes` is still not startable until its blocker is removed.

## Completed Milestones

| Range | Status | Scope |
| --- | --- | --- |
| `AIS-RLS-001` - `AIS-RLS-007` | Done | Gallery reliability, share/detail routes, leaderboard base, image fallback. |
| `AIS-RLS-008` - `AIS-RLS-014` | Done | Prompt taxonomy, remote prompt sources, prompt likes/sort, duplicate review. |
| `AIS-RLS-015` - `AIS-RLS-025` | Done | Canvas v1 MVP, project APIs, node/edge model, generation, autosave, publish. |
| `AIS-RLS-026` - `AIS-RLS-039` | Done | Canvas enhancements and module boundary cleanup. |
| `AIS-RLS-040` - `AIS-RLS-047` | Done | Generation flicker, result actions, gallery detail/tags, canvas layout/edges. |
| `AIS-RLS-048` - `AIS-RLS-054` | Done | Canvas v2 migration, build, API adapter, editor, generation, entry switch, release QA. |
| `AIS-RLS-055` - `AIS-RLS-060` | Done | Mobile web baseline, home/nav/composer, chat, gallery, editor, QA closure. |
| `AIS-RLS-061` - `AIS-RLS-069` | Done | Queue recovery, provider diagnostics/capabilities, Agent workspace, creative route unification. |
| `AIS-RLS-070` - `AIS-RLS-079` | Done | CSS tokens, CSS split, dark mode, admin/app module split, backend/store split, frontend build tooling, visual polish. |
| `AIS-RLS-080` - `AIS-RLS-093` | Done | Responsive polish, frontend guardrails, route/store extraction, accessibility, onboarding, prompt library, admin shell, performance budget, visual regression QA harness. |
| `AIS-RLS-094` - `AIS-RLS-117` | Done | Phase A documentation/baseline cleanup, lint/check tooling foundation, route/store/app extraction, GitHub Actions CI, CSS/JS content-hash assets, local font/icon/hero media assets, mobile CSS consolidation, shared animations, unified list skeletons, and lazy-loaded admin/canvas route entry. |
| `AIS-RLS-128`, `AIS-RLS-131` | Done | Roadmap dependency graph, public changelog expansion, and contributor guide expansion. |
| `AIS-RLS-119` - `AIS-RLS-127`, `AIS-RLS-129` - `AIS-RLS-138`, `AIS-RLS-140` - `AIS-RLS-158`, `AIS-RLS-160` | Done | Product Phase D, platform hardening, accessibility/error monitoring, visual redesign, slice extraction, agent/canvas smoke coverage, Canvas/Agent feature completion, storage optimization, migration consolidation, and hashed-entry smoke migration. |
| `AIS-RLS-161` - `AIS-RLS-162`, `AIS-RLS-172` - `AIS-RLS-176` | Done | Canvas Core test collection, CI smoke coverage expansion, Agent/Canvas usability refresh, Agent plan confirmation integrity, planner timeout fallback, authenticated smoke ordering, and release-evidence closeout. |

## Backlog Milestones (Planned)

| Range | Status | Scope |
| --- | --- | --- |
| `AIS-RLS-118` | Blocked | CSP enforce rollout has code/deploy records, but still needs 48h CSP report-volume evidence returning to background-noise level before finish. |
| `AIS-RLS-139` | Blocked | Mobile consolidation has automated/release records, but still needs actual-device QA evidence for iOS 17 Safari, Android 14 Chrome, Pixel 6 Chrome, and iPad Air Safari. |
| `AIS-RLS-159` | Blocked | Canvas v1 archive remains blocked by the v2 30-day no-regression evidence gate after `AIS-RLS-154`. |
| `AIS-RLS-163` - `AIS-RLS-171` | Backlog | Canvas v1 regression automation, app.js gallery/generation split, resumable generation, persistent rate limits, multi-candidate design, and external-evidence automation follow-ups. |

## Active Task

| Task | Status | What Is Implemented | Remaining Closure |
| --- | --- | --- | --- |
| None | Ready for next task | CI smoke coverage expansion and the prior quality-hardening closeout are complete. | Start `AIS-RLS-163`, the smallest ready backlog task, and continue serially. |

## Documentation Notes

- `IMAGE_STUDIO_FOLLOWUP_OPTIMIZATION_PLAN_202605.md` is the active follow-up roadmap covering `AIS-RLS-094` ~ `AIS-RLS-129` (P0/P1/P2/P3 issues, 30-PR sequence, risk matrix, and metrics dashboard). It is the authoritative source for what "done" means on each remaining task.
- `docs/private/CODEX_SESSION_AUDIT_20260524_019e5a5e.md` records the 2026-05-25 audit of the previous Codex session, including which closed tasks are real, which are placeholder, and the handoff cleanup that was performed. Read this before resuming work.
- `IMAGE_STUDIO_OPTIMIZATION_DEVELOPMENT_PLAN.md` is now a historical roadmap plus backlog proposal document. Its earlier Ready/Backlog labels for `AIS-RLS-039` through `AIS-RLS-060` are superseded by this file and the Trellis board.
- `IMAGE_STUDIO_TRELLIS_TASK_ALLOCATION.md` is the task allocation table and has been updated with post-060 task status.
- `IMAGE_STUDIO_RELLIS_TASKS.md` is a historical task-spec archive. Use its task descriptions for context, not its older suggested Ready/Backlog labels.
- `IMAGE_STUDIO_FRONTEND_ADMIN_DESIGN.md` is a design reference. Its top implementation index has been recalibrated, but detailed body sections still preserve original 2026-05-18 design wording.
- `IMAGE_STUDIO_CANVAS_V2_MIGRATION_PLAN.md` remains the Canvas v2 implementation reference; its status section should be read as completed first-phase migration plus ongoing quality hardening.

## Immediate Next Steps

1. Start `AIS-RLS-163` and automate collection of the Canvas v1 30-day no-regression evidence required by `AIS-RLS-159`.
2. Continue the other dependency-ready backlog in priority order: `AIS-RLS-164`, `AIS-RLS-167`, then `AIS-RLS-168`.
3. Keep `AIS-RLS-118`, `AIS-RLS-139`, and `AIS-RLS-159` blocked until their external/time-gated evidence is available; `AIS-RLS-170` and `AIS-RLS-171` remain dependency-gated by those blockers.
4. For every task, follow `docs/private/DEVELOPMENT_GUIDE.md` §2 ~ §7 for validation, release record, private deployment log, and Trellis close-out.

# Project Progress Status

Updated: 2026-05-26

This is the current handoff entry point for project progress. Older planning documents keep historical design detail, but this file reflects the local Trellis board, Git state, and current working tree.

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
- Latest implementation baseline: current `main` / `origin/main`; Phase B route extraction, CI check workflow, CSS/JS content-hash assets, CDN-domain reduction, mobile CSS consolidation, shared animations, unified skeletons, documentation expansion, and slice smoke work have been tracked through `AIS-RLS-131` plus the `AIS-RLS-147` ~ `AIS-RLS-153` lane.

## Current Summary

- Trellis total: 191 tasks.
- Done after `AIS-RLS-128` close-out: 154 tasks.
- Review: 1 task (`AIS-RLS-153`).
- Ready: 29 tasks in the local board, including product Phase D, platform hardening, documentation/spec work, visual redesign, and hashed-entry smoke migration.
- Blocked: 7 tasks in the local board (`AIS-RLS-151`, `AIS-RLS-154` ~ `AIS-RLS-159`).
- Working tree handoff: follow-up optimization work has continued through `AIS-RLS-116` for the B/C deployment single-entry lane, `AIS-RLS-131` for public docs, and `AIS-RLS-147` ~ `AIS-RLS-153` for canvas/agent slice extraction plus smoke coverage. `AIS-RLS-117` remains the next runtime refactor in the original lazy-load chain; `AIS-RLS-129` remains the next documentation feature-spec task in this side lane.

## AIS-RLS-100~159 Status Snapshot

| Group | Board status | Count | Tasks |
| --- | --- | ---: | --- |
| Route/store/app/build/docs completed | Done | 24 | `AIS-RLS-100` ~ `AIS-RLS-116`, `AIS-RLS-128`, `AIS-RLS-131`, `AIS-RLS-147` ~ `AIS-RLS-150`, `AIS-RLS-152` |
| Product/platform/docs/visual queue | Ready | 28 | `AIS-RLS-117` ~ `AIS-RLS-127`, `AIS-RLS-129`, `AIS-RLS-130`, `AIS-RLS-132` ~ `AIS-RLS-146` |
| Canvas smoke closure | Review | 1 | `AIS-RLS-153` |
| Slice/storage/archive follow-ups | Blocked | 7 | `AIS-RLS-151`, `AIS-RLS-154` ~ `AIS-RLS-159` |

Dependency note: Trellis `status=ready` is not identical to startable work. `AIS-RLS-122`, `AIS-RLS-126`, and `AIS-RLS-134` ~ `AIS-RLS-146` still have explicit dependency gates even though their board status is `ready`.

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
| `AIS-RLS-094` - `AIS-RLS-116` | Done | Phase A documentation/baseline cleanup, lint/check tooling foundation, route/store/app extraction, GitHub Actions CI, CSS/JS content-hash assets, local font/icon/hero media assets, mobile CSS consolidation, shared animations, and unified list skeletons. |
| `AIS-RLS-128`, `AIS-RLS-131` | Done | Roadmap dependency graph, public changelog expansion, and contributor guide expansion. |
| `AIS-RLS-147` - `AIS-RLS-150`, `AIS-RLS-152` | Done | Canvas/agent backend slice extraction, agent workspace normalization, slice interface contracts, and agent smoke coverage. |
| `AIS-RLS-153` | Review | Canvas smoke coverage closure awaiting final review state. |

## Backlog Milestones (Planned)

| Range | Status | Scope |
| --- | --- | --- |
| `AIS-RLS-117` - `AIS-RLS-127` | Ready / dependency-gated | Lazy loading, CSP enforcement, admin email masking, product Phase D features, test expansion, accessibility, frontend error monitoring, and database health checks. |
| `AIS-RLS-129` - `AIS-RLS-146` | Ready / dependency-gated | Phase D feature specs, ESLint tightening, premium polish split, and visual redesign Phase 1~14. |
| `AIS-RLS-151`, `AIS-RLS-154` - `AIS-RLS-159` | Blocked | Token bridge, canvas/agent feature completion, storage optimization, migration consolidation, and Canvas v1 archive. |

## Active Task

| Task | Status | What Is Implemented | Remaining Closure |
| --- | --- | --- | --- |
| None | Done | Documentation lane closes `AIS-RLS-128` with the Mermaid roadmap graph and status snapshot. Runtime work has already advanced beyond `AIS-RLS-116` in Trellis, while `AIS-RLS-153` remains in review. | Next documentation lane item is `AIS-RLS-129`; next original runtime chain item remains `AIS-RLS-117`. |

## Documentation Notes

- `IMAGE_STUDIO_FOLLOWUP_OPTIMIZATION_PLAN_202605.md` is the active follow-up roadmap covering `AIS-RLS-094` ~ `AIS-RLS-129` (P0/P1/P2/P3 issues, 30-PR sequence, risk matrix, and metrics dashboard). It is the authoritative source for what "done" means on each remaining task.
- `docs/private/CODEX_SESSION_AUDIT_20260524_019e5a5e.md` records the 2026-05-25 audit of the previous Codex session, including which closed tasks are real, which are placeholder, and the handoff cleanup that was performed. Read this before resuming work.
- `IMAGE_STUDIO_OPTIMIZATION_DEVELOPMENT_PLAN.md` is now a historical roadmap plus backlog proposal document. Its earlier Ready/Backlog labels for `AIS-RLS-039` through `AIS-RLS-060` are superseded by this file and the Trellis board.
- `IMAGE_STUDIO_TRELLIS_TASK_ALLOCATION.md` is the task allocation table and has been updated with post-060 task status.
- `IMAGE_STUDIO_RELLIS_TASKS.md` is a historical task-spec archive. Use its task descriptions for context, not its older suggested Ready/Backlog labels.
- `IMAGE_STUDIO_FRONTEND_ADMIN_DESIGN.md` is a design reference. Its top implementation index has been recalibrated, but detailed body sections still preserve original 2026-05-18 design wording.
- `IMAGE_STUDIO_CANVAS_V2_MIGRATION_PLAN.md` remains the Canvas v2 implementation reference; its status section should be read as completed first-phase migration plus ongoing quality hardening.

## Immediate Next Steps

1. Treat `docs/mobile-qa/visual-regression/runs/2026-05-24T22-57-04-059Z/summary.md` as the latest visual QA review output.
2. Keep `docs/mobile-qa/baseline-local/*.png` as the approved local comparison set; generated screenshot files remain ignored by git unless a release explicitly force-adds them.
3. `AIS-RLS-105` admin route split is complete. If admin endpoint regressions appear, compare against release record `2026-05-25 AIS-RLS-105 Admin Route Split Release` and the private deployment log entry 39.
4. `AIS-RLS-106` mysql-store facade rewrite is complete. If store export regressions appear, compare against release record `2026-05-25 AIS-RLS-106 MySQL Store Facade Release` and the private deployment log entry 40.
5. `AIS-RLS-107` app-auth split is complete. If auth/account regressions appear, compare against release record `2026-05-25 AIS-RLS-107 App Auth Split Release` and the private deployment log entry 41.
6. `AIS-RLS-108` app-settings split is complete. If settings/i18n/theme regressions appear, compare against release record `2026-05-25 AIS-RLS-108 App Settings Split Release` and the private deployment log entry 42.
7. `AIS-RLS-109` GitHub Actions CI workflow is complete. If CI behavior regresses, compare against release record `2026-05-25 AIS-RLS-109 GitHub Actions CI Release`; this task was `deployment_required=false`, so no server backup was created.
8. `AIS-RLS-110` CSS bundle merge is complete. If public CSS regressions appear, compare against release record `2026-05-25 AIS-RLS-110 CSS Bundle Merge Release` and the private deployment log entry 44.
9. `AIS-RLS-111` content-hashed JS bundles are complete. If public asset cache regressions appear, compare against release record `2026-05-25 AIS-RLS-111 JS Bundle Hash Release` and the private deployment log entry 45.
10. Continue with `AIS-RLS-112` self-host fonts/icons, unless the parallel slice agents for `AIS-RLS-147` / `AIS-RLS-148` have pushed changes that require a fresh dependency audit first.
11. For new work, run the release smoke subset relevant to the touched domains before deployment, and follow `docs/private/DEVELOPMENT_GUIDE.md` §2 ~ §7 for the full close-out loop (commit → push → server deploy → online smoke → public release record → private deployment record → `task.py finish`). One task per close-out — do not batch.
12. Use `git archive HEAD` for production source bundles when deploying committed work; it avoids stale local tar artifacts and excludes private/untracked files by default.

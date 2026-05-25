# Project Progress Status

Updated: 2026-05-25

This is the current handoff entry point for project progress. Older planning documents keep historical design detail, but this file reflects the local Trellis board, Git state, and current working tree.

> **2026-05-25 Handoff Note** — read before resuming work.
>
> The previous Codex session (`019e5a5e-651d-7c31-a9c0-11f4bfdb63d9`) was audited and reconciled on 2026-05-25. Full record: `docs/private/CODEX_SESSION_AUDIT_20260524_019e5a5e.md`. Key items the next agent must respect:
>
> - **`AIS-RLS-105` is `review`, not `done`**, and the current draft is wrapper-only. It must be redone with real per-domain extraction (see audit §4.1). Do not `task.py finish AIS-RLS-105` based on the existing wrapper.
> - **`AIS-RLS-107` / `AIS-RLS-108`** — `public/app-auth.js` and `public/app-settings.js` are placeholder stubs (~240 B each, register-only). The real `public/app.js` auth/settings extraction has not happened (`public/app.js` is still 7,293 lines). When these tasks are activated, implement them per audit §4.2 and `docs/IMAGE_STUDIO_FOLLOWUP_OPTIMIZATION_PLAN_202605.md` §P1-1 Step A.
> - **`AIS-RLS-099` ESLint rules** were landed as all-`warn`, which means `npm run check` cannot fail on lint. A new follow-up task should tighten `no-undef` / `no-unused-vars` / `no-empty` to `error` before `AIS-RLS-109` CI lands.
> - **`archive/codex-handoff-20260524/`** holds three Codex draft artifacts (admin wrapper, CI workflow `check.yml`, `14-premium-polish.css`). They are reference-only; do not `git add` directly. The directory is under `.gitignore` (`/archive/`).
> - **Working tree is clean after the audit** (no `M`/`??` entries). `main` is in sync with `origin/main` at `8769d85`.
> - **Recommended cadence**: one task at a time, with audit §7.2 ordering (105 redo → 106 → 107 → 108 → 109). Stop and report after each task instead of batch-closing.

## Source Of Truth

- Trellis task state: `D:\生图广场\.trelis\tasks`
- Release and smoke checklist: `docs/IMAGE_STUDIO_QA_RELEASE_CHECKLIST.md`
- Current implementation repository: `D:\生图广场\remote-edit`
- Latest implementation baseline: current `main` / `origin/main`; Phase B route extraction has been verified through `AIS-RLS-104`.

## Current Summary

- Trellis total: 160 tasks.
- Done: 135 tasks.
- Active: none.
- Backlog: 25 tasks in the local Trellis board as of this update (AIS-RLS-105 to AIS-RLS-129).
- Current active work: none in the local Trellis board.
- Working tree handoff: follow-up optimization work is now in the working tree. `server.js` has new route modules for credits, settings, announcements, images, images-generate, and the gallery route dependency injection bug was fixed; `public/app-auth.js` and `public/app-settings.js` exist as placeholder bridge stubs (~240 B each, `AppModules.register` only — the real auth/settings extraction is still pending under `AIS-RLS-107`/`108`, see the handoff note above); reward-related UI remains split into `public/app-reward-policy.js`, `public/app-credits-detail.js`, and `public/admin-settings.js`; `AIS-RLS-098` promoted the reviewed visual baselines in `docs/mobile-qa/baseline-local/`; `AIS-RLS-099` added ESLint 9, Prettier, `syntax:check`, `lint:fix`, `format:check`, and `npm run check` (rules are currently all `warn` — to be tightened before CI lands); `AIS-RLS-100` moved `/api/checkin` and `/api/credits/detail` into `src/routes/credits.js`; `AIS-RLS-101` verified `/api/settings` and `/api/growth` ownership in `src/routes/settings-public.js`; `AIS-RLS-102` verified `/api/announcements*` and `/api/stats/today` ownership in `src/routes/announcements.js`; `AIS-RLS-103` verified `/api/images/history` and `/api/images/bulk` ownership in `src/routes/images.js`; `AIS-RLS-104` aligned `/api/images/generate`, `/api/images/edit`, and generation request polling/cancel endpoints under `src/routes/images-generate.js`; route-boundary smoke coverage now locks these Phase B public extraction modules.

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
| `AIS-RLS-094` - `AIS-RLS-104` | Done | Phase A documentation/baseline cleanup, visual baseline promotion, lint/check tooling foundation, and first Phase B route extractions for credits, public settings/growth, public announcements/stats, image history/bulk operations, and image generation/edit endpoints. |

## Backlog Milestones (Planned)

| Range | Status | Scope |
| --- | --- | --- |
| `AIS-RLS-105` - `AIS-RLS-129` | Ready / blocked by dependency | Follow-up Optimization Plan: Code Maintenance, Performance, Visual Polish, and Features. Current working tree already contains several Phase B follow-up changes pending verification and Trellis closure. |

## Active Task

| Task | Status | What Is Implemented | Remaining Closure |
| --- | --- | --- | --- |
| None | Done | Local Trellis board has no active tasks. `AIS-RLS-098` passed `npm run smoke:visual-regression` with 10 `Baseline: matched` scenarios and confirmed `VISUAL_REGRESSION_BRAND_PRIMARY_SHIFT=#dc2626` fails the diff assertion. `AIS-RLS-099` passed `npm run lint` with 0 errors and `npm run check`. `AIS-RLS-100` passed `node --check server.js`, `node --check src/routes/credits.js`, `npm run smoke:server-route-boundary-split`, online `npm run smoke:public -- https://<host>`, and online `npm run smoke:gallery-images -- https://<host>`; local `smoke:public` was blocked only by missing local MySQL credentials. `AIS-RLS-101` passed `node --check server.js`, `node --check src/routes/settings-public.js`, `npm run smoke:server-route-boundary-split`, and online `npm run smoke:public -- https://<host>`. `AIS-RLS-102` passed `node --check server.js`, `node --check src/routes/announcements.js`, `npm run smoke:server-route-boundary-split`, and online `npm run smoke:public -- https://<host>`. `AIS-RLS-103` passed `node --check server.js`, `node --check src/routes/images.js`, `npm run smoke:server-route-boundary-split`, online `npm run smoke:public -- https://<host>`, and online `npm run smoke:gallery-images -- https://<host>`. `AIS-RLS-104` passed `node --check server.js`, `node --check src/routes/images-generate.js`, `node --check src/routes/generate.js`, `npm run smoke:server-route-boundary-split`, and online `npm run smoke:public -- https://<host>`. | Next ready item is `AIS-RLS-105`, but it is currently in `review` state with a wrapper-only draft that must be redone (see handoff note and audit doc §4.1) — do not finish based on the existing wrapper. |

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
3. **Redo** `AIS-RLS-105` admin route split. The current `review`-state draft is wrapper-only (handlers in `src/routes/admin/*.js` just forward to legacy `admin.js`); the wrapper is preserved at `archive/codex-handoff-20260524/src-routes-admin-wrapper/` for reference but must not be reused. Implement real per-domain extraction with each subfile ≤ 400 lines and ultimately remove `src/routes/admin.js` / `src/routes/admin-users.js` / `src/routes/admin-announcements.js`. See audit doc §4.1 and follow-up plan §P1-4.
4. After `AIS-RLS-105`, proceed in this order: `106` (mysql-store programmatic façade), `107` (real `app-auth.js` extraction, ≥ 400 lines), `108` (real `app-settings.js` extraction, ≥ 300 lines), then `109` (CI workflow — draft is at `archive/codex-handoff-20260524/.github/workflows/check.yml`, must be rewritten with `npm ci`, pinned Node `20.20.2`, and `npm test --if-present`; the MySQL service block is unnecessary for `npm run check`).
5. For new work, run the release smoke subset relevant to the touched domains before deployment, and follow `docs/private/DEVELOPMENT_GUIDE.md` §2 ~ §7 for the full close-out loop (commit → push → server deploy → online smoke → public release record → private deployment record → `task.py finish`). One task per close-out — do not batch.
6. Use `git archive HEAD` for production source bundles when deploying committed work; it avoids stale local tar artifacts and excludes private/untracked files by default.

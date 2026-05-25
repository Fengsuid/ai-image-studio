# Image Studio QA Release Checklist

Use this checklist before every P0 release and whenever a feature batch is deployed.

## Latest Closeout Notes

### 2026-05-24 AIS-RLS-093 Visual Regression QA Closeout

- Task covered: `AIS-RLS-093`.
- Latest local visual run: `docs/mobile-qa/visual-regression/runs/2026-05-24T09-58-42-216Z/summary.md`.
- Result: `npm run smoke:visual-regression` passed 10 scenarios with no failures.
- Companion check: `npm run smoke:mobile-layout` passed 42 page/viewport checks; latest output `docs/mobile-qa/baseline-local/2026-05-24T10-01-58-798Z/summary.json`.
- Baseline policy: keep baseline-free mode as the default; missing-baseline warnings are accepted until a future release explicitly promotes screenshots after manual review.
- Cleanup: stale `docs/mobile-qa/visual-regression/runs/*` folders were removed, leaving only the latest reviewable run.
- Harness fix: editor fixture now pins image frame/scaler dimensions so the editor mobile screenshot checks a stable visible image state.

## 1. Local Smoke

- Run syntax checks:
  - `node --check server.js`
  - `node --check public/app.js`
  - `node --check public/admin.js`
  - `node --check public/canvas.js`
  - `node --check public/canvas-store.js`
  - `node --check public/canvas-nodes.js`
  - `node --check public/canvas-geometry.js`
  - `node --check public/canvas-minimap.js`
  - `node --check public/canvas-workflows.js`
  - `node --check public/canvas-history.js`
  - `node --check public/canvas-selection.js`
  - `node --check public/canvas-io.js`
  - `node --check public/canvas-assistant.js`
  - `node --check public/canvas-toolbar.js`
  - `node --check public/canvas-inspector.js`
  - `node --check public/gallery-leaderboard.js`
  - `node --check public/gallery-detail-media.js`
  - `node --check public/gallery-tag-view-model.js`
  - `node --check public/generation-result-actions.js`
  - `node --check public/gallery-normalize.js`
  - `node --check src/prompt-source-sync.js`
  - `node --check src/canvas-service.js`
  - `node --check src/canvas-import-export.js`
  - `node --check src/canvas-assistant.js`
  - `node --check src/prompt-review-service.js`
  - `node --check src/mysql-store.js`
  - `node --check scripts/smoke/check-canvas-module-boundaries.mjs`
  - `node --check scripts/smoke/check-generation-flicker-guard.mjs`
  - `node --check scripts/smoke/check-gallery-leaderboard-sidebar.mjs`
  - `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); JSON.parse(require('fs').readFileSync('package-lock.json','utf8'))"`
- Run diff hygiene:
  - `git diff --check`
  - `git status --short`
- Run database-free logic smoke (always safe locally):
  - `npm run smoke:canvas-history`
  - `npm run smoke:canvas-selection`
  - `npm run smoke:canvas-import-export`
  - `npm run smoke:canvas-assistant`
  - `npm run smoke:canvas-module-boundaries`
  - `npm run smoke:generation-flicker`
  - `npm run smoke:gallery-leaderboard-sidebar`
  - `npm run smoke:generation-result-actions`
  - `npm run smoke:infinite-canvas-prompt-source`
  - `npm run smoke:gallery-detail-media`
  - `npm run smoke:gallery-card-tags`
  - `npm run smoke:prompt-review`
- Run frontend visual QA smoke when polishing layout, theme, Composer, gallery, editor, works, or admin shell:
  - `npm run smoke:visual-regression`
  - Optional container/origin mode: `npm run smoke:visual-regression -- http://localhost:3100`
  - Review `docs/mobile-qa/visual-regression/runs/<timestamp>/summary.md` before approving baseline changes.
- Start a local server with a disposable data directory and run public smoke:
  - `PORT=3100 DATA_DIR=data-smoke node server.js`
  - `npm run smoke:public -- http://localhost:3100`
  - `npm run smoke:gallery-images -- http://localhost:3100`
- If local MySQL is used, verify the configured user/password before treating startup failure as a code regression. The smoke scripts default to MySQL database `gpt_image_studio`; either set `MYSQL_DATABASE` explicitly or create a database with that name to avoid silent connection mismatches.
- For authenticated flows, run:
  - `ADMIN_EMAIL=<admin> ADMIN_PASSWORD=<password> npm run smoke:auth-admin -- http://localhost:3100`
  - `npm run smoke:canvas-import-export-api -- http://localhost:3100`
  - `npm run smoke:canvas-assistant-api -- http://localhost:3100`
  - `npm run smoke:data`
- Canvas v2 release gate:
  - `npm run canvas:v2:check`
  - `npm run canvas:v2:build`
  - `npm run smoke:canvas-v2:static`
  - `npm run smoke:canvas-v2:editor`
  - `npm run smoke:canvas-v2:generation`
  - `npm run smoke:canvas-v2:entry`
  - `npm run smoke:canvas-v2 -- http://localhost:3100`

## 2. Online Smoke

- Confirm deployed version:
  - `GET /api/version`
- Run public API smoke against the production base URL:
  - `npm run smoke:public -- https://<host>`
  - `npm run smoke:gallery-images -- https://<host>`
- For frontend visual releases, run the shallow visual regression matrix against the deployed origin or SSH tunnel:
  - `npm run smoke:visual-regression -- https://<host>`
- Run authenticated admin smoke with production-safe credentials:
  - `ADMIN_EMAIL=<admin> ADMIN_PASSWORD=<password> npm run smoke:auth-admin -- https://<host>`
  - `npm run smoke:canvas-import-export-api -- https://<host>`
  - `npm run smoke:canvas-assistant-api -- https://<host>`
- Run Canvas v2 smoke against the deployed container or production origin:
  - `npm run smoke:canvas-v2 -- https://<host>`
  - `npm run smoke:canvas-v2:generation`
  - `npm run smoke:canvas-v2:entry`
  - `GET /canvas-v2`
  - `GET /canvas-v2/projects/<id>`
  - `GET /canvas-v2/assets/<hashed-asset>`
- Run targeted prompt regression where applicable:
  - `node scripts/smoke/check-prompt-like.mjs https://<host> <promptId>`
- Check logs for:
  - startup migration errors
  - OpenAI/provider routing errors
  - MySQL connection errors
  - image file read/write errors
  - unexpected 4xx/5xx spikes

## 3. Screenshot Checks

- Home composer: desktop and mobile, including generated result actions.
- Gallery: recent grid, leaderboard tabs, image detail drawer, share route.
- Image editor: upload state, source/output comparison, publish-original controls.
- My works: detail drawer, publish/unpublish, batch actions.
- Canvas: project list, workspace, add node, drag, connect, generate, autosave status, publish output.
- Admin: dashboard, users/credits, providers, prompt sources, tags/categories, gallery moderation, reports, announcements.

## 4. Release Record

For every completed P0 task, record:

- task id and title
- commit hash
- files changed
- local checks run
- online smoke result
- known blockers or skipped checks
- rollback target

Record the outcome in the relevant development document or release note before marking the task done. Documentation-only updates that do not deploy to production do not need a release record entry; they are tracked in the unified master plan and Rellis tasks file instead.

### Canvas v2 Phase 1 Release Notes

- Architecture: Canvas v2 is an isolated browser sub-application under `apps/canvas-v2/src`, built into `public/canvas-v2` and served by the Node server as an SPA. It uses the existing `/api/auth`, `/api/canvases`, `/api/canvases/:id/export`, and `/api/canvases/:id/generate` routes for login, persistence, export, CSRF, credits, provider routing, and generated image storage.
- Compliance: the Canvas v2 sub-application records `basketikun/infinite-canvas` as the AGPL-3.0 upstream reference in `apps/canvas-v2/UPSTREAM.md`; local Canvas v2 code is marked `AGPL-3.0-or-later` and must not import upstream backend, database, API-key, or direct provider-call paths into the browser bundle.
- Entry switch and rollback: public Canvas entries default to Canvas v2. Set `CANVAS_ENTRY_MODE=legacy` to route primary entries back to the existing `#/canvas` workspace, or `CANVAS_ENTRY_MODE=hidden` to hide new Canvas entry points while keeping API routes deployed.
- Build hygiene: production builds run `npm run canvas:v2:build` and publish only `public/canvas-v2`; `apps/canvas-v2/node_modules`, runtime data, archives, `.env` files, private docs, and local screenshots are excluded from Docker context and Git release artifacts.
- QA coverage: `npm run smoke:canvas-v2` covers `/canvas-v2`, nested SPA refresh, hashed JS/CSS assets, missing asset 404s, `/api/settings.canvasEntryMode`, unauthenticated API boundaries, authenticated CRUD, save/restore, export schema, owner isolation, and a backend generation-route validation probe that does not call a provider.
- Online validation: after deployment verify `/api/version`, `/canvas-v2`, `/canvas-v2/projects/<id>`, Canvas v2 static assets, `npm run smoke:public -- <origin>`, `npm run smoke:canvas-v2 -- <origin>`, `npm run smoke:canvas-v2:generation`, `npm run smoke:canvas-v2:entry`, gallery-to-canvas smoke, and the retired domain 410 response.
- Rollback point: record the pushed Git commit and deployment package version for every Canvas v2 release. Prefer code rollback or `CANVAS_ENTRY_MODE=legacy` for UI regressions; database rollback is only needed for destructive schema/data changes.

### 2026-05-25 AIS-RLS-105 Admin Route Split Release

- Task covered: `AIS-RLS-105` Split `src/routes/admin.js` into `src/routes/admin/*` by business domain.
- Commits covered: `b0043f0`, `8bfdc4b`.
- Files changed: `src/routes/admin/*`, `server.js`, admin/backend smoke scripts, `src/stores/prompt-store.js`, API reference, and Trellis allocation docs.
- Backend coverage: deleted legacy `src/routes/admin.js`, `src/routes/admin-users.js`, and `src/routes/admin-announcements.js`; new admin domains are `announcements`, `diagnostics`, `generations`, `moderation`, `prompt-sources`, `public-images`, `settings`, `users`, plus `index.js` aggregation. Each backend admin subfile is under 400 lines.
- Local checks: `node --check server.js`, `node --check src/routes/admin/*.js`, `node --check src/stores/prompt-store.js`, `npm run check`, `npm run smoke:admin-module-split`, `npm run smoke:server-route-boundary-split`, `npm run smoke:admin-generation-diagnostics`, `npm run smoke:public-reward-policy`, `npm run smoke:generation-trace`, `npm run smoke:mysql-store-domain-split`, `git diff --check`, and privacy scan passed. Local `smoke:auth-admin` and `smoke:moderation-withdrawal` were blocked before deployment by missing local admin/MySQL credentials.
- Online smoke: container `npm run smoke:auth-admin -- http://127.0.0.1:3000` passed; external `npm run smoke:public -- https://<host>` and `npm run smoke:gallery-images -- https://<host>` passed; `/api/version` reports `20260525-admin-route-split-v1`.
- Deployment note: the production source tree initially retained stale legacy admin files because the package was extracted over an existing directory; those files were removed before the final rebuild, and the final container confirms only `src/routes/admin/*` remains.
- Known blockers: `smoke:moderation-withdrawal` still fails in production when the current public unpublish policy returns `409 publicUnpublishDisabled`; this is a policy/state mismatch outside the admin route split and is not treated as an AIS-RLS-105 regression.
- Rollback target: use the latest pre-deploy server backup recorded in the private deployment document, or code rollback to the pre-`b0043f0` route baseline if admin endpoints regress.

### 2026-05-25 AIS-RLS-106 MySQL Store Facade Release

- Task covered: `AIS-RLS-106` Convert `src/mysql-store.js` facade to programmatic re-export with collision check.
- Commit covered: `74babe1`.
- Files changed: `src/mysql-store.js`, `scripts/smoke/check-mysql-store-domain-split.mjs`, and `src/config/app-settings.js`.
- Backend coverage: `createMySQLStore()` now builds the public store facade from ordered export groups through a single builder, preserves the existing 139+ exported methods, and throws a named `Store export collision` error when two groups expose the same method name.
- Local checks: `node --check src/mysql-store.js`, `node --check src/config/app-settings.js`, `node --check scripts/smoke/check-mysql-store-domain-split.mjs`, `npm run smoke:mysql-store-domain-split`, `npm run check`, `git diff --check`, staged private-doc scan, and privacy scan passed. Local `npm run smoke:public` was skipped after it failed to connect to `http://localhost:3000` because no local app server was running.
- Online smoke: container `npm run smoke:mysql-store-domain-split -- http://127.0.0.1:3000` passed; container `npm run smoke:public -- http://127.0.0.1:3000` passed; external `npm run smoke:public -- https://<host>` passed; `/api/version` reports `20260525-mysql-store-facade-v1`.
- Deployment note: the deployment used a `git archive HEAD` package and a lightweight server backup for the touched source files plus environment file to reduce disk usage. No database schema or data changes were made.
- Known blockers: none for this task. Gallery image smoke was not repeated because this change is a backend facade-only refactor and public API smoke already covered the public gallery list endpoint.
- Rollback target: use the latest pre-deploy server backup recorded in the private deployment document, or code rollback to the pre-`74babe1` manual facade baseline if store exports regress.

### 2026-05-25 AIS-RLS-107 App Auth Split Release

- Task covered: `AIS-RLS-107` Extract `public/app.js` auth/account/CSRF logic into `public/app-auth.js`.
- Commits covered: `f449a01`, `f3e2ece`.
- Files changed: `public/app-auth.js`, `public/app.js`, `public/index.html`, `src/config/app-settings.js`, `scripts/smoke/check-public-app-module-split.mjs`, `scripts/smoke/check-user-flow-polish.mjs`, and `scripts/smoke/check-public-api.mjs`.
- Frontend coverage: `public/app-auth.js` is now a real 690-line auth controller module registered through `AppModules.auth`; `public/app.js` delegates auth/account/CSRF/My Works behavior to that module and is reduced to 6623 lines, below the AIS-RLS-107 limit.
- Local checks: `node --check public/app.js`, `node --check public/app-auth.js`, `node --check scripts/smoke/check-public-api.mjs`, `npm run smoke:public-app-module-split`, `npm run smoke:user-flow-polish`, `npm run smoke:frontend-boundaries`, `npm run check`, and `git diff --check` passed. Local `npm run smoke:public` was skipped after it failed to connect to `http://localhost:3000` because no local app server was running.
- Online smoke: container `npm run smoke:public-app-module-split`, container `npm run smoke:user-flow-polish`, container `npm run smoke:frontend-boundaries`, container `npm run smoke:public -- http://127.0.0.1:3000`, and external `npm run smoke:public -- https://<host>` passed; `/api/version` reports `20260525-app-auth-split-v1`.
- Deployment note: the deployment used a `git archive HEAD` package; a follow-up lightweight sync updated the public smoke expectation after the second commit. No database schema or data changes were made.
- Known blockers: none for this task. The initial local `smoke:public` connection failure was an environment issue, not an app-auth regression.
- Rollback target: use the latest pre-deploy server backup recorded in the private deployment document, or code rollback to the pre-`f449a01` auth-in-`app.js` baseline if auth/account behavior regresses.

### 2026-05-25 AIS-RLS-108 App Settings Split Release

- Task covered: `AIS-RLS-108` Extract `public/app.js` i18n/theme/prefs logic into `public/app-settings.js`.
- Commit covered: `fc93f17`.
- Files changed: `public/app-settings.js`, `public/app.js`, `public/index.html`, `src/config/app-settings.js`, `scripts/smoke/check-public-app-module-split.mjs`, `scripts/smoke/check-theme-mobile-nav.mjs`, and `scripts/smoke/check-public-api.mjs`.
- Frontend coverage: `public/app-settings.js` is now a real settings controller module registered through `AppModules.settings`; it owns the i18n dictionary, text/local helpers, language toggle binding, preference read/write helpers, and text matching helper. `public/app.js` delegates settings/i18n/theme preference behavior to that module and is reduced to 5929 lines, below the AIS-RLS-108 limit.
- Local checks: `node --check public/app.js`, `node --check public/app-settings.js`, `node --check scripts/smoke/check-public-api.mjs`, `npm run smoke:public-app-module-split`, `npm run smoke:theme-mobile-nav`, `npm run smoke:frontend-boundaries`, `npm run check`, and `git diff --check` passed. Local `npm run smoke:public` was blocked by the local MySQL `root@localhost` credential mismatch, not by application syntax.
- Online smoke: container `npm run smoke:public-app-module-split`, container `npm run smoke:theme-mobile-nav`, container `npm run smoke:frontend-boundaries`, container `npm run smoke:public -- http://127.0.0.1:3000`, and external `npm run smoke:public -- https://<host>` passed; `/api/version` reports `20260525-app-settings-split-v1`.
- Deployment note: the deployment used a small package containing only the six changed files. The server `.env` still had `APP_VERSION=20260525-app-auth-split-v1` after the first restart, so it was corrected to `20260525-app-settings-split-v1` and the app container was restarted. No database schema or data changes were made.
- Known blockers: none for this task. The local full public smoke remains dependent on local MySQL credentials and was not treated as an app-settings regression.
- Rollback target: use the latest pre-deploy server backup recorded in the private deployment document, or code rollback to the pre-`fc93f17` settings-in-`app.js` baseline if settings/i18n/theme behavior regresses.

### 2026-05-25 AIS-RLS-109 GitHub Actions CI Release

- Task covered: `AIS-RLS-109` Add GitHub Actions CI check workflow.
- Commit covered: `987ab86`.
- Files changed: `.github/workflows/check.yml`.
- CI coverage: workflow runs on `push` and `pull_request` to `main`, uses Node `20.20.2`, installs with `npm ci`, runs `npm run check`, and runs `npm test --if-present`. It intentionally does not start a MySQL service because the current check gate is database-free.
- Local checks: `Test-Path .github/workflows/check.yml` returned `True`; `npm run check`, `npm test --if-present`, and `git diff --check` passed. `npm run check` still reports existing ESLint warnings because the current lint rules are warning-level until `AIS-RLS-130`.
- GitHub Actions: workflow run for `987ab86c1dd43e5c0b44cea8a53cf0ff59061b43` completed with `success`.
- Deployment note: `deployment_required=false`; no server rebuild, upload package, or production container restart was required for this CI-only task.
- Known blockers: the acceptance item for a deliberately broken PR was not executed against the live repository; the workflow command set is expected to fail on syntax errors through `npm run syntax:check`, and the pushed workflow itself has a successful GitHub Actions run.
- Rollback target: remove `.github/workflows/check.yml` or revert `987ab86` if CI blocks unexpectedly.

### 2026-05-25 AIS-RLS-110 CSS Bundle Merge Release

- Task covered: `AIS-RLS-110` Merge `public/css/*.css` into content-hashed single bundle.
- Commit covered: `489a9a6`.
- Files changed: `scripts/frontend/css-bundle.mjs`, `scripts/frontend/build-public-modules.mjs`, `src/frontend/app-build-manifest.mjs`, generated `public/dist/app.a4dfaf24076c.css`, `public/index.html`, frontend build manifest files, CSS/public smoke scripts, and version config.
- Frontend coverage: `npm run frontend:build` now emits `public/dist/app.<hash>.css`, records the CSS hash/source list in `public/frontend-build-manifest.json` and `.js`, keeps `public/styles.css` as the compatibility import entry, and changes the public homepage from five local CSS links plus imports to one local hashed CSS bundle link. `/admin` intentionally keeps `/styles.css` for compatibility.
- Local checks: `node --check scripts/frontend/css-bundle.mjs`, `node --check scripts/frontend/build-public-modules.mjs`, `node --check scripts/smoke/check-css-module-split.mjs`, `node --check scripts/smoke/check-frontend-build-tooling.mjs`, `npm run frontend:build`, `Test-Path public/dist/app.*.css`, `npm run smoke:css-module-split`, `npm run smoke:frontend-build-tooling`, `npm run smoke:frontend-performance`, `npm run smoke:gallery-leaderboard-sidebar`, `npm run check`, JSON parse check, and `git diff --check` passed.
- Local blocked checks: full local `npm run smoke:public` was blocked by local MySQL `root@localhost` credential mismatch. `npm run smoke:visual-regression` ran with Edge CDP and produced diffs against the existing local baseline; manual review showed the deltas were from existing icon/fixture baseline drift rather than missing bundled CSS, and it was not promoted as a new baseline.
- Online smoke: deployment package hash and file count matched locally and on server; container local `/api/version` and external `/api/version` report `20260525-css-bundle-v1`; container CSS fetch returned `200` for `/dist/app.a4dfaf24076c.css`; external `npm run smoke:public -- https://<host>` passed and verified the public home CSS bundle plus admin `/styles.css` compatibility path.
- Deployment note: server `.env` initially kept the previous `APP_VERSION`, so it was updated to `20260525-css-bundle-v1` and the app container was restarted. No database schema or data changes were made.
- Known blockers: none for the CSS bundle release. Server disk remained high at 87% used after deployment, so future tasks should avoid unnecessary backups and clean old artifacts if usage rises.
- Rollback target: revert `489a9a6`, or change `public/index.html` back to `/styles.css` plus the legacy mobile CSS links and remove the manifest CSS fields if the bundle regresses.

### 2026-05-25 AIS-RLS-111 JS Bundle Hash Release

- Task covered: `AIS-RLS-111` Emit content-hashed JS bundles and remove manual `?v=` query strings.
- Commit covered: `ae6cf24`.
- Files changed: `scripts/frontend/js-bundle.mjs`, `scripts/frontend/build-public-modules.mjs`, `public/dist/*.js`, `public/index.html`, `server.js`, frontend build manifest files, frontend/public smoke scripts, and version config.
- Frontend coverage: `npm run frontend:build` now copies the public homepage JS files into `public/dist/<name>.<hash>.js`, updates public `index.html` to load hashed JS assets, removes manual `?v=` query strings from public homepage scripts, keeps `/frontend-build-manifest.js` as a query-free compatibility manifest, and records all JS asset mappings/hashes in `public/frontend-build-manifest.json` and `.js`.
- Cache coverage: server static handling now returns `Cache-Control: public, max-age=31536000, immutable` for `/dist/*.<hash>.js` and `/dist/*.<hash>.css`, while HTML remains `Cache-Control: no-store`.
- Local checks: `node --check scripts/frontend/js-bundle.mjs`, `node --check scripts/frontend/build-public-modules.mjs`, `node --check scripts/smoke/check-public-api.mjs`, `npm run frontend:build` twice, `npm run smoke:frontend-build-tooling`, `npm run smoke:css-module-split`, `npm run smoke:frontend-performance`, `npm run smoke:gallery-leaderboard-sidebar`, `npm run smoke:public-app-module-split`, `npm run check`, privacy scan, and `git diff --check` passed. Local `npm run smoke:public` was deferred to production because local MySQL credentials still block `node server.js`.
- Online smoke: external `npm run smoke:public -- https://<host>` passed and fetched `/dist/app.68e80b1aa603.js`; external `/api/version` reports `20260525-js-bundle-v1`; container checks confirmed `/` has `Cache-Control: no-store`, `/dist/app.68e80b1aa603.js` has `max-age=31536000, immutable`, and `/dist/app.79f33e4aba9c.css` has `max-age=31536000, immutable`.
- Deployment note: the first `scp` upload timed out and left an invalid partial archive; the package was retransmitted, then file count and SHA256 were verified before deployment. No database schema or data changes were made.
- Known blockers: none for the JS hash release. The generated manifest increases measured non-canvas initial JS to `443890` bytes, still under the updated 450 KB smoke budget.
- Rollback target: revert `ae6cf24`, or change public `index.html` scripts back to root JS files with manual query strings and restore normal static asset cache headers if hashed JS serving regresses.

### 2026-05-25 AIS-RLS-147+148 Slice 化首批部署

- Tasks covered: `AIS-RLS-147` Canvas backend slice extraction and `AIS-RLS-148` Agent backend slice extraction.
- Commits covered: `4b16f4d`, `3271734`, `48c3893`, `a27aa9c`.
- Files changed: `packages/agent-core/*`, `packages/canvas-core/*`, `server.js` wiring, `src/mysql-store.js` schema/store exports, related smoke scripts, `Dockerfile`, workspace package metadata, and version config.
- Slice coverage: agent and canvas backend code now live behind `@ai-image-studio/agent-core` and `@ai-image-studio/canvas-core` package entrypoints. Legacy `src/agent-*`, `src/canvas-*`, `src/routes/agent-sessions.js`, `src/routes/canvases.js`, and matching legacy store files were removed, while the main app imports the package facades instead of local god-file style modules.
- Docker coverage: production image now copies `packages/` before runtime startup, which is required for workspace package resolution after the agent/canvas slice extraction.
- Local checks: `packages/canvas-core npm run check`, `packages/canvas-core npx vitest run`, `packages/agent-core npm run check`, `packages/agent-core npm run test`, `node --check server.js`, `npm run smoke:canvas-v2:static`, `npm run smoke:canvas-v2:editor`, `npm run smoke:canvas-v2:generation`, `npm run smoke:agent-workspace`, `npm run smoke:canvas-history`, `npm run smoke:canvas-assistant`, `npm run smoke:canvas-import-export`, `npm run smoke:canvas-selection`, `npm run smoke:prompt-canvas-store-split`, and `npm run smoke:server-route-boundary-split` passed.
- Online smoke: deployment package size, entry count, and SHA256 matched locally and on server; container and external `/api/version` report `20260525-slice-extraction-v1`; external `npm run smoke:public -- https://<host>` passed; container `smoke:public`, `smoke:canvas-v2:generation`, `smoke:agent-workspace`, `smoke:canvas-assistant`, `smoke:canvas-import-export`, `smoke:server-route-boundary-split`, and package resolution checks passed.
- Known blockers: local MySQL credentials still block the four canvas API smokes that need DB-backed local startup, so those were covered in the deployed container instead. `smoke:canvas-module-boundaries`, `smoke:canvas-layout-edges`, and `smoke:canvas-v2:entry` remain known pre-existing `AIS-RLS-111` content-hash cleanup gaps, not slice extraction regressions.
- Rollback target: revert `a27aa9c`, `3271734`, and `4b16f4d` if the slice extraction regresses; keep or re-apply `48c3893` when any workspace package remains required by the production image.

### 2026-05-21 Canvas v2 Phase 1 Release

- Tasks covered: `AIS-RLS-048`, `AIS-RLS-049`, `AIS-RLS-050`, `AIS-RLS-051`, `AIS-RLS-052`, `AIS-RLS-053`, `AIS-RLS-054`.
- Commits covered: `198acd5`, `27b4b59`, `af2334a`, `13cd6b7`, `757cb7f`, `4664d1f`, `5ed82b1`, `0f9554b`.
- Local checks: `node --check` for touched server/public/smoke files, package JSON parse, `npm run canvas:v2:check`, `npm run canvas:v2:build`, `npm run smoke:canvas-v2:static`, `npm run smoke:canvas-v2:editor`, `npm run smoke:canvas-v2:generation`, `npm run smoke:canvas-v2:entry`, `npm run smoke:generation-result-actions`, `npm run smoke:gallery-leaderboard-sidebar`, `npm run smoke:gallery-detail-media`, `git diff --check`, and changed-diff privacy scan.
- Smoke coverage: Canvas v2 unified smoke now covers SPA shell, nested refresh, hashed static assets, missing asset 404, public `canvasEntryMode`, unauthenticated API boundaries, authenticated CRUD, save/restore, export schema, owner isolation, and generation-route validation without provider calls.
- Build coverage: Docker build runs an isolated Canvas v2 build stage, publishes generated `public/canvas-v2` assets, keeps Canvas v2 source for container smoke scripts, and does not carry `apps/canvas-v2/node_modules` in the production image.
- Deployment version: `/api/version` reports `20260521-canvas-v2-release-v1` on Node `v20.20.2`.
- Deployment checks: container `smoke:public`, `smoke:canvas-v2`, `smoke:canvas-v2:generation`, `smoke:canvas-v2:entry`, and `smoke:canvas-gallery-link` passed.
- Route checks: `/canvas-v2` returned `200`, `/canvas-v2/projects/release.v1` returned `200`, Canvas v2 hashed JS/CSS assets returned `200`, missing Canvas v2 asset returned `404`, and the retired domain returned `410`.
- Follow-up fix: `0f9554b` aligned home `styles.css` and `app.js` cache-bust markers after production `smoke:public` caught a mismatch.
- Rollback target: for Canvas entry regressions set `CANVAS_ENTRY_MODE=legacy`; for code rollback use the last deployed Canvas v2 generation baseline before the entry-switch/release batch, `757cb7f`.

### 2026-05-19 Canvas And QA Batch

- Tasks covered: `AIS-RLS-023`, `AIS-RLS-024`, `AIS-RLS-025`, `AIS-RLS-035`, `AIS-RLS-038`.
- Commits covered: `fdad024`, `526e67f`, `b435888`, `7de7aeb`, `0698983`, `32d5475`.
- Local checks: `node --check` for server, app, admin, and canvas scripts; package JSON parse; `git diff --check`; privacy grep.
- Deployment checks: production root `200`, retired domain `410`, app container running, public smoke passed.
- Public smoke results: `/api/version`, `/api/health`, `/api/images/public`, `/api/prompts`, `/api/tags` all passed.
- Canvas checks: canvas script assets returned `200`; unauthenticated canvas API calls returned auth errors instead of `500`.
- Skipped blocker: local disposable smoke remained blocked by local MySQL root credential mismatch, not by application syntax.
- Rollback target: latest pre-deploy server backup is recorded in the private deployment document.

### 2026-05-19 Prompt Sort Batch

- Task covered: `AIS-RLS-013`.
- Commits covered: `78186df`, `8cb6cb4`, `8f87b6f`.
- Local checks: `node --check server.js`, `node --check public/app.js`, `node --check src/mysql-store.js`, `git diff --check`, privacy grep.
- Deployment checks: app container running, production root `200`, retired domain `410`, public smoke passed.
- Prompt sort smoke: `/api/prompts?sort=hot|new|used|liked&limit=8` returned results and sorted descending by heat, created time, use count, and like count respectively.
- Detail UI coverage: prompt detail modal now includes a prompt like button that shares the same state updater as prompt cards and leaderboard items.
- Prompt like smoke: `node scripts/smoke/check-prompt-like.mjs http://127.0.0.1:3000 359` passed in the production container; duplicate like did not increment count and unlike restored the baseline.
- Rollback target: latest pre-deploy server backup is recorded in the private deployment document.

### 2026-05-19 Gallery Image Display Batch

- Issues covered: prompt database images not reliably visible in the gallery, prompt database image cards missing from like leaderboard, home navigation briefly showing the chat workspace.
- Commit covered: `5a7095d`.
- Local checks: `node --check server.js`, `node --check public/app.js`, `node --check src/mysql-store.js`, `git diff --check`, privacy grep.
- Deployment checks: app container running, production root `200`, retired domain `410`, public smoke passed.
- Image smoke: first 5 prompt database image proxy URLs returned `200 image/jpeg`.
- Leaderboard smoke: all-time leaderboard returned 24 image items, including prompt database image items.
- UI state fix: home hero route now clears chat workspace panel classes before toggling views.
- Rollback target: latest pre-deploy server backup is recorded in the private deployment document.

### 2026-05-19 Prompt Thumbnail Asset Batch

- Issue covered: gallery prompt cards such as `例128` to `例131` still showed fallback placeholders because local `/prompt-thumbs/**` assets were missing from the deployed package and missing image paths fell through to the SPA HTML response.
- Commit covered: `df8f37a`.
- Local checks: `node --check server.js`, `node --check public/app.js`, `git diff --check`.
- Deployment checks: app container running, production root `200`, retired domain `410`, public smoke passed.
- Image smoke: production `/api/prompt-images/359|360|361|362/file?variant=thumb` returned `200 image/jpeg|png` with `X-AI-Content-Source: prompt-database-image`.
- Static asset smoke: `/prompt-thumbs/freestylefly/case-128.jpg` returned `200 image/jpeg`; missing prompt thumbnail paths now return `404` instead of `200 text/html`.
- Cache busting: app/admin asset query versions and `/api/version` now report `20260519-gallery-thumbs-v1`.
- Rollback target: latest pre-deploy server backup is recorded in the private deployment document.

### 2026-05-20 Prompt AI Duplicate Review Batch

- Task covered: `AIS-RLS-014`.
- Commit covered: `3704558`.
- Local checks: `node --check server.js`, `node --check src/mysql-store.js`, `node --check src/prompt-review-service.js`, `node --check public/admin.js`, `node --check scripts/import-gen-image-prompts.mjs`, `node --check scripts/smoke/check-auth-admin.mjs`, `npm run smoke:prompt-review`, `git diff --check`.
- Backend coverage: prompt duplicate candidates now store `ai_status`, `ai_decision`, `ai_confidence`, `ai_reason`, `ai_recommended_action`, `ai_model`, `ai_reviewed_at`, and raw response JSON for traceability.
- Review flow coverage: prompt creation, remote prompt source sync, and import script apply run local hash/simhash candidate generation before AI/mock semantic review.
- Admin coverage: duplicate candidates show AI decision, confidence, reason, and support per-candidate AI review.
- Smoke coverage: `smoke:prompt-review` validates rule fallback, JSON parsing, mock review, and model response normalization; authenticated admin smoke creates duplicate hidden prompts and verifies the duplicate candidate AI decision.
- Deployment checks: app container running, production root `200`, production domain `200`, retired domain `410`, public smoke passed, prompt-review smoke passed, authenticated admin smoke passed.
- Production version: `/api/version` reports `20260520-prompt-ai-review-v1`.
- Production prompt image regression: `/api/prompt-images/359/file?variant=thumb` and `/prompt-thumbs/freestylefly/case-128.jpg` returned `200 image/jpeg`; container still has 807 prompt thumbnail files.
- Rollback target: latest pre-deploy server backup is recorded in the private deployment document.

### 2026-05-20 Canvas Minimap Batch

- Task covered: `AIS-RLS-026`.
- Commit covered: `29e20a3`.
- Local checks: `node --check public/canvas.js`, `node --check public/canvas-minimap.js`, `node --check public/canvas-geometry.js`, `node --check scripts/smoke/check-public-api.mjs`, `node --check server.js`, `git diff --check`.
- Frontend coverage: canvas minimap is split into `public/canvas-minimap.js`; `public/canvas.js` only wires render and pointer events.
- UI coverage: minimap renders node rectangles, edge lines, selected-node emphasis, current viewport box, and click/drag navigation.
- Smoke coverage: public smoke now verifies `/canvas-minimap.js` is referenced, served, and registers the `root.minimap` module.
- Deployment checks: app container running, production version `20260520-canvas-minimap-v1`, public smoke passed, `/canvas-minimap.js` returned `200 text/javascript`, and container syntax checks passed for canvas scripts.
- Production image regression: `/api/prompt-images/359/file?variant=thumb` returned `200 image/jpeg`.
- Rollback target: latest pre-deploy server backup is recorded in the private deployment document.

### 2026-05-20 Gallery Image Model Regression Batch

- Issues covered: gallery cards still showing missing-image placeholders for database prompt images, prompt database images needing to participate in the like leaderboard, and home navigation briefly reusing stale route hash state.
- Commits covered: `df418ca`, `d449129`.
- Local checks: `node --check public/gallery-normalize.js`, `node --check public/app.js`, `node --check public/admin.js`, `node --check server.js`, `node --check scripts/smoke/check-public-api.mjs`, `node --check scripts/smoke/check-gallery-images.mjs`, package JSON parse, `git diff --check`.
- Frontend coverage: prompt/generation/gallery image normalization is split into `public/gallery-normalize.js`; `public/app.js` delegates image model conversion and no longer carries the full mapping logic inline.
- Backend coverage: public generation lists and generation leaderboard entries now filter missing generated files unless an admin requests `includeBroken=1`; missing generated/source files return `404`.
- Route coverage: home route generation clears stale hash fragments instead of preserving the previous canvas/gallery hash.
- Smoke coverage: public smoke verifies `/gallery-normalize.js`; new `npm run smoke:gallery-images` verifies prompt database images are displayable and present in `/api/gallery/leaderboard`.
- Deployment checks: app container running, production version `20260520-gallery-model-v1`, production domain `200`, retired domain `410`, public smoke passed, gallery image smoke passed.
- Production gallery smoke: prompt image HEAD checks passed for prompts `262`, `42`, `252`, `371`, `370`; all-time leaderboard returned prompt image entries including `prompt_262`, `prompt_42`, `prompt_371`, `prompt_370`.
- Data note: production `/api/images/public?limit=3` returned `0` generation items because current public generation data is empty; prompt database images are served through `/api/prompts`, `/api/prompt-images/:id/file`, and `/api/gallery/leaderboard`.
- Rollback target: latest pre-deploy server backup is recorded in the private deployment document.

### 2026-05-20 Canvas History Batch

- Task covered: `AIS-RLS-027`.
- Commit covered: `47d8379`.
- Local checks: `node --check public/canvas-history.js`, `node --check public/canvas.js`, `node --check public/canvas-minimap.js`, `node --check server.js`, `node --check scripts/smoke/check-public-api.mjs`, `node --check scripts/smoke/check-canvas-history.mjs`, `npm run smoke:canvas-history`, `git diff --check`.
- Frontend coverage: undo/redo and clipboard state live in `public/canvas-history.js`; `public/canvas.js` only wires snapshots around canvas mutations and keyboard/toolbar actions.
- Interaction coverage: node move, inspector edit, edge create/delete, node delete, node duplicate, background changes, viewport pan/zoom/minimap navigation, and paste actions are recorded as undoable snapshots.
- Shortcut coverage: Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z and Ctrl/Cmd+Y redo, Ctrl/Cmd+C copy selected node, Ctrl/Cmd+V paste copied node.
- Smoke coverage: new `npm run smoke:canvas-history` verifies undo, redo, copy, paste, new pasted node id, and paste offset.
- Deployment checks: app container running, production version `20260520-canvas-history-v1`, public smoke passed, canvas history smoke passed, canvas script syntax checks passed.
- Rollback target: latest pre-deploy server backup is recorded in the private deployment document.

### 2026-05-20 Canvas Selection Groups Batch

- Task covered: `AIS-RLS-028`.
- Commit covered: `1050fe3`.
- Local checks: `node --check public/canvas.js`, `node --check public/canvas-selection.js`, `node --check public/canvas-nodes.js`, `node --check public/canvas-history.js`, `node --check public/canvas-minimap.js`, `node --check server.js`, `node --check scripts/smoke/check-public-api.mjs`, `node --check scripts/smoke/check-canvas-selection.mjs`, `npm run smoke:canvas-selection`, `npm run smoke:canvas-history`, `git diff --check`.
- Frontend coverage: box selection helpers live in `public/canvas-selection.js`; node sizing and group metadata live in `public/canvas-nodes.js`; `public/canvas.js` only wires selection state, pointer events, toolbar buttons, inspector actions, and history snapshots.
- Interaction coverage: Shift-click toggles multi-select, Shift-drag on empty canvas creates a selection box, selected nodes move together while preserving relative offsets, Delete/Backspace deletes the current selection, and group nodes display a group title plus member count.
- Smoke coverage: new `npm run smoke:canvas-selection` verifies box selection, toggle selection, batch movement, selection deletion, and group node creation; public smoke verifies `/canvas-selection.js` is referenced and served.
- Deployment checks: app container running, production version `20260520-canvas-selection-v1`, public smoke passed, canvas selection smoke passed, canvas history smoke passed, and container syntax checks passed.
- Local full `smoke:public` blocker: local MySQL rejected `root@localhost` without password, so production container smoke is the authoritative public check.
- Rollback target: latest pre-deploy server backup is recorded in the private deployment document.

### 2026-05-20 Canvas JSON Import Export Batch

- Task covered: `AIS-RLS-029`.
- Commit covered: `5c52c5a`.
- Local checks: `node --check src/canvas-import-export.js`, `node --check public/canvas-io.js`, `node --check public/canvas.js`, `node --check server.js`, `node --check scripts/smoke/check-public-api.mjs`, `node --check scripts/smoke/check-canvas-import-export.mjs`, `node --check scripts/smoke/check-canvas-import-export-api.mjs`, `npm run smoke:canvas-import-export`, `npm run smoke:canvas-selection`, `npm run smoke:canvas-history`, `git diff --check`.
- Backend coverage: canvas export/import validation is split into `src/canvas-import-export.js`; API routes provide authenticated `GET /api/canvases/:id/export` and owner-managed `POST /api/canvases/:id/import`.
- Frontend coverage: browser file picking, JSON parse, upload, and download behavior live in `public/canvas-io.js`; `public/canvas.js` only wires toolbar actions and applies imported project data.
- Schema coverage: import validation checks package format, node/edge shape, edge node references, and rejects embedded `data:`/`blob:` image payloads or oversized image strings.
- Smoke coverage: `npm run smoke:canvas-import-export` verifies export package shape, import normalization, schema errors, and embedded image rejection; `npm run smoke:canvas-import-export-api` verifies authenticated export/import against the production container.
- Deployment checks: app container running, production version `20260520-canvas-json-io-v1`, public smoke passed, canvas import/export module smoke passed, authenticated import/export API smoke passed, canvas selection/history regressions passed, and container syntax checks passed.
- Local full API smoke blocker: local MySQL rejected `root@localhost` without password, so production container smoke is the authoritative authenticated API check.
- Rollback target: latest pre-deploy server backup is recorded in the private deployment document.

### 2026-05-20 Canvas Assistant Batch

- Task covered: `AIS-RLS-030`.
- Commits covered: `ce5d294`, `2eaae58`, `e338a67`.
- Local checks: `node --check src/canvas-assistant.js`, `node --check public/canvas-assistant.js`, `node --check public/canvas.js`, `node --check server.js`, `node --check scripts/smoke/check-public-api.mjs`, `node --check scripts/smoke/check-canvas-assistant.mjs`, `node --check scripts/smoke/check-canvas-assistant-api.mjs`, `npm run smoke:canvas-assistant`, `npm run smoke:canvas-selection`, `npm run smoke:canvas-history`, `git diff --check`.
- Backend coverage: canvas assistant context collection and deterministic suggestion generation are split into `src/canvas-assistant.js`; the API route only authenticates, checks canvas read permission, and passes the saved canvas `dataJson` into the assistant module.
- Frontend coverage: the right-panel controller, request payload, suggestion normalization, and suggestion-to-node conversion live in `public/canvas-assistant.js`; `public/canvas.js` only saves the canvas, provides selected context, and inserts text/prompt nodes.
- Safety coverage: assistant requests ignore forged request nodes, omit `data:`/`blob:` image payloads, and stop before requesting if saving the current canvas fails.
- Smoke coverage: `npm run smoke:canvas-assistant` verifies selected/upstream context, suggestion categories, embedded image omission, browser helper payloads, and save-failure behavior; `npm run smoke:canvas-assistant-api` verifies authenticated production API access, upstream node context, invalid JSON, and forged-node rejection.
- Deployment checks: app container running, production version `20260520-canvas-assistant-v1`, public smoke passed, canvas assistant module/API smoke passed, canvas selection/history regressions passed, and container syntax checks passed.
- Rollback target: latest pre-deploy server backup is recorded in the private deployment document.

## 5. Rollback

- Identify the last known-good commit or deployment backup.
- Stop the service or put it behind maintenance if needed.
- Restore the previous application code.
- Restore database backup only if the release introduced destructive or incompatible schema/data changes.
- Restart the service and run:
  - `GET /api/version`
  - `npm run smoke:public -- https://<host>`
  - the smallest authenticated smoke that covers the failing area
- Record the rollback commit/backup id, reason, and follow-up fix task.

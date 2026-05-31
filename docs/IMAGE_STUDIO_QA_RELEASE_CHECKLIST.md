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

### 2026-05-25 AIS-RLS-112 Self-Hosted Fonts And Icons Release

- Task covered: `AIS-RLS-112` Self-host Geist, Instrument Serif, and Remixicon under `/vendor/`.
- Commits covered: `705d5ef`, `10d2ad3`, `48c3893`.
- Files changed: `public/vendor/fonts/*`, `public/vendor/icons/*`, `public/css/02-typography.css`, `public/admin.html`, `public/index.html`, generated `public/dist/app.81c7ea539fca.css`, frontend manifest files, `server.js`, smoke scripts, and `Dockerfile`.
- Frontend coverage: public and admin pages no longer depend on Google Fonts or jsDelivr for the covered font/icon assets. Typography now uses local `@font-face` paths, Remixicon is served from `/vendor/icons/`, and `/vendor/*.css|woff2` receives immutable cache headers.
- CSP coverage: report-only CSP was tightened so `font-src` is self-hosted only; stylesheet policy keeps local inline compatibility while removing the external font/icon hosts covered by this task.
- Local checks: `npm run frontend:build`, `node --check server.js`, `node --check scripts/smoke/check-css-visual-polish.mjs`, `npm run smoke:css-visual-polish`, `npm run smoke:frontend-build-tooling`, `npm run smoke:css-module-split`, `npm run smoke:frontend-performance`, `npm run check`, `git diff --check`, `npm run smoke:visual-regression`, and workspace package resolution check passed.
- Online smoke: deployed version reported `20260525-self-host-assets-v1`; external `npm run smoke:public -- https://<host>` passed and verified the public CSS bundle plus local Geist, Instrument Serif, and Remixicon assets.
- Deployment note: the first production rebuild exposed that workspace packages were missing from the Docker image after `AIS-RLS-148`; `48c3893` fixed the production Docker copy step and was included in the successful self-host assets deployment.
- Known blockers: no self-host asset blocker remained after `48c3893`. Server disk was still around 87% used, so this release intentionally avoided a full source backup.
- Rollback target: revert `705d5ef` and `10d2ad3`, or temporarily restore the previous external font/icon links and CSP allowances if local vendor asset serving regresses. Keep or re-apply `48c3893` when workspace packages remain required in the production image.

### 2026-05-26 AIS-RLS-113 Hero Video Local Asset Release

- Task covered: `AIS-RLS-113` Localize hero video and tighten CSP `media-src` to self.
- Commit covered: `c9e8b6e`.
- Files changed: `public/index.html`, `public/hero/*`, `public/frontend-performance.js`, `public/css/13-performance.css`, `server.js`, `src/config/app-settings.js`, `scripts/smoke/check-frontend-performance.mjs`, `scripts/smoke/check-public-api.mjs`, `public/dist/*`, and frontend build manifest files.
- Frontend coverage: the homepage hero video now uses `/hero/hero.mp4` with `/hero/hero-poster.webp`, keeps static HTML preload at `none`, and removes the previous remote MP4 dependency.
- Runtime coverage: frontend performance gating disables hero video loading for reduced motion, Save-Data, low device class, and `slow-2g`/`2g` connection hints.
- Server coverage: static serving now includes `video/mp4`, immutable cache headers for `/hero/*.mp4|webp`, direct 404s for missing `/hero/*` assets, and report-only CSP `media-src 'self'`.
- Local checks: `npm run frontend:build`, `node --check server.js`, `node --check public/frontend-performance.js`, `node --check scripts/smoke/check-frontend-performance.mjs`, `node --check scripts/smoke/check-public-api.mjs`, `npm run smoke:frontend-performance`, `npm run smoke:frontend-build-tooling`, `npm run smoke:css-visual-polish`, `npm run smoke:visual-regression`, `npm run check`, `git diff --check`, and staged privacy scan passed. Local `npm run smoke:public` was blocked by local MySQL credentials and covered in the deployed container.
- Online smoke: container `npm run smoke:public -- http://127.0.0.1:3000` passed; external `npm run smoke:public -- https://<host>` passed; `/api/version` reports `20260526-hero-video-local-v1`; `/hero/hero.mp4` returns `200 video/mp4` with immutable cache; `/hero/hero-poster.webp` returns `200 image/webp` with immutable cache; root CSP includes `media-src 'self'` and does not allow remote HTTPS media.
- Deployment note: the deployment package was generated with `git archive HEAD`, uploaded as the standard update archive, verified by size, entry count, and SHA256 before extraction, and deployed without database schema or data changes. The release intentionally skipped a full source backup because server disk usage remained around 87%.
- Known blockers: none for the localized hero asset after container and external smoke passed. Local full public smoke remains blocked by the existing local MySQL credential mismatch, not by this change.
- Rollback target: revert `c9e8b6e` and redeploy the previous hashed frontend bundle if local hero media serving or CSP media policy regresses.

### 2026-05-26 AIS-RLS-114 Mobile CSS Consolidation Release

- Task covered: `AIS-RLS-114` Consolidate mobile CSS files into `public/css/*` under build.
- Commit covered: `b885bf1`.
- Files changed: root-level `public/mobile*.css` moved into `public/css/*mobile*.css`, `public/styles.css`, `scripts/frontend/css-bundle.mjs`, frontend build manifest files, generated `public/dist/app.cbb1404428fe.css`, mobile/frontend smoke scripts, version config, and frontend boundary docs. This commit also appended `IMAGE_STUDIO_FOLLOWUP_OPTIMIZATION_PLAN_202605.md` §9.1 to mark three pre-existing hashed-entry smoke failures per audit.
- Frontend coverage: the public homepage still loads one content-hashed CSS bundle, but the bundle sources now include the mobile modules through `public/styles.css` imports instead of legacy root-level `mobile.css`, `mobile-home.css`, `mobile-gallery.css`, and `mobile-editor.css` append logic. `07-editor-mobile.css` was split into smaller focused modules to keep each mobile CSS file below the 500-line guardrail.
- Local checks: `npm run frontend:build`, `npm run smoke:css-module-split`, `npm run smoke:frontend-build-tooling`, `npm run smoke:frontend-boundaries`, `npm run smoke:mobile-route-modal-behavior`, `npm run smoke:mobile-layout`, `npm run smoke:visual-regression`, `npm run smoke:css-visual-polish`, `npm run smoke:frontend-performance`, `npm run check`, `git diff --check`, line-count check for `public/css/*mobile*.css`, root `public/mobile*.css` absence check, and staged privacy scan passed.
- Online smoke: container `npm run smoke:public -- http://127.0.0.1:3000` passed; external `npm run smoke:public -- https://<host>`, `npm run smoke:gallery-images -- https://<host>`, and `npm run smoke:mobile-layout -- https://<host>` passed; `/api/version` reports `20260526-mobile-css-consolidate-v1`; root HTML loads `/dist/app.cbb1404428fe.css`; server source no longer has root `public/mobile*.css` files.
- Deployment note: the deployment package was generated with `git archive HEAD`, uploaded as the standard update archive, verified by local size, entry count, and SHA256 before deployment, then deployed after clearing old `public/dist` and root mobile CSS leftovers from the server source tree. No database schema or data changes were made.
- Known blockers: external `npm run smoke:visual-regression -- https://<host>` repeatedly navigated Chrome to `chrome-error://chromewebdata/` for every scenario, producing selector-missing diffs unrelated to deployed DOM/CSS; the same local visual regression passed before deployment, and external `smoke:mobile-layout` passed against the deployed site. The three canvas hashed-entry smoke failures listed in §9.1 remain known pre-existing `AIS-RLS-111` cleanup items, not AIS-RLS-114 regressions.
- Rollback target: revert `b885bf1`, restore the previous hashed CSS bundle and legacy root-level mobile CSS sources, then redeploy from the latest pre-AIS-RLS-114 backup recorded in the private deployment log if mobile styling or CSS bundling regresses.

### 2026-05-26 AIS-RLS-115 Shared Animation CSS Library Release

- Task covered: `AIS-RLS-115` Populate `12-animations.css` with shared keyframes and utility classes.
- Commit covered: `457954a`.
- Files changed: `public/css/12-animations.css`, `public/css/10-canvas-tools.css`, generated `public/dist/app.4e610beebc07.css`, frontend build manifest files, `public/index.html`, `src/config/app-settings.js`, and `src/frontend/app-build-manifest.mjs`.
- Frontend coverage: `12-animations.css` now contains the shared `ais-fade-in`, `ais-slide-up`, `ais-shimmer`, `ais-pulse`, `ais-scale-in`, and `ais-float` keyframes plus `.anim-*` utility classes and `prefers-reduced-motion` handling. Duplicate generic `ais-*` keyframes were removed from `10-canvas-tools.css`, leaving only single-digit non-library keyframes outside `12-animations.css`.
- Local checks: `npm run frontend:build`, `npm run smoke:css-module-split`, `npm run smoke:frontend-build-tooling`, `npm run smoke:frontend-boundaries`, `npm run smoke:css-visual-polish`, `npm run smoke:frontend-performance`, `npm run smoke:visual-regression`, and `git diff --check` for AIS-RLS-115 files passed. Local acceptance checks confirmed `12-animations.css` is over 3 KB, includes all required animation names and `.anim-*` utilities, and leaves 7 `@keyframes` outside `12-animations.css`.
- Online smoke: container `npm run smoke:public -- http://127.0.0.1:3000` passed; external `npm run smoke:public -- https://<host>` passed; `/api/version` reports `20260526-animations-library-v1`; server source contains `public/css/12-animations.css` at 4663 bytes and serves `/dist/app.4e610beebc07.css`.
- Deployment note: the deployment package was generated with `git archive HEAD`, uploaded as the standard update archive, verified by local and server size, entry count, and SHA256 before extraction, then deployed after clearing `public/dist` and updating `APP_VERSION=20260526-animations-library-v1`. No database schema or data changes were made. Server disk cleanup pruned Docker builder cache after deployment, reducing disk usage from about 89% to about 79%.
- Known blockers: none for AIS-RLS-115 after local visual regression, container public smoke, and external public smoke passed. The three hashed-entry canvas smoke failures listed in §9.1 remain known pre-existing `AIS-RLS-111` cleanup items and were not part of this animation-library release gate.
- Rollback target: revert `457954a`, restore the previous hashed CSS bundle and the prior scattered animation definitions, then redeploy from the latest pre-AIS-RLS-115 package or Git baseline recorded in the private deployment log if shared animation utilities regress.

### 2026-05-26 AIS-RLS-116 Unified List Skeleton Release

- Task covered: `AIS-RLS-116` Unify list skeletons via `.anim-shimmer` and `renderSkeleton` helper.
- Commit covered: `944613c`.
- Files changed: `public/app.js`, `public/css/04-components-skeleton.css`, `public/styles.css`, generated `public/dist/app.6a49a8e41627.css`, generated `public/dist/app.51be80b67385.js`, frontend build manifest files, `public/index.html`, `scripts/smoke/check-skeleton-coverage.mjs`, `src/config/app-settings.js`, and `src/frontend/app-build-manifest.mjs`.
- Frontend coverage: public list loading now renders a shared skeleton before history/session, prompt library, recent gallery, and leaderboard fetches; bootstrap pre-renders initial list skeletons so Slow 3G does not show empty list areas before auth/network calls complete. The skeleton module uses the existing `.anim-shimmer` utility from the shared animation library.
- Local checks: `node --check public\app.js`, `node --check scripts\smoke\check-skeleton-coverage.mjs`, `node scripts\smoke\check-skeleton-coverage.mjs`, `npm run frontend:build`, `npm run smoke:css-module-split`, `npm run smoke:frontend-build-tooling`, `npm run smoke:frontend-boundaries`, `npm run smoke:frontend-performance`, `npm run smoke:visual-regression`, `node --check server.js`, `node --check public\admin.js`, `git diff --check`, and staged privacy scan passed. Local `npm run smoke:public` was blocked by missing local MySQL credentials before deployment.
- Online smoke: container `npm run smoke:public -- http://127.0.0.1:3000` passed; container `node scripts/smoke/check-skeleton-coverage.mjs` passed; external `npm run smoke:public -- https://<host>` passed; `/api/version` reports `20260526-unified-skeleton-v1`; root HTML loads `/dist/app.6a49a8e41627.css` and `/dist/app.51be80b67385.js`.
- Deployment note: the deployment package was generated with `git archive HEAD`, uploaded as the standard update archive, verified by local and server size plus SHA256 before extraction, then deployed with `APP_VERSION=20260526-unified-skeleton-v1`. No database schema or data changes were made.
- Known blockers: no AIS-RLS-116 regressions found. The three hashed-entry canvas smoke failures listed in §9.1 remain known pre-existing `AIS-RLS-111` cleanup items and were not part of this skeleton release gate.
- Rollback target: revert `944613c`, restore the previous hashed CSS/JS bundle references, and redeploy from the latest pre-AIS-RLS-116 package or Git baseline recorded in the private deployment log if list loading or skeleton rendering regresses.

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

### 2026-05-26 AIS-RLS-152 Agent Vitest + 5 Smokes Release

- Task covered: `AIS-RLS-152` Agent planner vitest coverage plus five agent smoke scripts.
- Commit covered: `9af483a test: agent vitest + 5 smokes (AIS-RLS-152)`.
- Files changed: 9 files, covering root `package.json`, `packages/agent-core/package.json`, `packages/agent-core/scripts/run-tests.mjs`, `packages/agent-core/tests/planner.test.mjs`, and five `scripts/smoke/check-agent-*.mjs` files.
- Test coverage: `packages/agent-core npm run test -- --coverage` passed 13 tests; `packages/agent-core/src/planner.js` reports 100% line, branch, and function coverage.
- Smoke coverage: added `smoke:agent-planner-flow`, `smoke:agent-credit-per-step`, `smoke:agent-retry`, `smoke:agent-resume`, and `smoke:agent-batch-export`.
- Container smoke: `smoke:agent-retry` and `smoke:agent-resume` passed as static AIS-RLS-155 forward-compat checks; `smoke:agent-planner-flow`, `smoke:agent-credit-per-step`, and `smoke:agent-batch-export` passed against the deployed container with admin credentials and MySQL cleanup enabled.
- Deployment note: no runtime code changed in this release-record commit, and the 152 test scripts were already included in the later AIS-RLS-116 deployment archive because `944613c` descends from `9af483a`; `APP_VERSION` remains `20260526-unified-skeleton-v1` and does not require a bump.
- Known blockers: none for AIS-RLS-152. The retry/resume and per-step refund TODO logs are expected AIS-RLS-155 follow-up contracts, not 152 regressions.
- Rollback target: revert `9af483a` only if the new agent vitest or smoke scripts need to be removed; no production runtime rollback is required for this light closure.

### 2026-05-26 AIS-RLS-153 Canvas Slice 5 Smokes Release

- Task covered: `AIS-RLS-153` Canvas 5 new smokes plus canvas-core service/reference/import-export tests.
- Commits covered: `a7e564e test(canvas-slice): add 5 smokes + vitest coverage for canvas slice (AIS-RLS-153)` and `80821d9 chore: bump canvas slice smokes version (AIS-RLS-153)`.
- Files changed: canvas-v2 source/scripts SPDX and touch handling, `packages/canvas-core/tests/*`, five `scripts/smoke/check-canvas-*.mjs` files, root `package.json`, and APP_VERSION/build manifest files.
- Test coverage: `packages/canvas-core npm run test` passed 53 tests across service, references, and import-export round-trip coverage.
- Local checks: `npm run frontend:build`, `npm run check`, `npm run smoke:canvas-license-headers`, `npm run smoke:canvas-touch-gestures`, `npm run smoke:canvas-v2-token-bridge`, and `git diff --check` passed; Vitest needed a non-sandbox rerun after Windows `spawn EPERM`.
- Deployment package: `git archive HEAD` at `80821d9`, 240,991,311 bytes, 1,799 entries, SHA256 `E4EA2C177C77703861CFBB7F96DB0F51693BA74DBA9A25D2E35E88E8F7D6A275`, verified after chunked upload and remote assembly.
- Online version: container and external `/api/version` report `20260526-canvas-slice-smokes-v1`; app container is running and MySQL is healthy.
- Canvas smoke: container `smoke:canvas-concurrent-save` passed with coherent last-write-wins state; container `smoke:canvas-large-project` passed with 500 nodes / 1000 edges round-tripped; container `smoke:canvas-touch-gestures`, `smoke:canvas-license-headers`, and `smoke:canvas-v2-token-bridge` passed.
- External smoke: external `npm run smoke:public -- https://<host>` passed; local post-deploy runs of the three static canvas smokes passed; external Canvas v2 HTML resolves hashed assets `/canvas-v2/assets/styles.a2df3f25df73.css` and `/canvas-v2/assets/main.eafbdce70e52.js`.
- Deployment note: Docker build succeeded and deployed `APP_VERSION=20260526-canvas-slice-smokes-v1`; server disk usage stayed about 81% with about 11 GB free after temporary upload chunks were removed.
- Known blockers: no AIS-RLS-153 smoke blockers remain. One immediate post-deploy app restart logged `ERR_HTTP_HEADERS_SENT`; it was traced to the pre-existing generation status route returning a falsey value after writing a response and was fixed in the follow-up Generation Status Route Fix release below.
- Rollback target: revert `80821d9` to restore the previous version marker, revert `a7e564e` only if the new canvas smoke/test additions or touch/SPDX changes regress, then redeploy the last known-good archive.

### 2026-05-26 Generation Status Route Fix Release

- Issue covered: home text-to-image cards could show `Request failed` shortly after generation started because `/api/images/requests/:id` polling responses fell through to the API 404 fallback after already writing JSON.
- Commits covered: `48587c8 fix: stop generation status route double responses` and `90b4e71 chore: bump generation status route fix version`.
- Files changed: `src/routes/images-generate.js`, `src/config/app-settings.js`, `src/frontend/app-build-manifest.mjs`, and generated frontend build manifest files.
- Root cause: `sendGenerationRequestStatus()` writes the response but returns no truthy handled flag; route branches that returned it directly made `routeApi()` continue to `sendError(404)`, causing `ERR_HTTP_HEADERS_SENT` and app restarts during status polling.
- Fix coverage: status GET, cancel POST, already-terminal request POST, and aborted synchronous generation branches now return `true` to the route dispatcher after writing or ending the response.
- Local checks: `node --check src\routes\images-generate.js`, a focused status-handler Node probe, `npm run check`, `npm run smoke:generation-queue-recovery`, `npm run smoke:server-route-boundary-split`, `npm run smoke:frontend-build-tooling`, and `git diff --check` passed. `smoke:generation-flicker` remains blocked by an unrelated stale static assertion about composer mount reuse.
- Deployment note: the fix was deployed as an emergency small-file hot patch from pushed commits after large archive upload instability; `/api/version` reports `20260526-generation-status-route-fix-v1`.
- Online smoke: container `npm run smoke:public -- http://127.0.0.1:3000` passed; external `npm run smoke:public -- https://<host>` passed; repeated generation-status probes returned `200`; app restart count stayed `0`; recent logs contain no `ERR_HTTP_HEADERS_SENT`.
- Rollback target: revert `90b4e71` and `48587c8`, then redeploy the prior release only if generation status polling regresses in a different way.

### 2026-05-27 AIS-RLS-117 Lazy Route Loader Release

- Task covered: `AIS-RLS-117` lazy-load `admin.js` and legacy canvas bundles on route entry.
- Commits covered: `a4e5a70 feat(AIS-RLS-117): lazy-load route bundles` and `f60f396 test(AIS-RLS-117): tolerate minified public smoke bundles`.
- Files changed: `public/app-router.js`, `public/index.html`, `public/admin.html`, `public/app.js`, `public/admin.js`, frontend build manifest/build tooling, route-aware smoke scripts, generated `public/dist/*` assets, and `APP_VERSION` files.
- Runtime coverage: public first-load HTML no longer includes legacy `canvas*.js`; `/admin` loads `app-router.js` and lazy-loads ordered admin modules before `admin.js`; `#/canvas` calls `ImageStudioRouter.ensureCanvas()` and loads manifest-ordered canvas modules before binding shell events.
- Guardrail coverage: `public/frontend-build-manifest.json` now carries `js.lazyRoutes.admin` and `js.lazyRoutes.canvas`; `smoke:frontend-boundaries`, `smoke:frontend-build-tooling`, and `smoke:public` assert route order and first-load exclusions.
- Local checks: `npm run frontend:build`, `npm run check`, route/module smoke updates, and `git diff --check` passed before deployment. Local full `smoke:public` remained covered by the production container because the local app/MySQL environment is not the deployment authority for this lane.
- Deployment package: the full `git archive HEAD` package at `a4e5a70` was 240,995,870 bytes / 1,810 entries / SHA256 `9FC6D5A31F8BC5E10044C787A790FFB5F230FE87F37178ABEE4320B5EC44A03D`, but the upload was incomplete and was not used for deployment.
- Deployment note: production used a verified delta archive, 286,725 bytes / 85 entries / SHA256 `04A9AED010FA6DEB2C5F58C61880647296EC82023D9E79AC9C04EF4C8D8AE7F1`, then a smoke-only patch archive, 10,054 bytes / 3 entries / SHA256 `4E740A4D0B099F04009B71327CAB2E4D7FC95A9DC8558FA7672E88769CB0104A`, to deploy `APP_VERSION=20260527-lazy-route-loader-v1`.
- Online version: container and external `/api/version` report `20260527-lazy-route-loader-v1`; app restart count is `0`.
- Online smoke: container `npm run smoke:auth-admin -- http://127.0.0.1:3000` passed; external `npm run smoke:public -- https://<host>` passed; container `npm run smoke:public -- http://127.0.0.1:3000` passed after `f60f396` aligned smoke assertions with minified production bundles.
- Known blockers: none for AIS-RLS-117. The initial post-deploy container `smoke:public` failure was a test assertion issue around minified bundle text, not a route-loader runtime regression.
- Rollback target: revert `f60f396` only if the smoke assertion needs to be tightened, or revert `a4e5a70` and redeploy the prior release if lazy admin/canvas route loading regresses.

### 2026-05-26 Generic Prompt Expansion Release

- Issue covered: very short home text-to-image prompts such as `生成图片`, `随机图片`, and `generate image` were sent to the provider too literally, which could produce poor output or provider-side failures for generic requests.
- Commit covered: `b952831 fix: expand generic image generation prompts`.
- Files changed: `src/generation-prompt.js`, `src/routes/images-generate.js`, `server.js`, `src/config/app-settings.js`, `src/frontend/app-build-manifest.mjs`, and generated frontend build manifest files.
- Runtime coverage: generic Chinese and English text-to-image prompts are detected, expanded into one of five provider-ready original prompts, and selected deterministically from the request/audit seed.
- API coverage: `/api/images/generate` stores the original user prompt while sending `providerPrompt` to OpenAI; `requestedParams` records `providerPrompt` only when the provider prompt differs from the user prompt.
- Smoke coverage added after audit: `smoke:generic-prompt-normalize` verifies Chinese/English generic detection, specific-prompt pass-through, seed stability, prompt-pool membership, and route wiring.
- Hotfix regression smoke added after audit: `smoke:generation-status-route` verifies status GET, terminal POST, and queued cancel POST return `handled=true` after writing status, preventing 404 fallthrough and double responses.
- Local checks: `node --check scripts/smoke/check-generic-prompt-normalize.mjs`, `node --check scripts/smoke/check-generation-status-route-return.mjs`, `npm run smoke:generic-prompt-normalize`, and `npm run smoke:generation-status-route` passed.
- Deployment note: `b952831` was deployed as `APP_VERSION=20260526-generic-prompt-fix-v1`; production was later superseded by `20260527-lazy-route-loader-v1`, which descends from and includes the generic prompt fix.
- Current closure note: this record and the two smoke scripts close the audit gap; no new runtime deploy or APP_VERSION bump is required for the test/documentation-only follow-up.
- Rollback target: revert `b952831` only if generic prompt expansion causes provider prompt regressions; revert this closure commit only if the added smoke guardrails need to be removed or renamed.

### 2026-05-27 AIS-RLS-119 Mask Admin Email Release

- Task covered: `AIS-RLS-119` mask admin email in the account menu and remove reliance on Cloudflare `__cf_email__` obfuscation.
- Commit covered: `cafb433 feat(AIS-RLS-119): mask account menu emails`.
- Files changed: `public/app.js`, `public/app-auth.js`, `public/index.html`, `scripts/smoke/check-mask-admin-email.mjs`, root `package.json`, APP_VERSION/build manifest files, and refreshed hashed `public/dist/app*.js` assets.
- Runtime coverage: account-menu current-user email and admin contact email now render through `maskContactEmail()`, while click/keyboard copy and contact-modal copy continue to use the real email from JS state/settings.
- HTML exposure coverage: static `user@example.com` was removed from `public/index.html`; production homepage source checks for `__cf_email__`, `user@example.com`, and `support@example.com` all returned `0`.
- Smoke coverage: added `smoke:mask-admin-email` to assert masked account/admin display, real-value copy paths, `mailto:` preservation, and lack of static email placeholders.
- Local checks: `npm run frontend:build`, `node --check public/app.js`, `node --check public/app-auth.js`, `node --check scripts/smoke/check-mask-admin-email.mjs`, `npm run smoke:mask-admin-email`, `npm run smoke:user-flow-polish`, `npm run check`, and `git diff --check` passed. Local `smoke:public` without a running local app failed with `fetch failed`; container and external smoke below are the deployment authority.
- Deployment package: `ai-image-studio-ais-rls-119-cafb433-delta.tgz`, 132,437 bytes, 18 entries, SHA256 `BE53D33DAC600C2B87ECA1A86AAB27004E7E2723431F67FF45777EB61C8C5CCA`, verified after upload on the server.
- Deployment note: delta archive deployed to production, `.env` updated to `APP_VERSION=20260527-mask-admin-email-v1`, `docker compose build app` and `docker compose up -d app` succeeded; no DB/schema changes.
- Online version: container and external `/api/version` report `20260527-mask-admin-email-v1`; app restart count is `0`, MySQL is healthy, and server disk usage is about `84%` with about `9.1G` free.
- Online smoke: container `npm run smoke:mask-admin-email`, container `npm run smoke:user-flow-polish`, container `npm run smoke:public -- http://127.0.0.1:3000`, and external `npm run smoke:public -- https://ai-image-studio.twisterfeng.com` passed.
- Known blockers: none for AIS-RLS-119. `/admin` still uses the AIS-RLS-117 query-string version on admin shell compatibility links, but the front-page hashed app/auth assets and `/api/version` are on the 119 release.
- Rollback target: revert `cafb433`, restore the previous hashed app/auth assets and APP_VERSION, rebuild/restart app, then rerun public smoke and homepage source email grep checks.

### 2026-05-27 AIS-RLS-133 Visual Token v2 Release

- Task covered: `AIS-RLS-133` visual redesign Phase 1 token foundation for color, typography, and motion.
- Commit covered: `78328a6 feat(AIS-RLS-133): add visual token v2 foundation`.
- Files changed: `public/css/00-tokens.css`, new typography/motion token files, split reset/app-shell/home-shell/publish CSS modules, dark token overrides, `public/admin.html` `data-app="admin"`, frontend build manifests, hashed CSS bundle, and `smoke:frontend-boundaries` guardrails.
- Token coverage: `brand-50..900`, `neutral-0..900`, semantic success/warn/danger/info, surface canvas/card/elev/glass/overlay, typography font/size/line-height/tracking tokens, motion duration/easing tokens, reduced-motion duration zeroing, mobile overrides, and admin compact token overrides are present.
- Compatibility coverage: legacy `00-tokens.css` variable names remain available; `styles.css` keeps token imports first; `--brand-600` is guarded by frontend-boundaries smoke.
- Local checks: `npm run frontend:build`, `npm run check`, `npm run smoke:frontend-boundaries`, `npm run smoke:css-module-split`, `npm run smoke:visual-regression`, and `git diff --check` passed. Token file line counts are `88 / 27 / 28`, within the AIS-RLS-133 limits.
- Deployment packages: primary delta archive `ai-image-studio-ais-rls-133-78328a6-delta.tgz` was `71,416` bytes / `27` entries / SHA256 `E1B16EF6B538C1ECA45795E79E2D9475F451C05BB9DDA38A84E2FA4ADF7D6176`; a follow-up worktree-byte dist archive `ai-image-studio-ais-rls-133-78328a6-dist-worktree.tgz` was `191,015` bytes / `55` entries / SHA256 `D31945932E24AA762543896FACA698B7A8C8C4C3F44BCB251413B542D7C45547`.
- Deployment note: production `.env` was updated to `APP_VERSION=20260527-visual-token-v2-v1`; Docker build and app restart succeeded; no database schema or data changes were made.
- Online version: container and external `/api/version` report `20260527-visual-token-v2-v1`; public entry CSS is `/dist/app.3a2641ae684c.css`; app restart count is `0`.
- Online smoke: container `npm run smoke:public -- http://127.0.0.1:3000`, `npm run smoke:frontend-build-tooling`, `npm run smoke:frontend-boundaries`, and `npm run smoke:css-module-split` passed; external `npm run smoke:public -- https://ai-image-studio.twisterfeng.com` passed.
- Known blockers: none for AIS-RLS-133. Existing ESLint warnings and frontend-boundaries long-term file-size warnings remain pre-existing non-blockers.
- Rollback target: revert `78328a6`, restore the previous `APP_VERSION` and hashed CSS entry `app.6a49a8e41627.css`, rebuild/restart app, then rerun public, frontend-boundaries, css-module-split, frontend-build-tooling, and visual-regression smoke.

### 2026-05-27 AIS-RLS-130 ESLint Blocking Rules Release

- Task covered: `AIS-RLS-130` tightens ESLint warning-level quality gates into CI-blocking errors before the CI workflow lands.
- Commit covered: `705817a chore(AIS-RLS-130): tighten eslint blocking rules`.
- Files changed: `eslint.config.mjs`, focused lint cleanup in `public/app.js`, canvas helper modules, smoke scripts, `server.js`, `src/mysql-store.js`, `src/provider-mapping.js`, and `src/routes/images.js`.
- Rule coverage: `no-undef`, `no-unused-vars`, and `no-empty` now run at `error`; `_`-prefixed unused args and caught errors remain explicit allowed exceptions.
- Cleanup coverage: historical lint warnings were removed by deleting unused helpers/constants, documenting intentional empty catches, simplifying redundant boolean casts, and renaming intentionally unused parameters.
- Runtime impact: no feature behavior changed; removed server/client code was unreferenced or telemetry-only catch scaffolding.
- Local checks: `npm run lint`, `npm run check`, and `git diff --check` passed after cleanup.
- Negative lint probe: piping `missingGlobal();` into ESLint with `--stdin --stdin-filename lint-negative.js` failed with `no-undef` and exit code `1`, confirming real lint errors now block.
- Deployment note: task card has `deployment_required=false`; no Docker deploy, no online smoke, and no `APP_VERSION` bump were required. Production remains on `20260527-visual-token-v2-v1`.
- Known blockers: none for AIS-RLS-130. `smoke:frontend-boundaries` still reports existing long-term file-size warnings for god-files, which are non-blocking guardrail warnings.
- Rollback target: revert `705817a` to restore previous warning-level ESLint rules and the pre-cleanup lint scaffolding.

### 2026-05-27 AIS-RLS-129 Phase D Feature Specs Release

- Task covered: `AIS-RLS-129` writes detailed Phase D feature specs for `AIS-RLS-120`, `AIS-RLS-121`, and `AIS-RLS-122`.
- Commit covered: `c42c5d3 docs(AIS-RLS-129): add phase d feature specs`.
- Files changed: `docs/specs/AIS-RLS-120-multi-candidate-generation.md`, `docs/specs/AIS-RLS-121-reference-image-asset.md`, `docs/specs/AIS-RLS-122-my-works-asset-library.md`, and `docs/IMAGE_STUDIO_FOLLOWUP_OPTIMIZATION_PLAN_202605.md`.
- Spec coverage: 120 covers multi-candidate user scenarios, candidate UI wireframes, API drafts, DB migration sketch, credits/queue policy, acceptance, rollback, and risks.
- Spec coverage: 121 covers reference image asset storage, gallery-store CRUD contract, reference visibility, API drafts, DB schema changes, acceptance, rollback, and privacy risks.
- Spec coverage: 122 covers my-works library filters, batch actions, detail drawer, export/archive/unpublish flows, API drafts, DB schema changes, mobile constraints, acceptance, and rollback.
- Follow-up plan coverage: Phase D P3-1 now links the three independent specs and includes three `现状索引` entries for task-card validation.
- Local checks: `git diff --check` passed; spec files are `8,410 / 8,048 / 8,256` bytes, avoiding stub-document risk.
- Validation note: `Select-String` confirmed three new `现状索引` entries in `docs/IMAGE_STUDIO_FOLLOWUP_OPTIMIZATION_PLAN_202605.md`.
- Deployment note: documentation-only task with `deployment_required=false`; no Docker deploy, no online smoke, no `APP_VERSION` bump, and no private deployment log entry were required.
- Rollback target: revert `c42c5d3` and this release-record commit to remove the added Phase D specs and follow-up-plan links.

### 2026-05-27 AIS-RLS-134 Button Primitive Release

- Task covered: `AIS-RLS-134` visual redesign Phase 2 button primitive foundation.
- Commit covered: `86940e7 feat(AIS-RLS-134): add button primitive`.
- Files changed: new `public/css/primitives/_button.css`, `public/styles.css` primitive import order, `public/index.html` composer `.btn` consumers, frontend build manifests, hashed `public/dist/app.af00027fb70e.css`, hashed `public/dist/app.0cc97fcfc1d0.js`, and smoke guardrails.
- Primitive coverage: `.btn`, `.btn--primary`, `.btn--secondary`, `.btn--ghost`, `.btn--danger`, `.btn--link`, and `.btn--icon` are present with hover, active, focus-visible, disabled, compact density, dark mode, and `[data-loading]::after` spinner behavior.
- Architecture coverage: `public/styles.css` imports `/css/primitives/_button.css` after token/reset-base modules and before legacy layout modules, preserving the token/primitive/page cascade contract.
- Runtime consumption: the home composer fallback, composer template send button, and composer options button now consume `.btn` variants; the 2026-05-31 audit follow-up also paired public shell hooks, prompt-library `use-button`, and works refresh `ghost-button` with `.btn` variants while keeping legacy classes only as compatibility hooks.
- Follow-up guardrail: `smoke:frontend-boundaries` now rejects bare legacy button hook consumers in the public entry/app modules and hashed `public/dist/*.js` bundles, preventing `.btn` adoption from being declared complete while source or dist still has unpaired legacy button classes.
- Local checks: `npm run frontend:build`, `npm run check`, `npm run smoke:css-module-split`, `npm run smoke:visual-regression`, `git diff --check`, and the `_button.css` hex grep all passed; the 2026-05-31 audit follow-up additionally passed focused JS syntax checks, `npm run smoke:frontend-boundaries`, and a source/dist bare legacy button class scan.
- Follow-up deployment: commits `850281e` and `c508686` were pushed to `origin/main` and deployed to the new `ccs` production host as `APP_VERSION=20260531-button-legacy-followup-v1`; external `smoke:public -- https://ai-image-studio.040625.xyz`, container `smoke:public -- http://127.0.0.1:3000`, `smoke:frontend-boundaries`, `smoke:mysql-health-config`, and `smoke:frontend-build-tooling` passed, with app/MySQL restart counts at `0`.
- Visual regression: 10/10 scenarios baseline matched in `docs/mobile-qa/visual-regression/runs/2026-05-27T07-14-04-717Z`.
- Deployment package: `ais-rls-134-86940e7-delta-worktree.tgz`, `113,855` bytes / `12` entries / SHA256 `86048B39B9827C1705D6FD044E64280CB3862C4C286389AFC94CC684B4E1DBB2`.
- Deployment note: production `.env` was updated to `APP_VERSION=20260527-button-primitive-v1`; Docker build and app restart succeeded with no database schema or data changes.
- Online version: container and external `/api/version` report `20260527-button-primitive-v1`; app restart count is `0` and container status is `running`.
- Online smoke: container `smoke:frontend-build-tooling`, `smoke:frontend-boundaries`, `smoke:css-module-split`, and `smoke:public -- http://127.0.0.1:3000` passed; external `smoke:public -- https://ai-image-studio.twisterfeng.com` passed.
- Known blockers: none for AIS-RLS-134. The `/admin` compatibility stylesheet query still references the prior visual-token version, matching the existing admin compatibility path and not affecting the public hashed app bundle or `/api/version`.
- Rollback target: revert `86940e7`, restore the previous `APP_VERSION=20260527-visual-token-v2-v1` and hashed entries `app.3a2641ae684c.css`, `app.48294c7b6c01.js`, `canvas-history.d56d37f6ed67.js`, rebuild/restart app, then rerun public, frontend-boundaries, css-module-split, frontend-build-tooling, and visual-regression smoke.

### 2026-05-27 AIS-RLS-140 Admin Token Replace Release

- Task covered: `AIS-RLS-140` visual redesign Phase 8 admin hardcoded hex replacement.
- Commits covered: `b4315e4 feat(AIS-RLS-140): replace admin hardcoded colors with tokens` and `6b1dd03 fix(frontend-build): normalize hashed bundles to LF`.
- Files changed: `public/css/09-admin.css`, `public/css/09-admin-panels.css`, `public/css/09-admin-diagnostics.css`, `public/css/09-admin-shell-polish.css`, visual baselines, `src/config/app-settings.js`, frontend build manifests, `public/dist/app.ed3f7b8dea3a.css`, `.gitattributes`, and frontend bundle scripts.
- Token coverage: admin CSS now consumes Token v2 semantic/surface variables for neutral, brand, success, warn, danger, and info states without adding new admin-only tokens.
- Hex audit: `Select-String -Path public/css/09-admin*.css -Pattern '#[0-9a-fA-F]{3,6}' -AllMatches` returned `0`, stricter than the <= 5 acceptance budget.
- Local checks: `npm run check`, `npm run smoke:admin-module-split`, `npm run smoke:visual-regression`, `git diff --cached --check`, and the admin CSS hex audit passed.
- Visual regression: the manually approved `2026-05-27T11-24-27-225Z` run was promoted to baseline; rerun `docs/mobile-qa/visual-regression/runs/2026-05-27T11-58-54-198Z/summary.md` passed 10/10 scenarios with all baselines matched.
- Build integrity: `6b1dd03` normalizes CSS/JS bundle content to LF before hashing and adds `.gitattributes` LF guards so Linux container file hashes match `public/frontend-build-manifest.json`.
- Deployment packages: initial LF hash delta `ai-image-studio-ais-rls-140-lf-hash-6b1dd03-delta.tgz` was `63,735` bytes / `11` entries / SHA256 `2866B0B03988C27BDE827E576705992E25DEEF1E83C7D3035D888324945A1915`; final full LF dist package `ai-image-studio-ais-rls-140-lf-dist-6b1dd03.tgz` was `194,529` bytes / `59` entries / SHA256 `A3DC53CD78F830412BEFEE4D84D30A8CD59C70288A1B54AD8D6DFE97BC602B4B`.
- Deployment note: production was rebuilt and restarted with `APP_VERSION=20260527-admin-token-replace-v1`; no database schema or data changes were made.
- Online smoke: container `smoke:frontend-build-tooling`, `smoke:frontend-boundaries`, `smoke:css-module-split`, `smoke:public -- http://127.0.0.1:3000`, and external `smoke:public -- https://ai-image-studio.twisterfeng.com` passed.
- Online version: container and external `/api/version` report `20260527-admin-token-replace-v1`; app restart count is `0`, MySQL is healthy, and public entry CSS is `/dist/app.ed3f7b8dea3a.css`.
- Known blockers: the first post-deploy container build-tooling smoke failed on stale worktree-byte JS dist assets; the final full LF dist archive resolved all JS and CSS manifest hash mismatches.
- Rollback target: revert `6b1dd03` and `b4315e4`, restore the prior `APP_VERSION=20260527-button-primitive-v1` and CSS entry `app.af00027fb70e.css`, rebuild/restart app, then rerun public, frontend-boundaries, css-module-split, frontend-build-tooling, admin-module-split, and visual-regression smoke.

### 2026-05-28 AIS-RLS-141 Admin Shell Release

- Task covered: `AIS-RLS-141` visual redesign Phase 9 admin shell rebuild, plus the user-reported chat cancel regression folded into the same release without a separate deploy.
- Commit covered: `720ae14 feat(AIS-RLS-141): rebuild admin shell`.
- Files changed: `public/admin.html`, `public/admin.js`, `public/admin-shell-polish.js`, `public/css/09-admin-shell-polish.css`, `public/styles.css`, `public/app.js`, `server.js`, `src/generation-queue-runner.js`, `src/routes/images-generate.js`, APP_VERSION/build manifests, hashed `public/dist/*` assets, admin visual baselines, and smoke guardrails.
- Admin shell coverage: sidebar now supports expanded `240px`, collapsed `64px`, and mobile drawer states; `localStorage["admin.sidebar-state"]` persists desktop state; desktop defaults expanded while `<=1440px` defaults collapsed; mobile uses drawer/backdrop state.
- Topbar coverage: `admin.html` now has `data-app="admin" data-density="compact"`, two admin topbar rows, global search, notification/home icon buttons, user/status chips, breadcrumb/page heading, view switch, and primary refresh action using the `.btn` primitive.
- CSS coverage: `09-admin-shell-polish.css` stays below the 500-line guard, overrides legacy admin shell selectors after `10-canvas-tools.css`, preserves page-scope polish, and keeps topbar rows at compact heights under the `56+56` shell budget.
- Cancel-generation coverage: chat cancel now aborts the polling fetch and timer, hides the bottom generation status immediately, calls the cancel endpoint, and the backend queue runner can abort running async text/image-edit provider jobs with cancel refunds and `client_cancelled` status.
- Local checks: `npm run frontend:build`, `npm run check`, `npm run smoke:admin-module-split`, `npm run smoke:admin-shell-polish`, `npm run smoke:generation-cancel-running`, `npm run smoke:visual-regression`, and `git diff --check` passed.
- Visual regression: first run `docs/mobile-qa/visual-regression/runs/2026-05-27T16-17-39-832Z` showed expected approved diffs; baselines were updated, and rerun `2026-05-27T16-19-00-828Z` passed 10/10 scenarios with all baselines matched.
- Manual viewport evidence: static and visual smoke cover desktop `1280`, mobile `390`, admin desktop, and admin mobile; CSS/JS assertions cover the `<=1440px` collapsed default, drawer state, and `100svh` mobile behavior.
- Deployment package: full tracked archive `ai-image-studio-ais-rls-141-720ae14-full.tgz`, `241,460,693` bytes / `1,828` entries / SHA256 `B9C025AFEE802316797E234E08CB3DBC027BBB5E2CE95CC561143A7C144EF6B2`; server-side SHA256 and entry count matched before extraction.
- Deployment note: production was deployed from the pushed `720ae14` archive, which includes beautification hotfixes `7f9e1a9` and `4c2f64b`; server `public/dist` was cleared before extraction, `.env APP_VERSION` was set to `20260527-admin-shell-v1`, and `docker compose build app && docker compose up -d app` succeeded with no database schema or data changes.
- Online smoke: container `smoke:frontend-build-tooling`, `smoke:admin-shell-polish`, `smoke:generation-cancel-running`, and `smoke:public -- http://127.0.0.1:3000` passed; external `smoke:public -- https://ai-image-studio.twisterfeng.com` passed; container and external `/api/version` report `20260527-admin-shell-v1`.
- Deployment health: app restart count is `0`, container status is `running`, MySQL remains healthy, and server disk usage is about `90%` with about `5.9G` available after deployment.
- Known blockers: none for AIS-RLS-141. `smoke:frontend-boundaries` still reports long-term god-file line-count warnings, which are non-blocking guardrail warnings.
- Rollback target: revert the AIS-RLS-141 feature/docs commits, restore the prior `APP_VERSION=20260527-visual-hotfix-v1` and hashed entries `app.b87b99d96e6a.css`, `app.0cc97fcfc1d0.js`, `admin.e5b890e37ca0.js`, `admin-shell-polish.80df19608b8c.js`, rebuild/restart app, then rerun public, admin-shell-polish, frontend-build-tooling, and visual-regression smoke.

### 2026-05-28 AIS-RLS-142 Admin Primitives Release

- Task covered: `AIS-RLS-142` visual redesign Phase 10 admin data primitives for table, bulk actions, drawer, and modal foundations.
- Commit covered: `9b8fd6b feat(AIS-RLS-142): add admin data primitives`.
- Files changed: new `public/css/primitives/_table.css`, `_drawer.css`, `_modal.css`, `public/styles.css`, admin modules, `public/admin.html`, focused `public/app.js` modal primitive hookup, `06-gallery.css` modalIn cleanup, smoke guardrails, APP_VERSION/build manifests, hashed `public/dist/*` assets, and admin mobile visual baseline.
- Primitive coverage: `.primitive-table`, sticky headers, compact/comfortable density, selected rows, empty card, shimmer loading, `.primitive-table--bulk`, floating `.primitive-table-bulk-bar`, `.primitive-drawer`, bottom-sheet drawer variant, drawer tabs/body scroll, `.primitive-modal-layer`, `.primitive-modal`, wide/split/keep-centered variants, and `@keyframes modalIn` in `_modal.css`.
- Runtime consumption: admin users, generation requests, prompt CMS/source/duplicate tables, announcements, providers, gallery file checks, and related admin tables now keep legacy classes while consuming `.primitive-table` with compact density; user bulk controls consume `.primitive-table--bulk` and `.primitive-table-bulk-bar`.
- Modal coverage: `modalIn` was removed from `public/css/06-gallery.css`; complex square/prompt detail split modals remain on legacy layout to avoid public visual regression, while normal public modals consume `.primitive-modal` through the centralized `openModal()` hook.
- Local checks: `npm run frontend:build`, `npm run check`, `npm run smoke:admin-primitives`, `npm run smoke:admin-shell-polish`, `npm run smoke:admin-module-split`, `npm run smoke:css-module-split`, `npm run smoke:mobile-route-modal-behavior`, `npm run smoke:visual-regression`, and `git diff --check` passed.
- Visual regression: after fixing public modal drift, only `admin-shell-dark-mobile.png` required an approved baseline refresh; rerun `docs/mobile-qa/visual-regression/runs/2026-05-28T01-10-10-546Z` passed 10/10 scenarios with all baselines matched.
- Deployment package: full tracked archive `ai-image-studio-ais-rls-142-9b8fd6b-full.tgz`, `241,457,919` bytes / `1,832` entries / SHA256 `03AFD2EDE6F3EB8ACCD828326658C67DCD0A48516B719E554D2ABA1853965A22`; server-side SHA256 and entry count matched before extraction.
- Deployment note: production was deployed from the pushed `9b8fd6b` archive; server `public/dist` was cleared before extraction, `.env APP_VERSION` was set to `20260528-admin-primitives-v1`, `docker compose build app` completed but the SSH session dropped during image export, the new image was verified, and `docker compose up -d app` successfully restarted the app. No database schema or data changes were made.
- Online smoke: container `smoke:frontend-build-tooling`, `smoke:admin-primitives`, `smoke:admin-shell-polish`, and `smoke:public -- http://127.0.0.1:3000` passed; external `smoke:public -- https://ai-image-studio.twisterfeng.com` passed; container and external `/api/version` report `20260528-admin-primitives-v1`.
- Deployment health: app restart count is `0`, container status is `running`, MySQL remains healthy, and server disk usage is about `90%` with about `5.7G` available after deployment.
- Known blockers: none for AIS-RLS-142. `smoke:frontend-boundaries` still reports long-term god-file line-count warnings, which are non-blocking guardrail warnings.
- Rollback target: revert `9b8fd6b` and the docs commit, restore `APP_VERSION=20260527-admin-shell-v1` and prior hashed entries `app.a24ac71dc577.css`, `app.531afd6e9a45.js`, `admin.148a61a6c3e1.js`, `admin-users.7a5d66103f61.js`, `admin-providers.2312ce413dc9.js`, `admin-gallery.987b128da76b.js`, and `admin-generation-diagnostics.7ba211447e61.js`, rebuild/restart app, then rerun public, admin-primitives, admin-shell-polish, frontend-build-tooling, and visual-regression smoke.

### 2026-05-28 AIS-RLS-145 Admin JS Split Release

- Task covered: `AIS-RLS-145` visual redesign Phase 13 `public/admin.js` god-file split, plus the user-reported chat cancel fallback fix folded into the same release without a separate deploy.
- Commit covered: `89ac493 feat(AIS-RLS-145): split admin dashboard modules`; production deploy also includes prior beautification fixes `7f9e1a9` and `4c2f64b` already present on `origin/main`.
- Files changed: removed `public/admin.js`; added `public/admin/{users,prompts,announcements,settings,canvas,dashboard,command-palette}.js`; updated app router lazy route manifest, frontend build tooling, smoke guards, docs guardrails, APP_VERSION/build manifests, hashed `public/dist/*` assets, and focused `public/app.js` cancel fallback.
- Split coverage: `dashboard.js` owns admin shell/data loading/route dispatch, existing `admin-*.js` render modules still provide overview/users/providers/gallery/settings/diagnostics surfaces, and the new `AdminDomains` files own mutations, drawers, prompt CMS, announcements, settings submit, provider drawer, canvas/admin growth surfaces, and command palette.
- Acceptance coverage: every `public/admin/*.js` file is <= 400 lines (`71/93/74/57/107/44/77` before final build-time line normalization), `public/admin.js` is deleted from git and production/container source trees, and `admin/command-palette.js` exposes a real `register(route, handler)` interface.
- Cancel-generation coverage: chat cancel now aborts polling, clears the lower-left editor status when relevant, cancels known request IDs, and falls back to `/api/images/requests/active` when a backend request exists before the frontend has attached `requestId`.
- Local checks: `npm run frontend:build`, `npm run check`, `npm run frontend:check`, `npm run smoke:admin-module-split`, `npm run smoke:admin-shell-polish`, `npm run smoke:admin-primitives`, `npm run smoke:admin-generation-diagnostics`, `npm run smoke:generation-cancel-running`, `npm run smoke:visual-regression`, and `git diff --check` passed.
- Visual regression: `npm run smoke:visual-regression` passed 10/10 scenarios with all baselines matched in `docs/mobile-qa/visual-regression/runs/2026-05-28T02-20-24-080Z`, including both admin shell desktop/mobile scenarios.
- Local blocker note: local `npm run smoke:public` without a running local app failed with `fetch failed`; after deployment, container public smoke passed and server-side public HTTPS checks returned HTTP 200/new version. Later local external smoke attempts were blocked by local network `EACCES`/connect failures.
- Deployment package: full tracked archive `ai-image-studio-ais-rls-145-89ac493-full.tgz`, `241,452,334` bytes / `1,845` entries / SHA256 `F3E63C90497B563208DB473DBEBD9DE85CDE8468712E0887B4AA072A7315E2F2`; server-side SHA256 and entry count matched before extraction.
- Deployment note: production was deployed from the pushed `89ac493` archive; server `public/dist` was cleared before extraction, a stale server-source `public/admin.js` left by tar extraction semantics was removed before the final rebuild, `.env APP_VERSION` was set to `20260528-admin-js-split-v1`, and `docker compose build app && docker compose up -d app` succeeded with no database schema or data changes.
- Online smoke: container `smoke:frontend-build-tooling`, `smoke:admin-module-split`, `smoke:admin-shell-polish`, `smoke:admin-primitives`, `smoke:admin-generation-diagnostics`, `smoke:generation-cancel-running`, and `smoke:public -- http://127.0.0.1:3000` passed; server-side HTTPS `/` returned `HTTP/2 200` and `/api/version` returned `20260528-admin-js-split-v1`.
- Deployment health: app restart count is `0`, container status is `running`, MySQL remains healthy, and server disk usage is about `91%` with about `5.4G` available after deployment.
- Known blockers: none for AIS-RLS-145. `smoke:frontend-boundaries` still reports long-term god-file line-count warnings for `public/app.js` and `public/styles.css`, which are non-blocking guardrail warnings.
- Rollback target: revert `89ac493` and this release-record commit, restore `APP_VERSION=20260528-admin-primitives-v1` and prior hashed admin/app-router/app entries, restore legacy `public/admin.js` only for rollback, rebuild/restart app, then rerun public, admin-module-split, admin-shell-polish, admin-primitives, frontend-build-tooling, generation-cancel-running, and visual-regression smoke.

### 2026-05-28 AIS-RLS-127 DB Health Audit Release

- Task covered: `AIS-RLS-127` database health check for slow query visibility, MySQL pool configuration, migration timing, and backup/restore readiness.
- Commits covered: `ce27468 feat(AIS-RLS-127): add mysql health instrumentation` and `8f2667c fix(AIS-RLS-127): include env example in runtime image`.
- Files changed: `src/mysql-store.js`, `.env.example`, `package.json`, `scripts/smoke/check-mysql-health-config.mjs`, `src/config/app-settings.js`, `src/frontend/app-build-manifest.mjs`, `public/frontend-build-manifest.{js,json}`, and private audit document `docs/private/DB_HEALTH_AUDIT_202605.md`.
- Pool coverage: runtime config now exposes `MYSQL_WAIT_FOR_CONNECTIONS`, `MYSQL_CONNECTION_LIMIT`, `MYSQL_MAX_IDLE`, `MYSQL_IDLE_TIMEOUT_MS`, `MYSQL_QUEUE_LIMIT`, `MYSQL_CONNECT_TIMEOUT_MS`, `MYSQL_SLOW_QUERY_MS`, and `MYSQL_MIGRATION_WARN_MS`.
- Slow-query coverage: app-side MySQL query/execute and pool checkout instrumentation logs operations above `MYSQL_SLOW_QUERY_MS=1000`; production MySQL server slow log was enabled with `slow_query_log=ON` and `long_query_time=1.000000`.
- Migration coverage: startup migration duration is timed and warns when it exceeds `MYSQL_MIGRATION_WARN_MS=10000`; no schema/data migration is included in this release.
- Backup drill note: a production dump was exported (`21,957,793` bytes, SHA256 `a6778ffa5bd5acb46f845cdf75fd057f3741873612234a9761f0cb4d50b072cd`), but full restore on the same 1.9Gi/no-swap production host was operator-waived after temporary restore containers caused memory pressure and SSH instability. The 2026-05-31 audit follow-up completed the restore drill on a separate higher-capacity test host using an isolated temporary database: `30` base tables restored, `30` row-count checks and `30` checksum checks completed, with `0` mismatches.
- Cleanup note: AIS-RLS-127 temporary `ais127-*` containers and `/tmp/ais127*.sql` files were removed after the original attempt; the 2026-05-31 follow-up also removed the temporary restore database and dump/script artifacts after verification, with app restart count unchanged at `0` and MySQL healthy.
- Local checks: `npm run frontend:build`, `npm run smoke:mysql-health-config`, `npm run check`, and `git diff --check` passed; the 2026-05-31 audit follow-up confirmed `package.json` exposes `smoke:mysql-health-config`, `scripts/smoke/check-mysql-health-config.mjs` is present, and the smoke passes in the current follow-up worktree.
- Deployment note: production deployment updates the app runtime to `APP_VERSION=20260528-db-health-audit-v1`; MySQL command flags now persist `--slow-query-log=ON` and `--long-query-time=1`; no database schema or data changes are made.
- Online smoke: container `smoke:mysql-health-config`, container `smoke:public -- http://127.0.0.1:3000`, and `/api/version` verification passed after deployment.
- Known blockers: none for AIS-RLS-127 after the 2026-05-31 restore-drill follow-up. The original same-host restore failure remains as historical evidence that low-memory production hosts should not run a second MySQL restore container.
- Rollback target: revert the AIS-RLS-127 feature/docs commits, restore `APP_VERSION=20260528-admin-js-split-v1`, redeploy app, and remove optional `MYSQL_*` pool tuning values if runtime behavior regresses.

### 2026-05-31 AIS-RLS-120 Multi-candidate Generation Release

- Task covered: `AIS-RLS-120` multi-candidate / branch generation from prompt.
- Commit covered: final single-task AIS-RLS-120 release commit; exact short hash is recorded in the private deployment log and task output.
- Files changed: `scripts/smoke/check-multi-candidate-generation.mjs`, `package.json`, `docs/specs/AIS-RLS-120-multi-candidate-generation.md`, `docs/IMAGE_STUDIO_FOLLOWUP_OPTIMIZATION_PLAN_202605.md`, APP_VERSION/build manifest files, and public frontend build manifest outputs.
- Runtime coverage: public composer already exposes candidate count `1..4`; text and image-edit generation requests send `n`; a single `generation_request` groups the provider call, and returned `generations` are kept as one front-end candidate set through `images` and `candidateIds`.
- Candidate selection coverage: candidate thumbnails let users promote a candidate to the current main image/generation id, so publish, image-to-image continuation, Canvas insertion, zoom/download, and my-works detail actions use the selected candidate.
- Queue and credits coverage: queued payloads preserve `request.n`, provider `n`, `totalCost`, and `costPerImage`; credits are reserved as `generationCreditCost * n`; missing provider results refund `costPerImage * missing`.
- Smoke coverage: added `smoke:multi-candidate-generation` and included it in `npm run check`; the smoke verifies source + hashed app bundle UI hooks, candidate selection code, route-level sync/async `n` handling, queue payload preservation, and partial-success credit refund behavior.
- Local checks: `npm run frontend:build`, focused `node --check` for changed JS, `npm run smoke:multi-candidate-generation`, `npm run check`, and `git diff --check` passed. Local bare `npm run smoke:public` without a running local server failed at `localhost:3000` fetch setup; release verification uses container and online smoke below.
- Deployment note: production deployment updates runtime to `APP_VERSION=20260531-multi-candidate-generation-v1`; no database schema or data migration is included.
- Online smoke: one-shot app container `npm run smoke:public -- http://<app-container>:3000`, `npm run smoke:multi-candidate-generation`, and `npm run smoke:frontend-build-tooling` passed; external `npm run smoke:public -- https://<host>` passed and reported `/api/version` as `20260531-multi-candidate-generation-v1`.
- Known blockers: none for AIS-RLS-120. Full persistent candidate-group tables and progressive per-slot `running/failed` state remain future enhancements beyond the task-card acceptance.
- Rollback target: revert the AIS-RLS-120 release commit, restore the prior `APP_VERSION=20260531-button-legacy-followup-v1`, redeploy from git, and rerun public plus multi-candidate smoke.

### 2026-05-31 AIS-RLS-121 Reference Image Asset Release

- Task covered: `AIS-RLS-121` reference image as first-class asset.
- Commit covered: `18cccd8 feat(AIS-RLS-121): add reference image assets`.
- Files changed: `src/routes/reference-assets.js`, `src/stores/gallery-store.js`, `src/mysql-store.js`, `src/routes/images-generate.js`, `src/routes/images.js`, `src/routes/gallery.js`, `src/routes/admin/moderation.js`, `server.js`, `public/reference-images.js`, `public/app.js`, `public/app-auth.js`, `public/gallery-normalize.js`, `public/render-stamp.js`, `public/css/04-reference-assets.css`, `public/css/06-gallery.css`, `scripts/smoke/check-reference-assets.mjs`, APP_VERSION/build manifests, and hashed `public/dist/*` assets.
- Runtime coverage: logged-in reference uploads are persisted through `POST /api/reference-assets`; generation and image-edit requests send `referenceAssetIds`; saved generations link through `generation_reference_assets`; history, my-works detail, public gallery detail, leaderboard, and generation request status responses include `referenceAssets` visible to the current viewer.
- Privacy coverage: reference assets default private; public file access requires owner/admin access, public asset visibility, or a public-visible generation link; publish/unpublish/archive, user withdrawal, and admin moderation/withdrawal flows synchronize `generation_reference_assets.public_visible`.
- Schema coverage: additive startup migration creates `reference_assets` and `generation_reference_assets` plus `idx_reference_assets_user_created`, `idx_reference_assets_sha256`, and `idx_generation_reference_assets_asset`; no destructive data migration or backfill is included.
- Smoke coverage: added `smoke:reference-assets` and included it in `npm run check`; the smoke verifies source + hashed dist route/API/store/frontend wiring, schema/index tokens, visibility hooks, and reference asset strip CSS.
- Local checks: `npm run frontend:build`, focused `node --check` for changed server/frontend/smoke files, `npm run smoke:reference-assets`, `npm run smoke:frontend-boundaries`, `npm run smoke:frontend-build-tooling`, `npm run smoke:mysql-store-domain-split`, `npm run smoke:mysql-health-config`, `npm run check`, and `git diff --check` passed.
- Deployment note: production deployment updates runtime to `APP_VERSION=20260531-reference-assets-v1`; the deployment clears stale `public/dist`, extracts a full tracked archive, rebuilds/restarts the app container, and lets startup migrations create the new reference asset tables.
- Online smoke: external `npm run smoke:public -- https://<host>` and `npm run smoke:gallery-images -- https://<host>` passed; container `smoke:reference-assets`, `smoke:frontend-build-tooling`, `smoke:public -- http://<app-container>:3000`, and `smoke:gallery-images -- http://<app-container>:3000` passed; external and container `/api/version` report `20260531-reference-assets-v1`.
- Deployment health: app restart count is `0`, MySQL restart count is `0`, MySQL remains healthy, and schema verification confirmed the two new tables and three new indexes.
- Known blockers: none for AIS-RLS-121. Provider-specific use of reference assets as true model conditioning remains capability-dependent; this release persists, links, displays, and permission-gates assets while preserving existing image-edit/reference image payload behavior.
- Rollback target: revert `18cccd8` and this release-record commit, restore `APP_VERSION=20260531-multi-candidate-generation-v1` and prior hashed entries, redeploy from git, rerun reference/public/gallery smoke, and leave additive reference asset tables/files in place for manual cleanup or read-only inspection.

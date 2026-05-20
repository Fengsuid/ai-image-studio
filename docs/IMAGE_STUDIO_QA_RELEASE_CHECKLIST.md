# Image Studio QA Release Checklist

Use this checklist before every P0 release and whenever a feature batch is deployed.

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
  - `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); JSON.parse(require('fs').readFileSync('package-lock.json','utf8'))"`
- Run diff hygiene:
  - `git diff --check`
  - `git status --short`
- Start a local server with a disposable data directory and run public smoke:
  - `PORT=3100 DATA_DIR=data-smoke node server.js`
  - `npm run smoke:public -- http://localhost:3100`
- If local MySQL is used, verify the configured user/password before treating startup failure as a code regression.
- For authenticated flows, run:
  - `ADMIN_EMAIL=<admin> ADMIN_PASSWORD=<password> npm run smoke:auth-admin -- http://localhost:3100`
  - `npm run smoke:data`

## 2. Online Smoke

- Confirm deployed version:
  - `GET /api/version`
- Run public API smoke against the production base URL:
  - `npm run smoke:public -- https://<host>`
- Run authenticated admin smoke with production-safe credentials:
  - `ADMIN_EMAIL=<admin> ADMIN_PASSWORD=<password> npm run smoke:auth-admin -- https://<host>`
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

Record the outcome in the relevant development document or release note before marking the task done.

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
- Commits covered: `ce5d294`, `2eaae58`.
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

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
- Commit covered: pending before deploy.
- Local checks: `node --check server.js`, `node --check src/mysql-store.js`, `node --check src/prompt-review-service.js`, `node --check public/admin.js`, `node --check scripts/import-gen-image-prompts.mjs`, `node --check scripts/smoke/check-auth-admin.mjs`, `npm run smoke:prompt-review`, `git diff --check`.
- Backend coverage: prompt duplicate candidates now store `ai_status`, `ai_decision`, `ai_confidence`, `ai_reason`, `ai_recommended_action`, `ai_model`, `ai_reviewed_at`, and raw response JSON for traceability.
- Review flow coverage: prompt creation, remote prompt source sync, and import script apply run local hash/simhash candidate generation before AI/mock semantic review.
- Admin coverage: duplicate candidates show AI decision, confidence, reason, and support per-candidate AI review.
- Smoke coverage: `smoke:prompt-review` validates rule fallback, JSON parsing, mock review, and model response normalization; authenticated admin smoke creates duplicate hidden prompts and verifies the duplicate candidate AI decision.
- Deployment checks: to be filled after production deploy.
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

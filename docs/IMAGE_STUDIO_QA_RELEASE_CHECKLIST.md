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

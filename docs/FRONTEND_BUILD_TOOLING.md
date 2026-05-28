# Frontend Build Tooling

This project still serves legacy `public/*.js` files directly. New modular frontend code should start in `src/frontend` and be built into plain scripts under `public` so the existing deployment path keeps working.

Commands:

- `npm run frontend:check` validates source module metadata.
- `npm run frontend:build` writes generated public manifest assets.
- `npm run smoke:frontend-build-tooling` checks script order and package wiring.

Rules:

- Do not add new feature logic directly to `public/app.js` or `public/admin/dashboard.js` when a module boundary exists.
- Keep generated public assets deterministic and small.
- Keep the plain script fallback until all target browsers and Docker paths are verified with the build output.

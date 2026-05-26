# Agent Workspace

Agent workspace is the isolated frontend sub-application for ai-image-studio agent sessions (plan → confirm → batch generate → export canvas).

## Boundaries

- Source lives under `apps/agent-workspace/src` (`adapters/`, `app/`, `main.js`, `styles.css`).
- Build output goes to `public/agent/assets/main.<hash>.js` + `styles.<hash>.css`, with `public/agent/index.html` referencing only the hashed bundle.
- Browser code must call this project's Node API through `src/adapters/ai-image-studio-api.js`. All fetch paths target the 9 `/api/agent-sessions/*` endpoints frozen in `packages/agent-core/INTERFACE.md` §2.
- Browser code must not store provider API keys or call OpenAI-compatible endpoints directly.
- Backend logic (generation service, planner, routes, session store, DDL) lives in `packages/agent-core/` — see that slice's `INTERFACE.md` for the SemVer contract. This sub-application is a thin client of that backend slice.

## Scripts

```
npm run check       # syntax check (mirrors apps/canvas-v2)
npm run typecheck   # alias of check
npm run build       # check + emit hashed assets into public/agent/
```

From the repo root: `npm run agent:check` and `npm run agent:build`.

## License

This sub-application is `UNLICENSED` (see `package.json`). This differs from `packages/agent-core/` (the backend slice does not enforce AGPL either; sub-applications under `apps/` may carry distinct licenses per product/business decision — `apps/canvas-v2/` is AGPL-3.0-or-later, this workspace is UNLICENSED). The choice is intentional and may be revisited if/when the agent workspace is open-sourced.

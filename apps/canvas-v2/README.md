# Canvas v2

Canvas v2 is the future isolated frontend workspace for ai-image-studio canvas editing.

This directory intentionally starts as a small TypeScript source baseline. It defines the source boundary, API adapter boundary, schema conversion boundary, and upstream licensing notes before the larger editor migration begins.

## Boundaries

- Source lives under `apps/canvas-v2/src`.
- Build output will be generated into `public/canvas-v2` by a later task.
- Browser code must call this project's Node API through `src/adapters/ai-image-studio-api.ts`.
- Browser code must not store provider API keys or call OpenAI-compatible endpoints directly.
- Go, Gin, GORM, upstream database schemas, upstream user systems, and demo pages are not part of this app.
- Existing `public/canvas*.js` files are not modified by this Phase 0 baseline.

## Upstream

The migration plan references `basketikun/infinite-canvas` as the upstream product and interaction reference. See `UPSTREAM.md` for source, license, and migration notes.

## License

Files in this sub-application are licensed under AGPL-3.0-or-later unless a file states otherwise. See `LICENSE.md` and `UPSTREAM.md`.

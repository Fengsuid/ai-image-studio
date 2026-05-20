# Upstream Notes

## Source

- Upstream repository: `https://github.com/basketikun/infinite-canvas`
- Upstream license: AGPL-3.0
- Upstream release observed during planning: `v0.0.5` on 2026-05-20
- Upstream stack observed during planning: Next.js, React, TypeScript, Tailwind CSS, Ant Design, Zustand, TanStack Query, Go, Gin, GORM, Docker
- Migration date: 2026-05-21

## Phase 0 Import Decision

No upstream source files are copied in this baseline. This task establishes the local sub-application boundary and the compliance files needed before code import.

Later tasks may migrate or reimplement selected frontend canvas behaviors:

- infinite pan and zoom
- node creation, drag, resize, copy, paste, delete
- edge routing and upstream dependency traversal
- minimap and keyboard interactions
- project save and restore through ai-image-studio APIs

## Explicitly Excluded

The following upstream capabilities must not be imported into the browser bundle:

- browser-stored provider API keys
- browser direct calls to OpenAI-compatible image APIs
- Go, Gin, GORM backend code
- upstream user/account system
- upstream database schema
- unrelated demo pages or local-only examples

## Required Integration Rule

Canvas v2 must use this project's existing backend for login, CSRF, credits, rate limits, provider routing, generation, file storage, canvas persistence, and gallery publishing.

All write requests must pass through the `apiFetch` wrapper so `credentials: "same-origin"` and `X-CSRF-Token` are consistently applied.

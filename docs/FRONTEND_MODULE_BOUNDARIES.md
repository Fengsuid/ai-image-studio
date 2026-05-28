# Frontend Module Boundaries

This note is the working guardrail for future frontend changes. Run `npm run smoke:frontend-boundaries` before handing off UI, gallery, admin, composer, or CSS work.

## Entry Files

Do not add new feature flows directly to public/app.js. Keep it as the legacy state/router bridge and move new public UI logic into `AppModules` or focused helper modules.

Do not add new admin flows directly to `public/admin/dashboard.js`. Add or extend a focused `public/admin/*.js` domain module or an `admin-*.js` render module and expose it through `AdminDomains` or `AdminModules`.

Keep `public/styles.css` as the compatibility import entry only. New CSS belongs in `public/css/*.css`, scoped by the owning visual domain.

## Public App Modules

Use these locations for new public frontend work:

| Area | Owner |
| --- | --- |
| Session list and chat session rendering | `public/app-session.js` or `public/image-session-list.js` |
| Generation result actions and composer-adjacent helpers | `public/app-generation.js` or `public/generation-result-actions.js` |
| Gallery cards, detail media, route display, tags, leaderboard | `public/app-gallery.js` plus `public/gallery-*.js` |
| Credits detail modal, check-in panel, reward ledger display | `public/app-credits-detail.js` |
| Public-work reward copy and publish confirmation policy | `public/app-reward-policy.js` |
| Reference image parsing and payloads | `public/reference-images.js` |
| Canvas-specific behavior | `public/canvas-*.js` |

`public/app.js` may call these modules, but it should not absorb their implementation.

## Admin Modules

Use `AdminModules` for admin surface area:

| Area | Owner |
| --- | --- |
| Admin shell, data loading, route dispatch | `public/admin/dashboard.js` |
| User mutations, prompt CMS, announcements, settings submit, provider drawer, command palette | `public/admin/*.js` |
| Dashboard and overview cards | `public/admin-overview.js` |
| User list, drawer, credits operations | `public/admin-users.js` |
| Provider configuration | `public/admin-providers.js` |
| Square review and gallery file checks | `public/admin-gallery.js` |
| Generation diagnostics | `public/admin-generation-diagnostics.js` |
| System settings, reward policy controls, settings submit payload | `public/admin-settings.js` |

`public/admin.html` loads `public/app-router.js`; the ordered admin module list lives in `public/frontend-build-manifest.json` under `js.lazyRoutes.admin`, with admin modules before `public/admin/dashboard.js`.

## CSS Modules

Use the existing CSS split:

| Area | Owner |
| --- | --- |
| Tokens, theme, reset, type | `public/css/00-*.css`, `01-reset.css`, `02-typography.css` |
| Shared primitives | `public/css/primitives/_*.css` |
| Shell, topbar, layout, composer shell | `public/css/03-*.css` |
| Shared cards, forms, modals, controls | `public/css/04-*.css` |
| Home and composer refinements | `public/css/05-*.css` |
| Gallery, detail modal, leaderboard | `public/css/06-*.css` |
| Image editor | `public/css/07-editor.css`, `public/css/07-editor-mobile*.css` |
| Chat workspace | `public/css/08-chat.css`, `public/css/11-mobile-shell.css` |
| Admin | `public/css/09-*.css` |
| Canvas | `public/css/10-*.css` |
| Mobile bottom nav and global mobile overrides | `public/css/11-mobile.css`, `public/css/11-mobile-shell.css` |
| Motion and visual polish | `public/css/12-*.css` |

Avoid dumping view-specific rules into shared component files unless the selector is reused across multiple views.

## Checks

`npm run smoke:frontend-boundaries` validates:

- Entry file growth budgets for `public/app.js`, `public/admin/*.js`, and `public/styles.css`.
- `AppModules` and `AdminModules` registration and script loading order.
- CSS module import order and per-file line budget.
- This document stays present and points future work to the correct modules.

The current budgets are intentionally near the existing file sizes. They prevent new uncontrolled growth while the long-term targets in `docs/CODE_MAINTENANCE_OPTIMIZATION.md` remain the refactor direction.

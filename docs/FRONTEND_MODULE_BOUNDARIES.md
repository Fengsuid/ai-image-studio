# Frontend Module Boundaries

This note is the working guardrail for future frontend changes. Run `npm run smoke:frontend-boundaries` before handing off UI, gallery, admin, composer, or CSS work.

## Entry Files

Do not add new feature flows directly to public/app.js. Keep it as the legacy state/router bridge and move new public UI logic into `AppModules` or focused helper modules.

Do not add new admin flows directly to `public/admin/dashboard.js`. Add or extend a focused `public/admin/*.js` domain module or an `admin-*.js` render module and expose it through `AdminDomains` or `AdminModules`.

Keep `public/styles.css` as the compatibility import entry only. New CSS belongs in the `public/css` token, primitive, page, or mobile layer scoped by the owning visual domain.

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

`public/app-gallery.js` exposes a `createController(deps)` domain boundary. It owns gallery/library rendering, tag filters, card event binding, leaderboard loading, gallery detail lookup/dispatch, cached gallery metadata, and prompt/gallery like synchronization. `public/app.js` may keep small compatibility adapters for cross-domain callers, but gallery business bodies must stay in the controller.

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

Use the AIS-RLS-146 CSS architecture:

| Area | Owner |
| --- | --- |
| Tokens and theme aliases | `public/css/00-*.css`, `public/css/tokens.css` |
| Shared primitives only | `public/css/primitives/_*.css` |
| Reset and typography consumers | `public/css/pages/reset*.css`, `public/css/pages/typography.css` |
| Shell, topbar, layout, composer shell | `public/css/pages/layout*.css`, `public/css/pages/home-shell.css`, `public/css/pages/home-composer.css` |
| Shared page components and reference assets | `public/css/pages/components*.css`, `public/css/pages/reference-assets.css` |
| Home refinements | `public/css/pages/home*.css` |
| Gallery, detail modal, leaderboard | `public/css/pages/gallery*.css`, `public/css/pages/works-carousel.css` |
| Image editor | `public/css/pages/editor.css`, `public/css/mobile/_mobile-editor.css` |
| Chat workspace | `public/css/pages/chat.css`, `public/css/mobile/_safe-area.css` |
| Admin | `public/css/pages/admin*.css` |
| Canvas | `public/css/pages/canvas*.css` |
| Motion primitives and utilities | `public/css/primitives/_motion*.css` |
| Premium and performance polish | `public/css/pages/premium*.css`, `public/css/pages/visual-polish.css`, `public/css/pages/performance.css` |
| Mobile safe area, bottom nav, global overrides | `public/css/mobile/_safe-area.css`, `_bottom-nav.css`, `_mobile-overrides.css`, `_mobile-editor.css`, `_premium.css` |

Avoid dumping view-specific rules into primitives. `public/css/primitives/_*.css` may define reusable `.btn` or `.primitive-*` APIs only; page selectors belong in `public/css/pages/*.css`, and mobile overrides belong in `public/css/mobile/_*.css`.

## Checks

`npm run smoke:frontend-boundaries` validates:

- Entry file growth budgets for `public/app.js`, `public/admin/*.js`, and `public/styles.css`.
- `AppModules` and `AdminModules` registration and script loading order.
- CSS module import order and per-file line budget.
- Primitive boundaries through `npm run smoke:css-primitive-boundaries`: page files may consume but not define `.btn` or `.primitive-*`, primitive files must not contain page-scope selectors, and consumer-layer hard-coded hex stays within the task budget.
- This document stays present and points future work to the correct modules.

The current budgets are intentionally near the existing file sizes. They prevent new uncontrolled growth while the long-term targets in `docs/CODE_MAINTENANCE_OPTIMIZATION.md` remain the refactor direction.

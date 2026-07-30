# Changelog

All notable public-facing changes to this project are documented here. Entries focus on user-visible behavior and omit private deployment details.

## 2026-07-30 - AIS-RLS-164 Gallery Module Extraction

### Changed

- Moved gallery list rendering, filters, card interactions, leaderboard orchestration, gallery detail dispatch, cache helpers, API loading, and prompt/gallery likes from `public/app.js` into a substantive `public/app-gallery.js` controller.
- Reduced the public app entry from 5815 to 5023 physical lines while expanding the gallery module from 28 to 1070 lines of independently testable domain logic.
- Rebuilt the content-hashed public bundles and updated gallery-specific smoke guards to follow the new module boundary and manifest entries.

### Validation

- Added controller-level tests for gallery deduplication, rank keys, tag ordering, source counting, tag view models, and gallery-id detail dispatch.
- Reviewed desktop and mobile gallery screenshots. The light desktop baseline matched; dark-mode diffs were limited to previously changed filter/navigation styling and showed no structural or interaction regression.

## 2026-07-30 - AIS-RLS-163 Canvas v2 Regression Window Gate

### Added

- Added a local Canvas v2 regression evidence ledger and an offline smoke that reports the 30-day archive deadline, days remaining, current blocking regressions, last full-green time, and whether AIS-RLS-159 may proceed.
- Added a strict `--require-ready` mode for the future Canvas v1 archive task and deterministic `--as-of` support for reproducing gate decisions.

### Changed

- Replaced the purely manual Canvas v1 archive waiting rule with an auditable command backed by recorded static, entry, editor, and generation smoke results.

## 2026-07-28 - AIS-RLS-162 CI Smoke Coverage Expansion

### Added

- Added 16 database-free functional smokes to the default `npm run check` CI aggregate, covering auth/session boundaries, admin/public module splits, server/store boundaries, migrations, provider capabilities, generation recovery/status handling, and Canvas editor/generation/history behaviors.
- Added a complete 91-script dependency classification to the QA checklist so offline, fixture-server, disposable-MySQL, and production/manual release checks have explicit execution policies.

### Changed

- Increased the default CI smoke aggregate from 8 to 24 commands without relying on missing credentials, a prestarted server, or production MySQL.
- Documented two genuine offline smoke failures as follow-up work instead of skipping them or counting them as passing coverage.

## 2026-05-26 - AIS-RLS-116 Unified List Skeletons

### Added

- Added consistent loading skeletons for image history, generation sessions, prompt library, public gallery, and gallery leaderboard lists.
- Added a shared skeleton style module so list loading states use the same shimmer behavior across the public app.

### Changed

- List views now show structured placeholders before network responses arrive, reducing blank states on slow connections.

## 2026-05-26 - AIS-RLS-115 Shared Animation Library

### Added

- Added a shared animation utility library for common fades, slides, shimmer, pulse, scale, and float effects.
- Added reduced-motion handling for shared animation helpers so motion-sensitive users get a calmer interface.

### Changed

- Reused shared animation helpers in loading and interaction states instead of scattering one-off animation rules.

## 2026-05-26 - AIS-RLS-114 Mobile CSS Consolidation

### Changed

- Consolidated legacy mobile styles into the modular public CSS structure.
- Kept the public page on a single bundled stylesheet path while preserving mobile layout behavior.

### Fixed

- Removed duplicated legacy mobile stylesheet entry points from the public loading path.
- Clarified known hashed-asset smoke limitations in public release notes so mobile CSS regressions are easier to triage.

## 2026-05-25 to 2026-05-26 - AIS-RLS-112 and AIS-RLS-113 CDN Domain Reduction

### Added

- Added local font, icon, hero video, and hero poster assets for the public experience.
- Added slow-connection behavior that avoids eager hero video loading when the network is constrained.

### Changed

- Replaced external font, icon, and hero media dependencies with local assets in the first-visit public page path.
- Tightened public asset loading so the first screen depends less on third-party availability.

## 2026-05-25 - AIS-RLS-111 Hashed Public Bundles

### Changed

- Switched public JavaScript assets to content-hashed bundle names for safer browser caching.
- Updated public asset discovery to use the generated frontend build manifest.

### Fixed

- Updated public smoke coverage to recognize hashed JavaScript and stylesheet assets.

## 2026-05-24 - User Flow Polish

### Added

- Initial user flow polish.

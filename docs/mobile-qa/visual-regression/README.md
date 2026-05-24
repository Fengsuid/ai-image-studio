# Visual Regression QA Harness

AIS-RLS-093 adds a low-dependency visual regression smoke for the polished frontend:

```powershell
npm run smoke:visual-regression
npm run smoke:visual-regression -- http://localhost:3000
```

Default mode starts a local static server with fixed mock API data. Passing an origin runs the same shallow screenshot matrix against a local container, SSH tunnel, or production host.

## Coverage

- Home hero and Composer in light desktop and dark mobile.
- Gallery / prompt library cards in light desktop and dark mobile.
- Gallery detail modal, prompt detail modal, editor image state, and My Works detail drawer.
- Admin shell in light desktop and dark mobile.
- Automated checks for horizontal overflow, modal overflow, bottom navigation overlap, dark-mode white surfaces, collapsed cards, tiny/offscreen controls, and obvious text overflow.

## Output Policy

- Temporary runs go to `docs/mobile-qa/visual-regression/runs/<timestamp>/`.
- Baselines use `docs/mobile-qa/visual-regression/baselines/current/`.
- Both run output and binary baselines are ignored by `.gitignore` to avoid accidental screenshot commits.
- Promote baselines only after manual review, then force-add intentionally if a release needs to publish image baselines.

## Baseline And Diff

- Without a baseline, the smoke passes with a warning and writes screenshots plus `summary.md`.
- To require existing baselines, run with `VISUAL_REGRESSION_REQUIRE_BASELINE=1`.
- Pixel comparison supports PNG screenshots with `VISUAL_REGRESSION_PIXEL_DIFF_THRESHOLD` (default `0.012`) and `VISUAL_REGRESSION_CHANNEL_TOLERANCE` (default `18`).

## Cleanup

- Keep only the latest approved local run for manual review.
- Delete stale `runs/<timestamp>` directories after the release record is written.
- Do not commit generated screenshots unless a specific visual baseline review calls for it.

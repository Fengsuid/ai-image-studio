(function initFrontendBuildManifest(global) {
  "use strict";

  const manifest = Object.freeze({
  "version": "20260525-css-bundle-v1",
  "sourceRoot": "src/frontend",
  "outputs": [
    {
      "source": "src/frontend/app-build-manifest.mjs",
      "file": "/frontend-build-manifest.js",
      "json": "/frontend-build-manifest.json",
      "global": "window.AppModules.build"
    }
  ],
  "css": {
    "bundler": "scripts/frontend/css-bundle.mjs",
    "entryPattern": "/dist/app.<hash>.css",
    "compatibilityEntry": "/styles.css",
    "legacyMobileSources": [
      "/mobile-gallery.css",
      "/mobile.css",
      "/mobile-home.css",
      "/mobile-editor.css"
    ],
    "entry": "/dist/app.a4dfaf24076c.css",
    "file": "/dist/app.a4dfaf24076c.css",
    "hash": "a4dfaf24076c",
    "bytes": 264942,
    "sources": [
      "/css/00-tokens.css",
      "/css/00-theme.css",
      "/css/01-reset.css",
      "/css/02-typography.css",
      "/css/03-layout.css",
      "/css/03-layout-shell.css",
      "/css/04-components.css",
      "/css/04-components-cards.css",
      "/css/04-components-modals.css",
      "/css/04-components-forms.css",
      "/css/05-home.css",
      "/css/05-home-onboarding.css",
      "/css/05-home-composer.css",
      "/css/06-gallery.css",
      "/css/06-credits-detail.css",
      "/css/06-works-carousel.css",
      "/css/06-prompt-library-polish.css",
      "/css/06-gallery-detail.css",
      "/css/06-gallery-leaderboard.css",
      "/css/06-gallery-leaderboard-responsive.css",
      "/css/07-editor.css",
      "/css/08-chat.css",
      "/css/08-chat-polish.css",
      "/css/09-admin.css",
      "/css/09-admin-panels.css",
      "/css/09-admin-diagnostics.css",
      "/css/09-admin-shell-polish.css",
      "/css/10-canvas.css",
      "/css/10-canvas-tools.css",
      "/css/11-mobile.css",
      "/css/12-animations.css",
      "/css/12-visual-polish.css",
      "/css/13-performance.css",
      "/mobile-gallery.css",
      "/mobile.css",
      "/mobile-home.css",
      "/mobile-editor.css"
    ]
  },
  "compatibility": {
    "mode": "plain-script-fallback",
    "requiresAppModules": true
  }
});
  const register = global.AppModules && typeof global.AppModules.register === "function"
    ? global.AppModules.register
    : null;
  if (register) {
    register("build", manifest);
  } else {
    global.AppModules = global.AppModules || {};
    global.AppModules.build = manifest;
  }
})(window);

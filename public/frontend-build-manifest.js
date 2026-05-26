(function initFrontendBuildManifest(global) {
  "use strict";

  const manifest = Object.freeze({
  "version": "20260526-canvas-slice-smokes-v1",
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
    "mobileModuleSources": [
      "/css/06-gallery-mobile.css",
      "/css/11-mobile-shell.css",
      "/css/05-home-mobile.css",
      "/css/07-editor-mobile.css",
      "/css/07-editor-mobile-works.css",
      "/css/07-editor-mobile-detail.css",
      "/css/07-editor-mobile-narrow.css"
    ],
    "entry": "/dist/app.6a49a8e41627.css",
    "file": "/dist/app.6a49a8e41627.css",
    "hash": "6a49a8e41627",
    "bytes": 279514,
    "sources": [
      "/vendor/icons/remixicon.min.css",
      "/vendor/icons/remixicon-compat.css",
      "/css/00-tokens.css",
      "/css/00-theme.css",
      "/css/01-reset.css",
      "/css/02-typography.css",
      "/css/03-layout.css",
      "/css/03-layout-shell.css",
      "/css/04-components.css",
      "/css/04-components-skeleton.css",
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
      "/css/06-gallery-mobile.css",
      "/css/11-mobile-shell.css",
      "/css/05-home-mobile.css",
      "/css/07-editor-mobile.css",
      "/css/07-editor-mobile-works.css",
      "/css/07-editor-mobile-detail.css",
      "/css/07-editor-mobile-narrow.css"
    ]
  },
  "js": {
    "bundler": "scripts/frontend/js-bundle.mjs",
    "entryPattern": "/dist/<name>.<hash>.js",
    "compatibilityManifest": "/frontend-build-manifest.js",
    "assets": [
      {
        "source": "/cache-db.js",
        "entry": "/dist/cache-db.99371f753a3d.js",
        "fileName": "cache-db.99371f753a3d.js",
        "hash": "99371f753a3d",
        "bytes": 12585
      },
      {
        "source": "/canvas-store.js",
        "entry": "/dist/canvas-store.1cf902df1827.js",
        "fileName": "canvas-store.1cf902df1827.js",
        "hash": "1cf902df1827",
        "bytes": 590
      },
      {
        "source": "/canvas-nodes.js",
        "entry": "/dist/canvas-nodes.32dba5093bad.js",
        "fileName": "canvas-nodes.32dba5093bad.js",
        "hash": "32dba5093bad",
        "bytes": 3201
      },
      {
        "source": "/canvas-geometry.js",
        "entry": "/dist/canvas-geometry.b7cb6e6ee549.js",
        "fileName": "canvas-geometry.b7cb6e6ee549.js",
        "hash": "b7cb6e6ee549",
        "bytes": 2666
      },
      {
        "source": "/canvas-layout.js",
        "entry": "/dist/canvas-layout.e33b2e874aab.js",
        "fileName": "canvas-layout.e33b2e874aab.js",
        "hash": "e33b2e874aab",
        "bytes": 982
      },
      {
        "source": "/canvas-edges.js",
        "entry": "/dist/canvas-edges.91c942cdf88f.js",
        "fileName": "canvas-edges.91c942cdf88f.js",
        "hash": "91c942cdf88f",
        "bytes": 3451
      },
      {
        "source": "/canvas-workflows.js",
        "entry": "/dist/canvas-workflows.bd604d0a3e08.js",
        "fileName": "canvas-workflows.bd604d0a3e08.js",
        "hash": "bd604d0a3e08",
        "bytes": 2155
      },
      {
        "source": "/canvas-minimap.js",
        "entry": "/dist/canvas-minimap.4c90f27b19c5.js",
        "fileName": "canvas-minimap.4c90f27b19c5.js",
        "hash": "4c90f27b19c5",
        "bytes": 5464
      },
      {
        "source": "/canvas-selection.js",
        "entry": "/dist/canvas-selection.c3fa573f59bc.js",
        "fileName": "canvas-selection.c3fa573f59bc.js",
        "hash": "c3fa573f59bc",
        "bytes": 3612
      },
      {
        "source": "/canvas-history.js",
        "entry": "/dist/canvas-history.6c9bb97ea191.js",
        "fileName": "canvas-history.6c9bb97ea191.js",
        "hash": "6c9bb97ea191",
        "bytes": 4098
      },
      {
        "source": "/canvas-io.js",
        "entry": "/dist/canvas-io.288398b429f6.js",
        "fileName": "canvas-io.288398b429f6.js",
        "hash": "288398b429f6",
        "bytes": 2522
      },
      {
        "source": "/canvas-assistant.js",
        "entry": "/dist/canvas-assistant.348a84502255.js",
        "fileName": "canvas-assistant.348a84502255.js",
        "hash": "348a84502255",
        "bytes": 8576
      },
      {
        "source": "/canvas-toolbar.js",
        "entry": "/dist/canvas-toolbar.be54b8689891.js",
        "fileName": "canvas-toolbar.be54b8689891.js",
        "hash": "be54b8689891",
        "bytes": 3647
      },
      {
        "source": "/canvas-inspector.js",
        "entry": "/dist/canvas-inspector.0be3a2046a53.js",
        "fileName": "canvas-inspector.0be3a2046a53.js",
        "hash": "0be3a2046a53",
        "bytes": 5711
      },
      {
        "source": "/canvas-market.js",
        "entry": "/dist/canvas-market.7a7038f493ec.js",
        "fileName": "canvas-market.7a7038f493ec.js",
        "hash": "7a7038f493ec",
        "bytes": 8297
      },
      {
        "source": "/canvas.js",
        "entry": "/dist/canvas.00162b39b08b.js",
        "fileName": "canvas.00162b39b08b.js",
        "hash": "00162b39b08b",
        "bytes": 43261
      },
      {
        "source": "/gallery-normalize.js",
        "entry": "/dist/gallery-normalize.382dc2e2bc1a.js",
        "fileName": "gallery-normalize.382dc2e2bc1a.js",
        "hash": "382dc2e2bc1a",
        "bytes": 7781
      },
      {
        "source": "/gallery-leaderboard.js",
        "entry": "/dist/gallery-leaderboard.262487e08077.js",
        "fileName": "gallery-leaderboard.262487e08077.js",
        "hash": "262487e08077",
        "bytes": 4808
      },
      {
        "source": "/prompt-cover-fallback.js",
        "entry": "/dist/prompt-cover-fallback.82cfaa310007.js",
        "fileName": "prompt-cover-fallback.82cfaa310007.js",
        "hash": "82cfaa310007",
        "bytes": 5896
      },
      {
        "source": "/editor-image-import.js",
        "entry": "/dist/editor-image-import.16fa7738eeb1.js",
        "fileName": "editor-image-import.16fa7738eeb1.js",
        "hash": "16fa7738eeb1",
        "bytes": 1582
      },
      {
        "source": "/image-session-list.js",
        "entry": "/dist/image-session-list.9342ee01c223.js",
        "fileName": "image-session-list.9342ee01c223.js",
        "hash": "9342ee01c223",
        "bytes": 2326
      },
      {
        "source": "/render-stamp.js",
        "entry": "/dist/render-stamp.e2f8a5c802ef.js",
        "fileName": "render-stamp.e2f8a5c802ef.js",
        "hash": "e2f8a5c802ef",
        "bytes": 1311
      },
      {
        "source": "/generation-result-actions.js",
        "entry": "/dist/generation-result-actions.e0f284bbbdcb.js",
        "fileName": "generation-result-actions.e0f284bbbdcb.js",
        "hash": "e0f284bbbdcb",
        "bytes": 3523
      },
      {
        "source": "/gallery-detail-media.js",
        "entry": "/dist/gallery-detail-media.fde42fddab51.js",
        "fileName": "gallery-detail-media.fde42fddab51.js",
        "hash": "fde42fddab51",
        "bytes": 3084
      },
      {
        "source": "/gallery-tag-view-model.js",
        "entry": "/dist/gallery-tag-view-model.5e80aa7dfdda.js",
        "fileName": "gallery-tag-view-model.5e80aa7dfdda.js",
        "hash": "5e80aa7dfdda",
        "bytes": 1703
      },
      {
        "source": "/reference-images.js",
        "entry": "/dist/reference-images.8744ba40b43a.js",
        "fileName": "reference-images.8744ba40b43a.js",
        "hash": "8744ba40b43a",
        "bytes": 1798
      },
      {
        "source": "/theme-mobile-nav.js",
        "entry": "/dist/theme-mobile-nav.559adf7e6634.js",
        "fileName": "theme-mobile-nav.559adf7e6634.js",
        "hash": "559adf7e6634",
        "bytes": 4068
      },
      {
        "source": "/home-onboarding.js",
        "entry": "/dist/home-onboarding.905b04bb602a.js",
        "fileName": "home-onboarding.905b04bb602a.js",
        "hash": "905b04bb602a",
        "bytes": 3270
      },
      {
        "source": "/frontend-performance.js",
        "entry": "/dist/frontend-performance.97f18262f415.js",
        "fileName": "frontend-performance.97f18262f415.js",
        "hash": "97f18262f415",
        "bytes": 6006
      },
      {
        "source": "/app-modules.js",
        "entry": "/dist/app-modules.3d39777d1fb8.js",
        "fileName": "app-modules.3d39777d1fb8.js",
        "hash": "3d39777d1fb8",
        "bytes": 371
      },
      {
        "source": "/app-prompt-library.js",
        "entry": "/dist/app-prompt-library.6ae0ad00120a.js",
        "fileName": "app-prompt-library.6ae0ad00120a.js",
        "hash": "6ae0ad00120a",
        "bytes": 23592
      },
      {
        "source": "/app-session.js",
        "entry": "/dist/app-session.cb246caa103c.js",
        "fileName": "app-session.cb246caa103c.js",
        "hash": "cb246caa103c",
        "bytes": 427
      },
      {
        "source": "/app-generation.js",
        "entry": "/dist/app-generation.03f335bee962.js",
        "fileName": "app-generation.03f335bee962.js",
        "hash": "03f335bee962",
        "bytes": 445
      },
      {
        "source": "/app-gallery.js",
        "entry": "/dist/app-gallery.2f99cf34d026.js",
        "fileName": "app-gallery.2f99cf34d026.js",
        "hash": "2f99cf34d026",
        "bytes": 731
      },
      {
        "source": "/app-reward-policy.js",
        "entry": "/dist/app-reward-policy.86bc4a4e0ce4.js",
        "fileName": "app-reward-policy.86bc4a4e0ce4.js",
        "hash": "86bc4a4e0ce4",
        "bytes": 2606
      },
      {
        "source": "/app-credits-detail.js",
        "entry": "/dist/app-credits-detail.205196ebb46c.js",
        "fileName": "app-credits-detail.205196ebb46c.js",
        "hash": "205196ebb46c",
        "bytes": 6150
      },
      {
        "source": "/app-auth.js",
        "entry": "/dist/app-auth.48a7630b8ff5.js",
        "fileName": "app-auth.48a7630b8ff5.js",
        "hash": "48a7630b8ff5",
        "bytes": 35385
      },
      {
        "source": "/app-settings.js",
        "entry": "/dist/app-settings.93ea62051bd6.js",
        "fileName": "app-settings.93ea62051bd6.js",
        "hash": "93ea62051bd6",
        "bytes": 32364
      },
      {
        "source": "/app.js",
        "entry": "/dist/app.51be80b67385.js",
        "fileName": "app.51be80b67385.js",
        "hash": "51be80b67385",
        "bytes": 270686
      }
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

(function initFrontendBuildManifest(global) {
  "use strict";

  const manifest = Object.freeze({
  "version": "20260602-admin-cards-v1",
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
      "/css/mobile/_safe-area.css",
      "/css/mobile/_bottom-nav.css",
      "/css/mobile/_mobile-overrides.css",
      "/css/mobile/_mobile-editor.css"
    ],
    "entry": "/dist/app.8ca20247ff8d.css",
    "file": "/dist/app.8ca20247ff8d.css",
    "hash": "8ca20247ff8d",
    "bytes": 336743,
    "sources": [
      "/vendor/icons/remixicon.min.css",
      "/vendor/icons/remixicon-compat.css",
      "/css/00-tokens.css",
      "/css/00-tokens-typography.css",
      "/css/00-tokens-motion.css",
      "/css/01-motion-library.css",
      "/css/01-reset-base.css",
      "/css/primitives/_button.css",
      "/css/primitives/_table.css",
      "/css/primitives/_drawer.css",
      "/css/primitives/_modal.css",
      "/css/primitives/_card.css",
      "/css/03-layout-app-shell.css",
      "/css/05-home-shell.css",
      "/css/00-theme.css",
      "/css/01-reset.css",
      "/css/02-typography.css",
      "/css/03-layout.css",
      "/css/03-layout-shell.css",
      "/css/04-components.css",
      "/css/04-components-skeleton.css",
      "/css/04-components-cards.css",
      "/css/04-reference-assets.css",
      "/css/04-components-modals.css",
      "/css/04-components-forms.css",
      "/css/05-home-publish.css",
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
      "/css/10-canvas.css",
      "/css/10-canvas-tools.css",
      "/css/09-admin-shell-polish.css",
      "/css/12-animations.css",
      "/css/12-visual-polish.css",
      "/css/14-premium-ambient.css",
      "/css/14-premium-interactions.css",
      "/css/14-premium-mobile.css",
      "/css/13-performance.css",
      "/css/mobile/_safe-area.css",
      "/css/mobile/_bottom-nav.css",
      "/css/mobile/_mobile-overrides.css",
      "/css/mobile/_mobile-editor.css"
    ]
  },
  "js": {
    "bundler": "scripts/frontend/js-bundle.mjs",
    "entryPattern": "/dist/<name>.<hash>.js",
    "compatibilityManifest": "/frontend-build-manifest.js",
    "lazyRoutes": {
      "admin": {
        "entry": "/admin/dashboard.js",
        "scripts": [
          "/admin-generation-diagnostics.js",
          "/admin-overview.js",
          "/admin-users.js",
          "/admin-providers.js",
          "/admin-gallery.js",
          "/admin-settings.js",
          "/admin-shell-polish.js",
          "/admin/users.js",
          "/admin/prompts.js",
          "/admin/announcements.js",
          "/admin/settings.js",
          "/admin/canvas.js",
          "/admin/command-palette.js",
          "/admin/dashboard.js"
        ]
      },
      "canvas": {
        "entry": "/canvas.js",
        "scripts": [
          "/cache-db.js",
          "/canvas-store.js",
          "/canvas-nodes.js",
          "/canvas-geometry.js",
          "/canvas-layout.js",
          "/canvas-edges.js",
          "/canvas-workflows.js",
          "/canvas-minimap.js",
          "/canvas-selection.js",
          "/canvas-history.js",
          "/canvas-io.js",
          "/canvas-assistant.js",
          "/canvas-toolbar.js",
          "/canvas-inspector.js",
          "/canvas-market.js",
          "/canvas.js"
        ]
      }
    },
    "assets": [
      {
        "source": "/client-error-monitor.js",
        "entry": "/dist/client-error-monitor.bd6d619329b8.js",
        "fileName": "client-error-monitor.bd6d619329b8.js",
        "hash": "bd6d619329b8",
        "bytes": 1803,
        "lazy": false
      },
      {
        "source": "/cache-db.js",
        "entry": "/dist/cache-db.7fb6d9be5a85.js",
        "fileName": "cache-db.7fb6d9be5a85.js",
        "hash": "7fb6d9be5a85",
        "bytes": 6299,
        "lazy": false
      },
      {
        "source": "/gallery-normalize.js",
        "entry": "/dist/gallery-normalize.33178b9ef0e4.js",
        "fileName": "gallery-normalize.33178b9ef0e4.js",
        "hash": "33178b9ef0e4",
        "bytes": 4031,
        "lazy": false
      },
      {
        "source": "/gallery-leaderboard.js",
        "entry": "/dist/gallery-leaderboard.718f18567f86.js",
        "fileName": "gallery-leaderboard.718f18567f86.js",
        "hash": "718f18567f86",
        "bytes": 3396,
        "lazy": false
      },
      {
        "source": "/prompt-cover-fallback.js",
        "entry": "/dist/prompt-cover-fallback.85ff23aeb1f6.js",
        "fileName": "prompt-cover-fallback.85ff23aeb1f6.js",
        "hash": "85ff23aeb1f6",
        "bytes": 4204,
        "lazy": false
      },
      {
        "source": "/editor-image-import.js",
        "entry": "/dist/editor-image-import.4e887d9302f5.js",
        "fileName": "editor-image-import.4e887d9302f5.js",
        "hash": "4e887d9302f5",
        "bytes": 918,
        "lazy": false
      },
      {
        "source": "/image-session-list.js",
        "entry": "/dist/image-session-list.4fc599f08985.js",
        "fileName": "image-session-list.4fc599f08985.js",
        "hash": "4fc599f08985",
        "bytes": 1689,
        "lazy": false
      },
      {
        "source": "/render-stamp.js",
        "entry": "/dist/render-stamp.c227d14b8f43.js",
        "fileName": "render-stamp.c227d14b8f43.js",
        "hash": "c227d14b8f43",
        "bytes": 836,
        "lazy": false
      },
      {
        "source": "/generation-result-actions.js",
        "entry": "/dist/generation-result-actions.9c8eb70a2cc8.js",
        "fileName": "generation-result-actions.9c8eb70a2cc8.js",
        "hash": "9c8eb70a2cc8",
        "bytes": 2780,
        "lazy": false
      },
      {
        "source": "/gallery-detail-media.js",
        "entry": "/dist/gallery-detail-media.1fb06c259865.js",
        "fileName": "gallery-detail-media.1fb06c259865.js",
        "hash": "1fb06c259865",
        "bytes": 1805,
        "lazy": false
      },
      {
        "source": "/gallery-tag-view-model.js",
        "entry": "/dist/gallery-tag-view-model.c571728e3020.js",
        "fileName": "gallery-tag-view-model.c571728e3020.js",
        "hash": "c571728e3020",
        "bytes": 1033,
        "lazy": false
      },
      {
        "source": "/reference-images.js",
        "entry": "/dist/reference-images.2a49717532ca.js",
        "fileName": "reference-images.2a49717532ca.js",
        "hash": "2a49717532ca",
        "bytes": 2583,
        "lazy": false
      },
      {
        "source": "/theme-mobile-nav.js",
        "entry": "/dist/theme-mobile-nav.f4dfdc7c4b38.js",
        "fileName": "theme-mobile-nav.f4dfdc7c4b38.js",
        "hash": "f4dfdc7c4b38",
        "bytes": 2337,
        "lazy": false
      },
      {
        "source": "/home-onboarding.js",
        "entry": "/dist/home-onboarding.90c9c7e9081c.js",
        "fileName": "home-onboarding.90c9c7e9081c.js",
        "hash": "90c9c7e9081c",
        "bytes": 2081,
        "lazy": false
      },
      {
        "source": "/frontend-performance.js",
        "entry": "/dist/frontend-performance.fe1903333b62.js",
        "fileName": "frontend-performance.fe1903333b62.js",
        "hash": "fe1903333b62",
        "bytes": 3148,
        "lazy": false
      },
      {
        "source": "/app-modules.js",
        "entry": "/dist/app-modules.62d2be8eccda.js",
        "fileName": "app-modules.62d2be8eccda.js",
        "hash": "62d2be8eccda",
        "bytes": 177,
        "lazy": false
      },
      {
        "source": "/app-motion.js",
        "entry": "/dist/app-motion.9af09538e19a.js",
        "fileName": "app-motion.9af09538e19a.js",
        "hash": "9af09538e19a",
        "bytes": 1000,
        "lazy": false
      },
      {
        "source": "/app-prompt-library.js",
        "entry": "/dist/app-prompt-library.0cbc364e260e.js",
        "fileName": "app-prompt-library.0cbc364e260e.js",
        "hash": "0cbc364e260e",
        "bytes": 19924,
        "lazy": false
      },
      {
        "source": "/app-router.js",
        "entry": "/dist/app-router.5ee30c7a69af.js",
        "fileName": "app-router.5ee30c7a69af.js",
        "hash": "5ee30c7a69af",
        "bytes": 6263,
        "lazy": false
      },
      {
        "source": "/app-session.js",
        "entry": "/dist/app-session.f114f9b43f24.js",
        "fileName": "app-session.f114f9b43f24.js",
        "hash": "f114f9b43f24",
        "bytes": 233,
        "lazy": false
      },
      {
        "source": "/app-generation.js",
        "entry": "/dist/app-generation.e35f45ede78f.js",
        "fileName": "app-generation.e35f45ede78f.js",
        "hash": "e35f45ede78f",
        "bytes": 248,
        "lazy": false
      },
      {
        "source": "/app-gallery.js",
        "entry": "/dist/app-gallery.1371dffd2dc6.js",
        "fileName": "app-gallery.1371dffd2dc6.js",
        "hash": "1371dffd2dc6",
        "bytes": 430,
        "lazy": false
      },
      {
        "source": "/app-reward-policy.js",
        "entry": "/dist/app-reward-policy.033f4a267aaa.js",
        "fileName": "app-reward-policy.033f4a267aaa.js",
        "hash": "033f4a267aaa",
        "bytes": 1723,
        "lazy": false
      },
      {
        "source": "/app-credits-detail.js",
        "entry": "/dist/app-credits-detail.126f97475f96.js",
        "fileName": "app-credits-detail.126f97475f96.js",
        "hash": "126f97475f96",
        "bytes": 4857,
        "lazy": false
      },
      {
        "source": "/app-auth.js",
        "entry": "/dist/app-auth.73e9ec63e8f9.js",
        "fileName": "app-auth.73e9ec63e8f9.js",
        "hash": "73e9ec63e8f9",
        "bytes": 27985,
        "lazy": false
      },
      {
        "source": "/app-settings.js",
        "entry": "/dist/app-settings.9c3c23a8a771.js",
        "fileName": "app-settings.9c3c23a8a771.js",
        "hash": "9c3c23a8a771",
        "bytes": 26009,
        "lazy": false
      },
      {
        "source": "/app.js",
        "entry": "/dist/app.02b52df3318b.js",
        "fileName": "app.02b52df3318b.js",
        "hash": "02b52df3318b",
        "bytes": 185222,
        "lazy": false
      },
      {
        "source": "/admin-generation-diagnostics.js",
        "entry": "/dist/admin-generation-diagnostics.0e0479f19c77.js",
        "fileName": "admin-generation-diagnostics.0e0479f19c77.js",
        "hash": "0e0479f19c77",
        "bytes": 9308,
        "lazy": true
      },
      {
        "source": "/admin-overview.js",
        "entry": "/dist/admin-overview.b5e55ba789db.js",
        "fileName": "admin-overview.b5e55ba789db.js",
        "hash": "b5e55ba789db",
        "bytes": 7266,
        "lazy": true
      },
      {
        "source": "/admin-users.js",
        "entry": "/dist/admin-users.4f06f2003144.js",
        "fileName": "admin-users.4f06f2003144.js",
        "hash": "4f06f2003144",
        "bytes": 3685,
        "lazy": true
      },
      {
        "source": "/admin-providers.js",
        "entry": "/dist/admin-providers.ebd59cc1eda7.js",
        "fileName": "admin-providers.ebd59cc1eda7.js",
        "hash": "ebd59cc1eda7",
        "bytes": 2294,
        "lazy": true
      },
      {
        "source": "/admin-gallery.js",
        "entry": "/dist/admin-gallery.fd3e4586edfc.js",
        "fileName": "admin-gallery.fd3e4586edfc.js",
        "hash": "fd3e4586edfc",
        "bytes": 3625,
        "lazy": true
      },
      {
        "source": "/admin-settings.js",
        "entry": "/dist/admin-settings.47a5cd502709.js",
        "fileName": "admin-settings.47a5cd502709.js",
        "hash": "47a5cd502709",
        "bytes": 3659,
        "lazy": true
      },
      {
        "source": "/admin-shell-polish.js",
        "entry": "/dist/admin-shell-polish.4c966f012f22.js",
        "fileName": "admin-shell-polish.4c966f012f22.js",
        "hash": "4c966f012f22",
        "bytes": 4513,
        "lazy": true
      },
      {
        "source": "/admin/users.js",
        "entry": "/dist/admin-users.f826c642f180.js",
        "fileName": "admin-users.f826c642f180.js",
        "hash": "f826c642f180",
        "bytes": 5468,
        "lazy": true
      },
      {
        "source": "/admin/prompts.js",
        "entry": "/dist/admin-prompts.33015b0c4872.js",
        "fileName": "admin-prompts.33015b0c4872.js",
        "hash": "33015b0c4872",
        "bytes": 11157,
        "lazy": true
      },
      {
        "source": "/admin/announcements.js",
        "entry": "/dist/admin-announcements.e1006db383e8.js",
        "fileName": "admin-announcements.e1006db383e8.js",
        "hash": "e1006db383e8",
        "bytes": 5239,
        "lazy": true
      },
      {
        "source": "/admin/settings.js",
        "entry": "/dist/admin-settings.eabecb7d20f8.js",
        "fileName": "admin-settings.eabecb7d20f8.js",
        "hash": "eabecb7d20f8",
        "bytes": 1435,
        "lazy": true
      },
      {
        "source": "/admin/canvas.js",
        "entry": "/dist/admin-canvas.3c0dea4f41a0.js",
        "fileName": "admin-canvas.3c0dea4f41a0.js",
        "hash": "3c0dea4f41a0",
        "bytes": 8504,
        "lazy": true
      },
      {
        "source": "/admin/command-palette.js",
        "entry": "/dist/admin-command-palette.17a06c2d9ce3.js",
        "fileName": "admin-command-palette.17a06c2d9ce3.js",
        "hash": "17a06c2d9ce3",
        "bytes": 2252,
        "lazy": true
      },
      {
        "source": "/admin/dashboard.js",
        "entry": "/dist/admin-dashboard.3ff3372e1de9.js",
        "fileName": "admin-dashboard.3ff3372e1de9.js",
        "hash": "3ff3372e1de9",
        "bytes": 22421,
        "lazy": true
      },
      {
        "source": "/canvas-store.js",
        "entry": "/dist/canvas-store.341c29113a54.js",
        "fileName": "canvas-store.341c29113a54.js",
        "hash": "341c29113a54",
        "bytes": 353,
        "lazy": true
      },
      {
        "source": "/canvas-nodes.js",
        "entry": "/dist/canvas-nodes.393a54ffbbf7.js",
        "fileName": "canvas-nodes.393a54ffbbf7.js",
        "hash": "393a54ffbbf7",
        "bytes": 2063,
        "lazy": true
      },
      {
        "source": "/canvas-geometry.js",
        "entry": "/dist/canvas-geometry.f47c60239634.js",
        "fileName": "canvas-geometry.f47c60239634.js",
        "hash": "f47c60239634",
        "bytes": 1291,
        "lazy": true
      },
      {
        "source": "/canvas-layout.js",
        "entry": "/dist/canvas-layout.ae978c88f99a.js",
        "fileName": "canvas-layout.ae978c88f99a.js",
        "hash": "ae978c88f99a",
        "bytes": 551,
        "lazy": true
      },
      {
        "source": "/canvas-edges.js",
        "entry": "/dist/canvas-edges.093c06109a2c.js",
        "fileName": "canvas-edges.093c06109a2c.js",
        "hash": "093c06109a2c",
        "bytes": 1755,
        "lazy": true
      },
      {
        "source": "/canvas-workflows.js",
        "entry": "/dist/canvas-workflows.96332964c5d2.js",
        "fileName": "canvas-workflows.96332964c5d2.js",
        "hash": "96332964c5d2",
        "bytes": 1034,
        "lazy": true
      },
      {
        "source": "/canvas-minimap.js",
        "entry": "/dist/canvas-minimap.5642d63458cf.js",
        "fileName": "canvas-minimap.5642d63458cf.js",
        "hash": "5642d63458cf",
        "bytes": 3168,
        "lazy": true
      },
      {
        "source": "/canvas-selection.js",
        "entry": "/dist/canvas-selection.f946be66da06.js",
        "fileName": "canvas-selection.f946be66da06.js",
        "hash": "f946be66da06",
        "bytes": 1871,
        "lazy": true
      },
      {
        "source": "/canvas-history.js",
        "entry": "/dist/canvas-history.33b2660bb690.js",
        "fileName": "canvas-history.33b2660bb690.js",
        "hash": "33b2660bb690",
        "bytes": 1989,
        "lazy": true
      },
      {
        "source": "/canvas-io.js",
        "entry": "/dist/canvas-io.c91475c44c29.js",
        "fileName": "canvas-io.c91475c44c29.js",
        "hash": "c91475c44c29",
        "bytes": 1498,
        "lazy": true
      },
      {
        "source": "/canvas-assistant.js",
        "entry": "/dist/canvas-assistant.27ba371fcb20.js",
        "fileName": "canvas-assistant.27ba371fcb20.js",
        "hash": "27ba371fcb20",
        "bytes": 5223,
        "lazy": true
      },
      {
        "source": "/canvas-toolbar.js",
        "entry": "/dist/canvas-toolbar.8669ddb922ec.js",
        "fileName": "canvas-toolbar.8669ddb922ec.js",
        "hash": "8669ddb922ec",
        "bytes": 2308,
        "lazy": true
      },
      {
        "source": "/canvas-inspector.js",
        "entry": "/dist/canvas-inspector.b5edcb984a94.js",
        "fileName": "canvas-inspector.b5edcb984a94.js",
        "hash": "b5edcb984a94",
        "bytes": 4253,
        "lazy": true
      },
      {
        "source": "/canvas-market.js",
        "entry": "/dist/canvas-market.5bfc2216bf68.js",
        "fileName": "canvas-market.5bfc2216bf68.js",
        "hash": "5bfc2216bf68",
        "bytes": 5306,
        "lazy": true
      },
      {
        "source": "/canvas.js",
        "entry": "/dist/canvas.39943e4b91aa.js",
        "fileName": "canvas.39943e4b91aa.js",
        "hash": "39943e4b91aa",
        "bytes": 23711,
        "lazy": true
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

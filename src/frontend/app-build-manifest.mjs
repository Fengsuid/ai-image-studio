export const FRONTEND_BUILD_VERSION = "20260602-mobile-consolidation-v1";

export const frontendBuildManifest = Object.freeze({
  version: FRONTEND_BUILD_VERSION,
  sourceRoot: "src/frontend",
  outputs: [
    {
      source: "src/frontend/app-build-manifest.mjs",
      file: "/frontend-build-manifest.js",
      json: "/frontend-build-manifest.json",
      global: "window.AppModules.build"
    }
  ],
  css: {
    bundler: "scripts/frontend/css-bundle.mjs",
    entryPattern: "/dist/app.<hash>.css",
    compatibilityEntry: "/styles.css",
    mobileModuleSources: [
      "/css/mobile/_safe-area.css",
      "/css/mobile/_bottom-nav.css",
      "/css/mobile/_mobile-overrides.css",
      "/css/mobile/_mobile-editor.css"
    ]
  },
  js: {
    bundler: "scripts/frontend/js-bundle.mjs",
    entryPattern: "/dist/<name>.<hash>.js",
    compatibilityManifest: "/frontend-build-manifest.js",
    lazyRoutes: {
      admin: {
        entry: "/admin/dashboard.js",
        scripts: [
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
      canvas: {
        entry: "/canvas.js",
        scripts: [
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
    }
  },
  compatibility: {
    mode: "plain-script-fallback",
    requiresAppModules: true
  }
});

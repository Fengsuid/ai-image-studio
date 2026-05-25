export const FRONTEND_BUILD_VERSION = "20260525-css-bundle-v1";

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
    legacyMobileSources: [
      "/mobile-gallery.css",
      "/mobile.css",
      "/mobile-home.css",
      "/mobile-editor.css"
    ]
  },
  compatibility: {
    mode: "plain-script-fallback",
    requiresAppModules: true
  }
});

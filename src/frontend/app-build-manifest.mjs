export const FRONTEND_BUILD_VERSION = "20260526-canvas-slice-smokes-v1";

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
      "/css/06-gallery-mobile.css",
      "/css/11-mobile-shell.css",
      "/css/05-home-mobile.css",
      "/css/07-editor-mobile.css",
      "/css/07-editor-mobile-works.css",
      "/css/07-editor-mobile-detail.css",
      "/css/07-editor-mobile-narrow.css"
    ]
  },
  js: {
    bundler: "scripts/frontend/js-bundle.mjs",
    entryPattern: "/dist/<name>.<hash>.js",
    compatibilityManifest: "/frontend-build-manifest.js"
  },
  compatibility: {
    mode: "plain-script-fallback",
    requiresAppModules: true
  }
});

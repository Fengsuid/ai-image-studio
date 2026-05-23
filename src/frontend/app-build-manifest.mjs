export const FRONTEND_BUILD_VERSION = "20260523-frontend-tooling-v1";

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
  compatibility: {
    mode: "plain-script-fallback",
    requiresAppModules: true
  }
});

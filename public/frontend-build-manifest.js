(function initFrontendBuildManifest(global) {
  "use strict";

  const manifest = Object.freeze({
  "version": "20260523-frontend-tooling-v1",
  "sourceRoot": "src/frontend",
  "outputs": [
    {
      "source": "src/frontend/app-build-manifest.mjs",
      "file": "/frontend-build-manifest.js",
      "json": "/frontend-build-manifest.json",
      "global": "window.AppModules.build"
    }
  ],
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

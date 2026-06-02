#!/usr/bin/env node
import assert from "node:assert/strict";
import { frontendBuildManifest } from "../../src/frontend/app-build-manifest.mjs";

assert.equal(typeof frontendBuildManifest.version, "string");
assert.match(frontendBuildManifest.version, /^\d{8}-[a-z0-9-]+-v\d+$/);
assert.equal(frontendBuildManifest.sourceRoot, "src/frontend");
assert.ok(Array.isArray(frontendBuildManifest.outputs));
assert.ok(frontendBuildManifest.outputs.length > 0);
assert.equal(frontendBuildManifest.css?.bundler, "scripts/frontend/css-bundle.mjs");
assert.equal(frontendBuildManifest.css?.entryPattern, "/dist/app.<hash>.css");
assert.equal(frontendBuildManifest.css?.compatibilityEntry, "/styles.css");
assert.deepEqual(frontendBuildManifest.css?.mobileModuleSources, [
  "/css/mobile/_safe-area.css",
  "/css/mobile/_bottom-nav.css",
  "/css/mobile/_mobile-overrides.css",
  "/css/mobile/_mobile-editor.css",
  "/css/mobile/_premium.css"
]);
assert.equal(frontendBuildManifest.js?.bundler, "scripts/frontend/js-bundle.mjs");
assert.equal(frontendBuildManifest.js?.entryPattern, "/dist/<name>.<hash>.js");
assert.equal(frontendBuildManifest.js?.compatibilityManifest, "/frontend-build-manifest.js");
assert.deepEqual(frontendBuildManifest.js?.lazyRoutes?.admin?.scripts, [
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
]);
assert.deepEqual(frontendBuildManifest.js?.lazyRoutes?.canvas?.scripts, [
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
]);

for (const output of frontendBuildManifest.outputs) {
  assert.match(output.source, /^src\/frontend\//);
  assert.match(output.file, /^\/[a-z0-9-]+\.js$/);
  assert.match(output.json, /^\/[a-z0-9-]+\.json$/);
  assert.match(output.global, /^window\.AppModules\.[a-z]+$/);
}

console.log("[frontend-check] public module manifest is valid");

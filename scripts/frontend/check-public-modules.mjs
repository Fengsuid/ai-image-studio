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
assert.deepEqual(frontendBuildManifest.css?.legacyMobileSources, [
  "/mobile-gallery.css",
  "/mobile.css",
  "/mobile-home.css",
  "/mobile-editor.css"
]);
assert.equal(frontendBuildManifest.js?.bundler, "scripts/frontend/js-bundle.mjs");
assert.equal(frontendBuildManifest.js?.entryPattern, "/dist/<name>.<hash>.js");
assert.equal(frontendBuildManifest.js?.compatibilityManifest, "/frontend-build-manifest.js");

for (const output of frontendBuildManifest.outputs) {
  assert.match(output.source, /^src\/frontend\//);
  assert.match(output.file, /^\/[a-z0-9-]+\.js$/);
  assert.match(output.json, /^\/[a-z0-9-]+\.json$/);
  assert.match(output.global, /^window\.AppModules\.[a-z]+$/);
}

console.log("[frontend-check] public module manifest is valid");

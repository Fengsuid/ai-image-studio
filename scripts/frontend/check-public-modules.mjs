#!/usr/bin/env node
import assert from "node:assert/strict";
import { frontendBuildManifest } from "../../src/frontend/app-build-manifest.mjs";

assert.equal(typeof frontendBuildManifest.version, "string");
assert.match(frontendBuildManifest.version, /^\d{8}-[a-z0-9-]+-v\d+$/);
assert.equal(frontendBuildManifest.sourceRoot, "src/frontend");
assert.ok(Array.isArray(frontendBuildManifest.outputs));
assert.ok(frontendBuildManifest.outputs.length > 0);

for (const output of frontendBuildManifest.outputs) {
  assert.match(output.source, /^src\/frontend\//);
  assert.match(output.file, /^\/[a-z0-9-]+\.js$/);
  assert.match(output.json, /^\/[a-z0-9-]+\.json$/);
  assert.match(output.global, /^window\.AppModules\.[a-z]+$/);
}

console.log("[frontend-check] public module manifest is valid");

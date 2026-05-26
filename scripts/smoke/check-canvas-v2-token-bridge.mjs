#!/usr/bin/env node
// Verifies the Canvas v2 sub-app loads hashed bundles via build manifests and
// never falls back to legacy plain-script paths (/canvas.js, app.js?v=...).
//
// Guards against the failure mode that broke canvas-module-boundaries /
// canvas-layout-edges: hard-coding /canvas.js after main app moved to /dist/<name>.<hash>.js.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const failures = [];

function fail(message) {
  failures.push(message);
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(join(rootDir, relativePath), "utf8"));
}

async function readText(relativePath) {
  return readFile(join(rootDir, relativePath), "utf8");
}

const mainManifest = await readJson("public/frontend-build-manifest.json");
const canvasIndex = await readText("public/canvas-v2/index.html");

// Main-app manifest sanity: hashed bundle entries follow /dist/<name>.<hash>.js.
const jsAssets = Array.isArray(mainManifest?.js?.assets) ? mainManifest.js.assets : [];
if (!jsAssets.length) fail("frontend-build-manifest.json js.assets must be a non-empty array");
const hashPattern = /^\/dist\/[A-Za-z0-9._-]+\.[a-f0-9]{12}\.js$/;
for (const asset of jsAssets) {
  if (!asset?.source || !asset?.entry || !asset?.hash) {
    fail(`asset entry missing source/entry/hash: ${JSON.stringify(asset)}`);
    continue;
  }
  if (!hashPattern.test(asset.entry)) {
    fail(`asset entry ${asset.entry} must match /dist/<name>.<hash>.js`);
  }
}

// Lookup app.js + canvas.js hashed entries through the manifest (no hard-coding).
function lookup(source) {
  return jsAssets.find((asset) => asset?.source === source) || null;
}
const appAsset = lookup("/app.js");
if (!appAsset) fail("/app.js missing from frontend-build-manifest.json");
const canvasAsset = lookup("/canvas.js");
if (!canvasAsset) fail("/canvas.js missing from frontend-build-manifest.json");

// canvas-v2/index.html must reference its own hashed main.<hash>.js (NOT legacy /canvas.js, NOT app.js?v=).
const mainScriptMatch = canvasIndex.match(/src="(\/canvas-v2\/assets\/main\.[a-f0-9]{12}\.js)"/);
if (!mainScriptMatch) {
  fail("public/canvas-v2/index.html must reference /canvas-v2/assets/main.<hash>.js via <script type=\"module\">");
}
const cssLinkMatch = canvasIndex.match(/href="(\/canvas-v2\/assets\/styles\.[a-f0-9]{12}\.css)"/);
if (!cssLinkMatch) {
  fail("public/canvas-v2/index.html must reference /canvas-v2/assets/styles.<hash>.css via <link rel=\"stylesheet\">");
}

// Forbidden legacy paths.
if (/\/canvas\.js(?:["'?\s>]|$)/.test(canvasIndex)) {
  fail("public/canvas-v2/index.html must NOT reference legacy /canvas.js (use the hashed canvas-v2/assets/main.<hash>.js)");
}
if (/app\.js\?v=/.test(canvasIndex)) {
  fail("public/canvas-v2/index.html must NOT use legacy app.js?v= cache-bust (use hashed bundle path)");
}

// canvas-v2 source must not hard-code legacy plain-script paths either.
const canvasV2Sources = await readText("apps/canvas-v2/src/main.js");
if (/\/canvas\.js\b/.test(canvasV2Sources) || /app\.js\?v=/.test(canvasV2Sources)) {
  fail("apps/canvas-v2/src/main.js must NOT hard-code /canvas.js or app.js?v= paths");
}

// Verify the canvas-v2 build script emits hashed names so smokes stay manifest-driven.
const canvasBuild = await readText("apps/canvas-v2/scripts/build.mjs");
if (!canvasBuild.includes("hashContent")) {
  fail("apps/canvas-v2/scripts/build.mjs must use content hashing (hashContent helper)");
}
if (!canvasBuild.includes("main.js")) {
  fail("apps/canvas-v2/scripts/build.mjs must emit a main.<hash>.js entry");
}

if (failures.length) {
  console.error("[canvas-v2-token-bridge] FAIL:");
  for (const message of failures) console.error(` - ${message}`);
  process.exit(1);
}

console.log(
  `[canvas-v2-token-bridge] OK: main app uses ${jsAssets.length} hashed bundles; canvas-v2 references ${mainScriptMatch?.[1]} + ${cssLinkMatch?.[1]}`
);

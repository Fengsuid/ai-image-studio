#!/usr/bin/env node
// Verifies canvas boundary modules without requiring the app server or MySQL.

import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createFrontendManifestHelper } from "./frontend-manifest-helper.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const indexHtml = fs.readFileSync(path.join(rootDir, "public/index.html"), "utf8");
const frontendManifest = createFrontendManifestHelper(rootDir);
const modules = [
  { file: "canvas-layout.js", marker: "root.layout", exportName: "layout" },
  { file: "canvas-edges.js", marker: "root.edges", exportName: "edges", deps: ["canvas-nodes.js", "canvas-geometry.js"] },
  { file: "canvas-toolbar.js", marker: "root.toolbar", exportName: "toolbar" },
  { file: "canvas-inspector.js", marker: "root.inspector", exportName: "inspector" }
];

const canvasScriptIndex = frontendManifest.lazyRouteIndexByFileName("canvas", "canvas.js");
const canvasAsset = frontendManifest.lazyRouteAssetByFileName("canvas", "canvas.js");
assert(canvasScriptIndex > 0, "frontend manifest canvas lazy route must include the canvas entry");
assert(!indexHtml.includes(canvasAsset.entry), "index.html must lazy-load the canvas entry through app-router");

const sandbox = {
  window: { ImageStudioCanvas: {} },
  document: {
    querySelector() { return null; },
    querySelectorAll() { return []; }
  }
};
sandbox.globalThis = sandbox.window;

for (const dep of ["canvas-nodes.js", "canvas-geometry.js"]) {
  const code = frontendManifest.readPublicSourceForAsset(frontendManifest.lazyRouteAssetByFileName("canvas", dep));
  vm.runInNewContext(code, sandbox, { filename: dep });
}

for (const module of modules) {
  const asset = frontendManifest.lazyRouteAssetByFileName("canvas", module.file);
  const scriptIndex = frontendManifest.lazyRouteIndexByFileName("canvas", module.file);
  assert(scriptIndex > 0, `frontend manifest canvas lazy route must include ${module.file}`);
  assert(scriptIndex < canvasScriptIndex, `${module.file} must load before the canvas entry in the lazy route`);

  const code = frontendManifest.readPublicSourceForAsset(asset);
  assert(code.includes(module.marker), `${module.file} must register ${module.marker}`);
  vm.runInNewContext(code, sandbox, { filename: module.file });
  assert(sandbox.window.ImageStudioCanvas[module.exportName], `${module.file} did not populate ImageStudioCanvas.${module.exportName}`);
}

assert.equal(typeof sandbox.window.ImageStudioCanvas.toolbar.render, "function", "toolbar.render must be callable");
assert.equal(typeof sandbox.window.ImageStudioCanvas.toolbar.renderHistoryControls, "function", "toolbar.renderHistoryControls must be callable");
assert.equal(typeof sandbox.window.ImageStudioCanvas.inspector.render, "function", "inspector.render must be callable");
assert.equal(typeof sandbox.window.ImageStudioCanvas.layout.fitNodesInBoard, "function", "layout.fitNodesInBoard must be callable");
assert.equal(typeof sandbox.window.ImageStudioCanvas.edges.edgeEndpoints, "function", "edges.edgeEndpoints must be callable");

console.log("[canvas-module-boundaries-smoke] OK: index references and ImageStudioCanvas registrations verified");

#!/usr/bin/env node
// Verifies canvas boundary modules without requiring the app server or MySQL.

import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const indexHtml = fs.readFileSync(path.join(rootDir, "public/index.html"), "utf8");
const modules = [
  { file: "canvas-toolbar.js", marker: "root.toolbar", exportName: "toolbar" },
  { file: "canvas-inspector.js", marker: "root.inspector", exportName: "inspector" }
];

const canvasScriptIndex = indexHtml.indexOf("/canvas.js");
assert(canvasScriptIndex > 0, "index.html must reference /canvas.js");

const sandbox = {
  window: { ImageStudioCanvas: {} },
  document: {
    querySelector() { return null; },
    querySelectorAll() { return []; }
  }
};
sandbox.globalThis = sandbox.window;

for (const module of modules) {
  const src = `/${module.file}`;
  const scriptIndex = indexHtml.indexOf(src);
  assert(scriptIndex > 0, `index.html must reference ${src}`);
  assert(scriptIndex < canvasScriptIndex, `${src} must load before /canvas.js`);

  const code = fs.readFileSync(path.join(rootDir, "public", module.file), "utf8");
  assert(code.includes(module.marker), `${module.file} must register ${module.marker}`);
  vm.runInNewContext(code, sandbox, { filename: module.file });
  assert(sandbox.window.ImageStudioCanvas[module.exportName], `${module.file} did not populate ImageStudioCanvas.${module.exportName}`);
}

assert.equal(typeof sandbox.window.ImageStudioCanvas.toolbar.render, "function", "toolbar.render must be callable");
assert.equal(typeof sandbox.window.ImageStudioCanvas.toolbar.renderHistoryControls, "function", "toolbar.renderHistoryControls must be callable");
assert.equal(typeof sandbox.window.ImageStudioCanvas.inspector.render, "function", "inspector.render must be callable");

console.log("[canvas-module-boundaries-smoke] OK: index references and ImageStudioCanvas registrations verified");

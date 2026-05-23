#!/usr/bin/env node
// Verifies canvas layout and edge geometry helpers without a browser.

import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { readPublicCssWithImports } from "./css-imports.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const indexHtml = fs.readFileSync(path.join(rootDir, "public/index.html"), "utf8");
const styles = readPublicCssWithImports(rootDir);
const canvas = fs.readFileSync(path.join(rootDir, "public/canvas.js"), "utf8");

const required = ["/canvas-nodes.js", "/canvas-geometry.js", "/canvas-layout.js", "/canvas-edges.js", "/canvas.js"];
for (const src of required) {
  assert(indexHtml.includes(src), `index.html must reference ${src}`);
}
assert(indexHtml.indexOf("/canvas-layout.js") < indexHtml.indexOf("/canvas.js"), "canvas-layout.js must load before canvas.js");
assert(indexHtml.indexOf("/canvas-edges.js") < indexHtml.indexOf("/canvas.js"), "canvas-edges.js must load before canvas.js");

assert(styles.includes("width: min(1540px, calc(100vw - 32px));"), "canvas view must use the wide workbench layout");
assert(styles.includes("grid-template-columns: minmax(176px, 220px) minmax(520px, 1fr) minmax(240px, 300px);"), "workspace must reserve board and inspector columns");
assert(styles.includes(".canvas-toolbar [data-canvas-template-toggle] span"), "template toolbar label must have an explicit no-wrap rule");
assert(styles.includes("white-space: nowrap;"), "toolbar labels should not wrap vertically");
const mobileToolbarBlock = styles.match(/@media \(max-width: 860px\)[\s\S]*?\.canvas-toolbar\s*\{([\s\S]*?)\}/)?.[1] || "";
assert(mobileToolbarBlock.includes("flex-wrap: wrap"), "mobile toolbar should wrap horizontally instead of stacking vertically");
assert(!mobileToolbarBlock.includes("flex-direction: column"), "mobile toolbar must not force vertical button layout");

assert(!canvas.includes("viewBox=\"-400 -300 2400 1600\""), "canvas.js must not use the shifted hard-coded edge SVG viewBox");
assert(canvas.includes("root.edges?.render"), "canvas.js must delegate edge rendering to canvas-edges.js");
assert(canvas.includes("root.layout?.fitNodesInBoard"), "canvas.js must delegate board fitting to canvas-layout.js");

const sandbox = {
  window: { ImageStudioCanvas: {} },
  document: {}
};
sandbox.globalThis = sandbox.window;
for (const file of ["canvas-nodes.js", "canvas-geometry.js", "canvas-layout.js", "canvas-edges.js"]) {
  vm.runInNewContext(fs.readFileSync(path.join(rootDir, "public", file), "utf8"), sandbox, { filename: file });
}

const root = sandbox.window.ImageStudioCanvas;
const source = root.nodes.createNode({ id: "source", type: "prompt", x: 40, y: 50 });
const target = root.nodes.createNode({ id: "target", type: "config", x: 360, y: 90 });
const endpoints = root.edges.edgeEndpoints(source, target);
assert.equal(endpoints.source.x, 260, "source endpoint should attach to the source node right edge");
assert.equal(endpoints.source.y, 116, "source endpoint should attach to the source node vertical midpoint");
assert.equal(endpoints.target.x, 360, "target endpoint should attach to the target node left edge");
assert.equal(endpoints.target.y, 156, "target endpoint should attach to the target node vertical midpoint");

const svg = root.edges.render({
  nodes: [source, target],
  edges: [{ id: "edge_source_target", sourceId: "source", targetId: "target" }],
  selectedNodeIds: ["source"]
});
assert(svg.includes('class="canvas-edge active"'), "selected edge should render active");
assert(svg.includes('style="left:'), "edge SVG must be positioned in canvas coordinates");
assert(svg.includes("viewBox="), "edge SVG must expose a coordinate-aligned viewBox");

const fitted = root.layout.fitNodesInBoard(
  { getBoundingClientRect: () => ({ width: 1000, height: 600 }) },
  [source, target],
  { padding: 80, maxScale: 1 }
);
assert(fitted.x > 0 && fitted.y > 0, "fitNodesInBoard should center a smaller graph in the board");
assert(fitted.scale <= 1, "initial fit should respect the caller max scale");

console.log("[canvas-layout-edges-smoke] OK: layout shell and edge geometry verified");

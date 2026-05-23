#!/usr/bin/env node
// Static guard for AIS-RLS-070 CSS token, motion and visual polish baseline.

import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
const cssEntry = fs.readFileSync(path.join(rootDir, "public/styles.css"), "utf8");
const cssImportPaths = [...cssEntry.matchAll(/@import\s+url\("([^"]+)"\);/g)].map((match) => match[1]);
const cssModules = cssImportPaths.map((importPath) => {
  assert(importPath.startsWith("/css/"), `styles.css import should stay under /css: ${importPath}`);
  const diskPath = path.join(rootDir, "public", importPath);
  assert(fs.existsSync(diskPath), `styles.css import target missing: ${importPath}`);
  const source = fs.readFileSync(diskPath, "utf8");
  const lineCount = source.split(/\r?\n/).length;
  assert(lineCount < 500, `${importPath} should stay below 500 lines (${lineCount})`);
  return source;
});
const css = [
  cssEntry,
  ...cssModules
].join("\n");
const app = fs.readFileSync(path.join(rootDir, "public/app.js"), "utf8");

assert(cssImportPaths.length >= 12, "styles.css should import split CSS modules");
assert(!cssEntry.replace(/\/\*[\s\S]*?\*\//g, "").replace(/@import\s+url\("[^"]+"\);\s*/g, "").trim(), "styles.css should remain an import-only compatibility entry");

assert.equal(
  packageJson.scripts["smoke:css-visual-polish"],
  "node scripts/smoke/check-css-visual-polish.mjs",
  "package.json must expose smoke:css-visual-polish"
);

[
  "--brand:",
  "--brand-soft:",
  "--surface-raised:",
  "--border-subtle:",
  "--text-primary:",
  "--ease-out:",
  "--ease-bounce:",
  "--dur-base:",
  "--shadow-brand:"
].forEach((token) => {
  assert(css.includes(token), `styles.css missing visual token ${token}`);
});

[
  "@keyframes ais-fade-in",
  "@keyframes ais-slide-up",
  "@keyframes ais-scale-in",
  "@keyframes ais-pop",
  "@keyframes ais-shimmer",
  "@keyframes ais-progress-flow"
].forEach((keyframe) => {
  assert(css.includes(keyframe), `styles.css missing motion primitive ${keyframe}`);
});

[
  ".composer:focus-within",
  ".toast",
  ".modal-layer",
  ".recent-tile:hover",
  ".prompt-card:hover",
  ".work-card:hover",
  "[data-generation-progress]"
].forEach((selector) => {
  assert(css.includes(selector), `styles.css missing visual polish selector ${selector}`);
});

assert(css.includes("@media (prefers-reduced-motion: reduce)"), "motion polish must respect reduced motion");
assert(!app.includes("ripple-wave"), "AIS-RLS-070 should avoid decorative JS growth in app.js");

console.log("[css-visual-polish-smoke] OK: CSS tokens and motion polish are present");

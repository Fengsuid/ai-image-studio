#!/usr/bin/env node
// Static guard for AIS-RLS-070 CSS token, motion and visual polish baseline.

import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
const css = fs.readFileSync(path.join(rootDir, "public/styles.css"), "utf8");
const app = fs.readFileSync(path.join(rootDir, "public/app.js"), "utf8");

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

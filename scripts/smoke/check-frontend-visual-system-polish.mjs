#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cssEntry = fs.readFileSync(path.join(rootDir, "public/styles.css"), "utf8");
const visualCss = fs.readFileSync(path.join(rootDir, "public/css/pages/visual-polish.css"), "utf8");
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));

assert(cssEntry.includes('@import url("/css/pages/visual-polish.css");'), "styles.css must import visual polish module");
assert(!cssEntry.replace(/\/\*[\s\S]*?\*\//g, "").replace(/@import\s+url\("[^"]+"\);\s*/g, "").trim(), "styles.css must remain import-only");
assert.equal(
  packageJson.scripts["smoke:frontend-visual-system-polish"],
  "node scripts/smoke/check-frontend-visual-system-polish.mjs"
);

[
  "--visual-state-accent",
  ".empty-message",
  ".chat-empty-state",
  ".gallery-rank-empty",
  ".announcement-empty",
  ".admin-empty-state",
  ".error-box",
  ".editor-status-failure",
  ".generation-card.loading",
  ".admin-panel",
  ".card-actions",
  ".prompt-tags span",
  "@media (max-width: 640px)"
].forEach((snippet) => {
  assert(visualCss.includes(snippet), `visual polish CSS missing ${snippet}`);
});

const lineCount = visualCss.split(/\r?\n/).length;
assert(lineCount < 500, `12-visual-polish.css should stay below 500 lines (${lineCount})`);

console.log("[frontend-visual-system-polish] OK: shared visual states stay in CSS modules");

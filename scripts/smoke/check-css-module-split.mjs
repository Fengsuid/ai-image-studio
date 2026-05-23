#!/usr/bin/env node
// Static guard for AIS-RLS-071 CSS module split.

import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cssDir = path.join(rootDir, "public/css");
const stylesPath = path.join(rootDir, "public/styles.css");
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
const styles = fs.readFileSync(stylesPath, "utf8");

assert.equal(
  packageJson.scripts["smoke:css-module-split"],
  "node scripts/smoke/check-css-module-split.mjs",
  "package.json must expose smoke:css-module-split"
);
assert(fs.existsSync(cssDir), "public/css directory must exist");

const required = [
  "00-tokens.css",
  "01-reset.css",
  "02-typography.css",
  "03-layout.css",
  "04-components.css",
  "05-home.css",
  "06-gallery.css",
  "07-editor.css",
  "08-chat.css",
  "09-admin.css",
  "10-canvas.css",
  "11-mobile.css",
  "12-animations.css"
];
for (const file of required) {
  assert(fs.existsSync(path.join(cssDir, file)), `missing CSS module ${file}`);
}

const cssFiles = fs.readdirSync(cssDir).filter((name) => name.endsWith(".css")).sort();
assert(cssFiles.length >= required.length, "CSS split should include the required module set");
assert(styles.includes("AIS-RLS-071 compatibility entry"), "styles.css must be a compatibility entry");
assert(!styles.includes(":root {"), "styles.css should not keep bulk CSS rules after split");

for (const file of cssFiles) {
  const content = fs.readFileSync(path.join(cssDir, file), "utf8");
  const lines = content.split(/\r?\n/).length;
  assert(lines <= 500, `${file} exceeds 500 lines (${lines})`);
  assert(styles.includes(`/css/${file}`), `styles.css must import ${file}`);
  assert(content.trim().startsWith("/*"), `${file} should start with a module header comment`);
}

const imported = [...styles.matchAll(/@import url\(\"\/css\/([^\"]+\.css)\"\);/g)].map((match) => match[1]);
assert.equal(imported.length, cssFiles.length, "styles.css import count must match public/css files");
assert.deepEqual([...imported].sort(), cssFiles, "styles.css imports must match public/css files");

console.log(`[css-module-split-smoke] OK: ${cssFiles.length} CSS modules imported from styles.css`);

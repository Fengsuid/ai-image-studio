#!/usr/bin/env node
// Static guard for AIS-RLS-071 CSS module split.

import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cssDir = path.join(rootDir, "public/css");
const stylesPath = path.join(rootDir, "public/styles.css");
const indexPath = path.join(rootDir, "public/index.html");
const manifestPath = path.join(rootDir, "public/frontend-build-manifest.json");
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
const styles = fs.readFileSync(stylesPath, "utf8");
const indexHtml = fs.readFileSync(indexPath, "utf8");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

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
  "05-home-mobile.css",
  "06-gallery.css",
  "06-gallery-mobile.css",
  "07-editor.css",
  "07-editor-mobile.css",
  "07-editor-mobile-works.css",
  "07-editor-mobile-detail.css",
  "07-editor-mobile-narrow.css",
  "08-chat.css",
  "09-admin.css",
  "10-canvas.css",
  "11-mobile.css",
  "11-mobile-shell.css",
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

const imported = [...styles.matchAll(/@import url\("\/css\/([^"]+\.css)"\);/g)].map((match) => match[1]);
assert.equal(imported.length, cssFiles.length, "styles.css import count must match public/css files");
assert.deepEqual([...imported].sort(), cssFiles, "styles.css imports must match public/css files");

function stylesheetHrefs(html) {
  return [...html.matchAll(/<link\b[^>]*>/g)]
    .map((match) => match[0])
    .filter((tag) => /\brel="stylesheet"/.test(tag))
    .map((tag) => tag.match(/\bhref="([^"]+)"/)?.[1])
    .filter(Boolean);
}

const localStylesheets = stylesheetHrefs(indexHtml).filter((href) => href.startsWith("/"));
assert.equal(localStylesheets.length, 1, "public index must load exactly one local stylesheet");
assert.match(localStylesheets[0], /^\/dist\/app\.[a-f0-9]{12}\.css$/, "public index must load the hashed CSS bundle");
assert(!localStylesheets.includes("/styles.css"), "public index must not load styles.css directly");
assert(!localStylesheets.some((href) => /^\/mobile(?:-[a-z]+)?\.css/.test(href)), "public index must not load legacy mobile CSS directly");

const bundlePath = path.join(rootDir, "public", localStylesheets[0].slice(1));
assert(fs.existsSync(bundlePath), `hashed CSS bundle missing: ${localStylesheets[0]}`);
assert.equal(manifest.css?.entry, localStylesheets[0], "frontend build manifest CSS entry must match public index");
assert.match(manifest.css?.hash || "", /^[a-f0-9]{12}$/, "frontend build manifest must include CSS hash");
assert.equal(manifest.css?.file, localStylesheets[0], "frontend build manifest CSS file must match public index");

const expectedSourcePaths = [
  "/vendor/icons/remixicon.min.css",
  "/vendor/icons/remixicon-compat.css",
  ...imported.map((file) => `/css/${file}`)
];
assert.deepEqual(manifest.css?.sources, expectedSourcePaths, "frontend build manifest CSS sources must preserve cascade order");

const bundle = fs.readFileSync(bundlePath, "utf8");
assert(!/@import\s/.test(bundle), "hashed CSS bundle must not contain @import rules");
for (const publicPath of expectedSourcePaths) {
  const sourceComment = `/* public/${publicPath.slice(1)} */`;
  assert(bundle.includes(sourceComment), `hashed CSS bundle missing source section ${sourceComment}`);
}

console.log(
  `[css-module-split-smoke] OK: ${cssFiles.length} CSS modules bundled into ${localStylesheets[0]}`
);

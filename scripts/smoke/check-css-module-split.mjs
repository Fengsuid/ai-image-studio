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
  "00-tokens-typography.css",
  "00-tokens-motion.css",
  "00-theme.css",
  "tokens.css",
  "primitives/_motion.css",
  "primitives/_motion-utilities.css",
  "primitives/_button.css",
  "primitives/_form.css",
  "primitives/_pill.css",
  "primitives/_toast.css",
  "primitives/_table.css",
  "primitives/_drawer.css",
  "primitives/_modal.css",
  "primitives/_card.css",
  "pages/reset-base.css",
  "pages/reset.css",
  "pages/typography.css",
  "pages/layout.css",
  "pages/layout-shell.css",
  "pages/layout-app-shell.css",
  "pages/components.css",
  "pages/components-skeleton.css",
  "pages/components-cards.css",
  "pages/reference-assets.css",
  "pages/components-modals.css",
  "pages/components-forms.css",
  "pages/home-shell.css",
  "pages/home-publish.css",
  "pages/home.css",
  "pages/home-onboarding.css",
  "pages/home-composer.css",
  "pages/gallery.css",
  "pages/credits-detail.css",
  "pages/works-carousel.css",
  "pages/prompt-library-polish.css",
  "pages/gallery-detail.css",
  "pages/gallery-leaderboard.css",
  "pages/gallery-leaderboard-responsive.css",
  "pages/editor.css",
  "pages/chat.css",
  "pages/chat-polish.css",
  "pages/admin.css",
  "pages/admin-panels.css",
  "pages/admin-diagnostics.css",
  "pages/canvas.css",
  "pages/canvas-tools.css",
  "pages/admin-shell-polish.css",
  "pages/visual-polish.css",
  "pages/premium-ambient.css",
  "pages/premium-interactions.css",
  "pages/performance.css",
  "mobile/_safe-area.css",
  "mobile/_bottom-nav.css",
  "mobile/_mobile-overrides.css",
  "mobile/_mobile-editor.css",
  "mobile/_premium.css"
];
for (const file of required) {
  assert(fs.existsSync(path.join(cssDir, file)), `missing CSS module ${file}`);
}

const legacyMobileCss = [
  "05-home-mobile.css",
  "06-gallery-mobile.css",
  "07-editor-mobile.css",
  "07-editor-mobile-works.css",
  "07-editor-mobile-detail.css",
  "07-editor-mobile-narrow.css",
  "11-mobile.css",
  "11-mobile-shell.css",
  "11-mobile-bottom-sheet.css"
];
for (const file of legacyMobileCss) {
  assert(!fs.existsSync(path.join(cssDir, file)), `legacy mobile CSS should be removed: ${file}`);
  assert(!styles.includes(`/css/${file}`), `styles.css must not import legacy mobile CSS ${file}`);
}
for (const file of ["mobile.css", "mobile-editor.css", "mobile-gallery.css"]) {
  assert(!fs.existsSync(path.join(rootDir, "public", file)), `legacy root mobile CSS should be removed: ${file}`);
}

function listCssModules(dir, prefix = "") {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) return listCssModules(absolute, name);
    return entry.isFile() && entry.name.endsWith(".css") ? [name] : [];
  });
}

const cssFiles = listCssModules(cssDir).sort();
assert(cssFiles.length >= required.length, "CSS split should include the required module set");
assert(styles.includes("AIS-RLS-071 compatibility entry"), "styles.css must be a compatibility entry");
assert(!styles.includes(":root {"), "styles.css should not keep bulk CSS rules after split");

for (const file of cssFiles) {
  const content = fs.readFileSync(path.join(cssDir, ...file.split("/")), "utf8");
  const lines = content.split(/\r?\n/).length;
  assert(lines <= 500, `${file} exceeds 500 lines (${lines})`);
  assert(styles.includes(`/css/${file}`), `styles.css must import ${file}`);
  assert(content.trim().startsWith("/*"), `${file} should start with a module header comment`);
}

const imported = [...styles.matchAll(/@import url\("\/css\/([^"]+\.css)"\);/g)].map((match) => match[1]);
assert.equal(imported.length, cssFiles.length, "styles.css import count must match public/css files");
assert.deepEqual([...imported].sort(), cssFiles, "styles.css imports must match public/css files");
assert(imported.indexOf("00-theme.css") < imported.indexOf("tokens.css"), "token bridge must load after base token files");
assert(imported.indexOf("tokens.css") < imported.indexOf("primitives/_motion.css"), "primitive layer must load after token layer");
assert(imported.indexOf("primitives/_button.css") < imported.indexOf("primitives/_modal.css"), "modal primitive must load after button primitive");
assert(imported.indexOf("primitives/_modal.css") < imported.indexOf("pages/components-modals.css"), "modal primitive must load before legacy modal feature CSS");
assert(imported.indexOf("primitives/_drawer.css") < imported.indexOf("pages/admin.css"), "drawer primitive must load before admin feature CSS");
assert(imported.indexOf("primitives/_table.css") < imported.indexOf("pages/admin.css"), "table primitive must load before admin feature CSS");
assert(imported.indexOf("pages/performance.css") < imported.indexOf("mobile/_safe-area.css"), "mobile layer must load after page layer");

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

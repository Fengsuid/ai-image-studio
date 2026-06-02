#!/usr/bin/env node
// Static guard for AIS-RLS-070 CSS token, motion and visual polish baseline.

import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
const cssEntry = fs.readFileSync(path.join(rootDir, "public/styles.css"), "utf8");
const indexHtml = fs.readFileSync(path.join(rootDir, "public/index.html"), "utf8");
const adminHtml = fs.readFileSync(path.join(rootDir, "public/admin.html"), "utf8");
const serverJs = fs.readFileSync(path.join(rootDir, "server.js"), "utf8");
const securityHeadersJs = fs.readFileSync(path.join(rootDir, "src/security-headers.js"), "utf8");
const cspSource = `${serverJs}\n${securityHeadersJs}`;
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
const vendorFontsDir = path.join(rootDir, "public/vendor/fonts");
const vendorIconsDir = path.join(rootDir, "public/vendor/icons");

function collectPublicSourceFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);
    const relativePath = path.relative(path.join(rootDir, "public"), absolutePath).replace(/\\/g, "/");
    if (entry.isDirectory()) {
      if (relativePath === "dist" || relativePath === "vendor") continue;
      files.push(...collectPublicSourceFiles(absolutePath));
      continue;
    }
    if (/\.(?:html|js|css)$/.test(entry.name)) files.push(absolutePath);
  }
  return files;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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
  ".hero > .hero-blob",
  ".composer:focus-within",
  ".hero .composer-mount.primitive-card--hero",
  ".hero-blob--primary",
  ".hero-blob--secondary",
  ".toast",
  ".modal-layer",
  ".recent-tile:hover",
  ".prompt-card:hover",
  ".work-card:hover",
  "[data-generation-progress]"
].forEach((selector) => {
  assert(css.includes(selector), `styles.css missing visual polish selector ${selector}`);
});

[
  "id=\"heroComposerMount\" class=\"composer-mount primitive-card--hero\"",
  "class=\"hero-blob hero-blob--primary anim-floating-blob\"",
  "class=\"hero-blob hero-blob--secondary anim-floating-blob\""
].forEach((token) => {
  assert(indexHtml.includes(token), `public index missing AIS-RLS-136 hero token ${token}`);
});

[
  "font-family: var(--font-display)",
  "linear-gradient(100deg, var(--brand-700) 0%, var(--brand-500) 52%, #8b5cf6 100%)",
  "-webkit-background-clip: text",
  "font-family: var(--font-body)",
  "color: var(--neutral-500)",
  "line-height: 1.5",
  "background: var(--surface-glass)",
  "backdrop-filter: blur(20px) saturate(140%)",
  "box-shadow: var(--shadow-lg)",
  "border: 1px solid color-mix(in srgb, var(--neutral-200) 60%, transparent)",
  "animation: floating-blob 30s",
  "color-mix(in srgb, var(--brand-400) 40%, transparent)",
  "border-color: var(--brand-400)",
  "border-color var(--dur-base)"
].forEach((token) => {
  assert(css.includes(token), `AIS-RLS-136 hero/composer polish missing ${token}`);
});

assert(/\.hero\s*>\s*\.hero-blob\s*\{[\s\S]*position:\s*absolute/.test(css), "AIS-RLS-136 hero blobs must stay out of the hero flex flow");

assert(css.includes("@media (prefers-reduced-motion: reduce)"), "motion polish must respect reduced motion");
assert(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.hero-blob[\s\S]*animation: none/.test(css), "AIS-RLS-136 hero blobs must stop for reduced motion");
assert(!app.includes("ripple-wave"), "AIS-RLS-070 should avoid decorative JS growth in app.js");
[
  "geist-latin.woff2",
  "geist-latin-ext.woff2",
  "instrument-serif-latin.woff2",
  "instrument-serif-latin-ext.woff2",
  "instrument-serif-italic-latin.woff2",
  "instrument-serif-italic-latin-ext.woff2"
].forEach((fileName) => {
  assert(fs.existsSync(path.join(vendorFontsDir, fileName)), `self-hosted font missing: ${fileName}`);
});
const remixiconCssPath = path.join(vendorIconsDir, "remixicon.min.css");
const remixiconCompatCssPath = path.join(vendorIconsDir, "remixicon-compat.css");
assert(fs.existsSync(path.join(vendorIconsDir, "remixicon.woff2")), "self-hosted Remixicon font missing");
assert(fs.existsSync(remixiconCssPath), "self-hosted Remixicon CSS missing");
assert(fs.existsSync(remixiconCompatCssPath), "self-hosted Remixicon compatibility CSS missing");
assert(css.includes("@font-face"), "typography CSS must declare local @font-face rules");
assert(css.includes("/vendor/fonts/geist-latin.woff2"), "typography CSS must point Geist at /vendor/fonts");
assert(css.includes("/vendor/fonts/instrument-serif-latin.woff2"), "typography CSS must point Instrument Serif at /vendor/fonts");
assert(adminHtml.includes("/vendor/icons/remixicon.min.css"), "admin shell must load local Remixicon CSS");
assert(adminHtml.includes("/vendor/icons/remixicon-compat.css"), "admin shell must load local Remixicon compatibility CSS");
assert(!/fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net/.test(`${indexHtml}\n${adminHtml}`), "HTML must not reference font or icon CDNs");
assert(cspSource.includes("\"font-src 'self'\""), "CSP font-src must be self-only");
assert(!/font-src[^"]*(?:fonts\.gstatic|cdn\.jsdelivr)/.test(cspSource), "CSP font-src must not allow external font CDNs");
assert(!/style-src[^"]*(?:fonts\.googleapis|cdn\.jsdelivr)/.test(cspSource), "CSP style-src must not allow external style CDNs");
const iconCss = `${fs.readFileSync(remixiconCssPath, "utf8")}\n${fs.readFileSync(remixiconCompatCssPath, "utf8")}`;
assert(iconCss.includes("/vendor/icons/remixicon.woff2"), "Remixicon CSS must use an absolute self-hosted font URL");
[
  "ri-image-close-line",
  "ri-image-edit-2-line",
  "ri-image-spark-line",
  "ri-image-warning-line",
  "ri-sliders-3-line",
  "ri-sliders-line",
  "ri-sync-warning-line"
].forEach((iconClass) => {
  assert(iconCss.includes(`.${iconClass}:before`) || iconCss.includes(`.${iconClass}:before,`), `Remixicon compatibility CSS missing ${iconClass}`);
});
const usedIconClasses = new Set();
for (const filePath of collectPublicSourceFiles(path.join(rootDir, "public"))) {
  const source = fs.readFileSync(filePath, "utf8");
  for (const match of source.matchAll(/\bri-[a-z0-9-]+\b/g)) usedIconClasses.add(match[0]);
}
for (const iconClass of usedIconClasses) {
  assert(
    new RegExp(`\\.${escapeRegExp(iconClass)}:before`).test(iconCss),
    `self-hosted Remixicon CSS missing used icon class ${iconClass}`
  );
}

console.log("[css-visual-polish-smoke] OK: CSS tokens and motion polish are present");

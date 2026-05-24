#!/usr/bin/env node
// Static frontend performance and bundle budget guard for AIS-RLS-092.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), "utf8");
const stat = (relativePath) => fs.statSync(path.join(rootDir, relativePath));

const packageJson = JSON.parse(read("package.json"));
const indexHtml = read("public/index.html");
const adminHtml = read("public/admin.html");
const styles = read("public/styles.css");
const appJs = read("public/app.js");
const performanceJs = read("public/frontend-performance.js");
const performanceCss = read("public/css/13-performance.css");

const budgets = {
  "public/app.js": 340000,
  "public/admin.js": 120000,
  "public/app-prompt-library.js": 35000,
  "public/admin-shell-polish.js": 12000,
  nonCanvasInitialJs: 430000,
  initialCss: 260000,
  cssModule: 16000,
  htmlInlineJson: 5000
};

function scriptPaths(html) {
  return [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map((match) => match[1]);
}

function stylesheetPaths(html) {
  return [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map((match) => match[1]);
}

function diskPathFromPublicUrl(url) {
  const clean = new URL(url, "https://example.test").pathname.replace(/^\/+/, "");
  return clean.startsWith("public/") ? clean : `public/${clean}`;
}

function isCanvasUrl(url) {
  const pathname = new URL(url, "https://example.test").pathname;
  return pathname.startsWith("/canvas") || pathname.startsWith("/canvas-v2/");
}

function assertNoDuplicates(urls, label) {
  const seen = new Set();
  for (const url of urls) {
    const pathname = new URL(url, "https://example.test").pathname;
    assert(!seen.has(pathname), `${label} duplicates ${pathname}`);
    seen.add(pathname);
  }
}

function importedCssFiles() {
  return [...styles.matchAll(/@import\s+url\("\/css\/([^"]+\.css)"\);/g)].map((match) => `public/css/${match[1]}`);
}

function assertBudget(relativePath, maxBytes) {
  const bytes = stat(relativePath).size;
  assert(bytes <= maxBytes, `${relativePath} is ${bytes} bytes; budget is ${maxBytes}`);
}

function imageTags(source) {
  return [...source.matchAll(/<img\b[^>]*>/g)].map((match) => match[0]);
}

function assertImageBudgetAttrs(sourcePath) {
  const source = read(sourcePath);
  const renderedImages = imageTags(source).filter((tag) => tag.includes("src="));
  for (const tag of renderedImages) {
    assert(
      tag.includes('loading="lazy"') || tag.includes('fetchpriority="high"'),
      `${sourcePath} image missing lazy loading or explicit high priority: ${tag}`
    );
    assert(
      tag.includes('decoding="async"') || tag.includes('fetchpriority="high"'),
      `${sourcePath} image missing async decoding or explicit high priority: ${tag}`
    );
  }
}

assert.equal(
  packageJson.scripts["smoke:frontend-performance"],
  "node scripts/smoke/check-frontend-performance.mjs",
  "package.json must expose smoke:frontend-performance"
);

for (const [relativePath, maxBytes] of Object.entries(budgets)) {
  if (relativePath.startsWith("public/")) assertBudget(relativePath, maxBytes);
}

assert(indexHtml.includes("/frontend-performance.js"), "index.html must load frontend-performance.js");
assert(indexHtml.indexOf("/frontend-performance.js") < indexHtml.indexOf("/app.js"), "frontend-performance.js must load before app.js");
assert(indexHtml.includes('preload="metadata"'), "hero video must use metadata preload");
assert(!indexHtml.includes("<video autoplay"), "hero video should not autoplay before runtime budget checks");
assert(styles.includes('@import url("/css/13-performance.css");'), "styles.css must import performance CSS");

const homeScripts = scriptPaths(indexHtml);
const adminScripts = scriptPaths(adminHtml);
assertNoDuplicates(homeScripts, "home scripts");
assertNoDuplicates(adminScripts, "admin scripts");

const nonCanvasHomeScripts = homeScripts.filter((url) => !isCanvasUrl(url));
const nonCanvasHomeBytes = nonCanvasHomeScripts.reduce((sum, url) => sum + stat(diskPathFromPublicUrl(url)).size, 0);
assert(
  nonCanvasHomeBytes <= budgets.nonCanvasInitialJs,
  `home non-canvas JS is ${nonCanvasHomeBytes} bytes; budget is ${budgets.nonCanvasInitialJs}`
);

const cssUrls = stylesheetPaths(indexHtml);
const cssEntryBytes = cssUrls.reduce((sum, url) => sum + stat(diskPathFromPublicUrl(url)).size, 0);
const importedCssBytes = importedCssFiles().reduce((sum, relativePath) => sum + stat(relativePath).size, 0);
assert(
  cssEntryBytes + importedCssBytes <= budgets.initialCss,
  `initial CSS is ${cssEntryBytes + importedCssBytes} bytes; budget is ${budgets.initialCss}`
);
for (const relativePath of importedCssFiles()) assertBudget(relativePath, budgets.cssModule);

for (const token of [
  "IntersectionObserver",
  "MutationObserver",
  "requestIdleCallback",
  "saveData",
  "prefers-reduced-motion",
  "fetchpriority",
  "shouldDisableHeroVideo",
  "scheduleHeroVideo",
  "ImageStudioPerformance"
]) {
  assert(performanceJs.includes(token), `frontend-performance.js missing ${token}`);
}

for (const token of [
  "window.ImageStudioPerformance",
  "shouldDisableHeroVideo",
  "shouldAvoidHeroWatchdog",
  "scheduleHeroVideo"
]) {
  assert(appJs.includes(token), `app.js must consult frontend performance helper: ${token}`);
}

for (const selector of [
  ".perf-observed",
  ".performance-low",
  ".performance-save-data",
  ".performance-reduced-motion",
  "@media (prefers-reduced-motion: reduce)"
]) {
  assert(performanceCss.includes(selector), `performance CSS missing ${selector}`);
}

for (const sourcePath of [
  "public/app.js",
  "public/app-prompt-library.js",
  "public/gallery-leaderboard.js",
  "public/image-session-list.js",
  "public/prompt-cover-fallback.js"
]) {
  assertImageBudgetAttrs(sourcePath);
}

const oversizedInlineScripts = [...indexHtml.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
  .filter((match) => match[1].trim().length > budgets.htmlInlineJson);
assert.equal(oversizedInlineScripts.length, 0, "index.html should not contain oversized inline scripts/data");

console.log(`[frontend-performance-smoke] OK: non-canvas JS ${nonCanvasHomeBytes} bytes, CSS ${cssEntryBytes + importedCssBytes} bytes`);

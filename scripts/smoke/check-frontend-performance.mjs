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
const adminDashboardJs = read("public/admin/dashboard.js");
const performanceJs = read("public/frontend-performance.js");
const performanceCss = read("public/css/pages/performance.css");

const budgets = {
  "public/app.js": 340000,
  "public/admin/dashboard.js": 32000,
  "public/app-prompt-library.js": 35000,
  "public/admin-shell-polish.js": 12000,
  // Includes the small manifest-backed app-router entry that lazy-loads route bundles.
  nonCanvasInitialJs: 460000,
  // AIS-RLS-112 moves the icon CSS from CDN into the single local bundle.
  initialCss: 320000,
  cssModule: 16000,
  htmlInlineJson: 5000
};

function scriptPaths(html) {
  return [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map((match) => match[1]);
}

function stylesheetPaths(html) {
  return [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((url) => new URL(url, "https://example.test").origin === "https://example.test");
}

function diskPathFromPublicUrl(url) {
  const clean = new URL(url, "https://example.test").pathname.replace(/^\/+/, "");
  return clean.startsWith("public/") ? clean : `public/${clean}`;
}

function isCanvasUrl(url) {
  const pathname = new URL(url, "https://example.test").pathname;
  return pathname.startsWith("/canvas")
    || pathname.startsWith("/canvas-v2/")
    || /^\/dist\/canvas(?:-|\.|$)/.test(pathname);
}

function isBundledCssUrl(url) {
  const pathname = new URL(url, "https://example.test").pathname;
  return /^\/dist\/app\.[a-f0-9]{12}\.css$/.test(pathname);
}

function scriptPosition(html, scriptName) {
  const plainIndex = html.indexOf(`/${scriptName}`);
  if (plainIndex >= 0) return plainIndex;
  const stem = scriptName.replace(/\.js$/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.match(new RegExp(`/dist/${stem}\\.[a-f0-9]{12}\\.js`))?.index ?? -1;
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

assert(scriptPosition(indexHtml, "frontend-performance.js") >= 0, "index.html must load frontend-performance.js");
assert(scriptPosition(indexHtml, "frontend-performance.js") < scriptPosition(indexHtml, "app.js"), "frontend-performance.js must load before app.js");
assert(indexHtml.includes('preload="none"'), "hero video must avoid eager preload in static HTML");
assert(indexHtml.includes('poster="/hero/hero-poster.webp"'), "hero video must expose the local poster fallback");
assert(indexHtml.includes('src="/hero/hero.mp4"'), "hero video must use the local MP4 asset");
assert(!/cloudfront\.net|https:\/\/[^"]+\.mp4/.test(indexHtml), "hero video must not depend on remote media");
assert(!indexHtml.includes("<video autoplay"), "hero video should not autoplay before runtime budget checks");
assert(styles.includes('@import url("/css/pages/performance.css");'), "styles.css must import performance CSS");
assert(!adminDashboardJs.includes("/api/prompts?includeHidden=1&includeNoImage=1&limit=2000"), "admin dashboard must not load 2000 prompts on startup");
assert(adminDashboardJs.includes("/api/prompts?includeHidden=1&includeNoImage=1&limit=500"), "admin dashboard should keep prompt startup payload bounded");
assert(stat("public/hero/hero.mp4").size < 2 * 1024 * 1024, "hero MP4 must stay under 2 MB");
assert(stat("public/hero/hero-poster.webp").size < 60 * 1024, "hero poster must stay under 60 KB");

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
assert.equal(cssUrls.length, 1, "home page must load exactly one local CSS bundle");
assert(cssUrls.every(isBundledCssUrl), "home page CSS must use the content-hashed /dist/app.<hash>.css bundle");
const cssEntryBytes = cssUrls.reduce((sum, url) => sum + stat(diskPathFromPublicUrl(url)).size, 0);
const importedCssBytes = importedCssFiles().reduce((sum, relativePath) => sum + stat(relativePath).size, 0);
const initialCssBytes = cssUrls.some(isBundledCssUrl) ? cssEntryBytes : cssEntryBytes + importedCssBytes;
assert(
  initialCssBytes <= budgets.initialCss,
  `initial CSS is ${initialCssBytes} bytes; budget is ${budgets.initialCss}`
);
for (const relativePath of importedCssFiles()) assertBudget(relativePath, budgets.cssModule);

for (const token of [
  "IntersectionObserver",
  "MutationObserver",
  "requestIdleCallback",
  "saveData",
  "slow-2g",
  "effectiveType",
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
  ".performance-slow-connection",
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

console.log(`[frontend-performance-smoke] OK: non-canvas JS ${nonCanvasHomeBytes} bytes, CSS ${initialCssBytes} bytes`);

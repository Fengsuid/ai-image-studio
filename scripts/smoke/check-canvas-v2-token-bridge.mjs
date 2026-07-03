#!/usr/bin/env node
// Verifies Canvas v2 and Agent workspace consume the shared visual-token bridge
// while keeping their own hashed sub-app bundles.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const failures = [];
const tokenLinks = [
  "/css/00-tokens.css",
  "/css/00-tokens-typography.css",
  "/css/00-tokens-motion.css",
  "/css/00-theme.css",
  "/css/primitives/_toast.css",
  "/css/primitives/_drawer.css",
  "/css/primitives/_modal.css",
];

function fail(message) {
  failures.push(message);
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(join(rootDir, relativePath), "utf8"));
}

async function readText(relativePath) {
  return readFile(join(rootDir, relativePath), "utf8");
}

function requireIncludes(content, snippet, label) {
  if (!content.includes(snippet)) fail(`${label} must include ${snippet}`);
}

function requireNoMatch(content, pattern, message) {
  if (pattern.test(content)) fail(message);
}

function requireOrdered(content, snippets, label) {
  let previous = -1;
  for (const snippet of snippets) {
    const current = content.indexOf(snippet);
    if (current < 0) {
      fail(`${label} must include ${snippet}`);
      continue;
    }
    if (current <= previous) fail(`${label} must load ${snippet} after the previous bridge stylesheet`);
    previous = current;
  }
}

function requireTokenizedCssValues(css, sourcePath) {
  requireNoMatch(css, /font-size\s*:[^;]*\b[0-9]+(?:\.[0-9]+)?px\b/i, `${sourcePath} font-size declarations must use token variables, not px`);
  requireNoMatch(css, /\bbox-shadow\s*:(?!\s*var\()[^;]+/i, `${sourcePath} box-shadow values must come from var(--*)`);
  requireNoMatch(css, /\bborder-radius\s*:(?!\s*var\()[^;]*\b[0-9]+(?:\.[0-9]+)?px\b/i, `${sourcePath} border-radius values must come from var(--*)`);
}

function assertTokenizedCss({ appName, sourcePath, css }) {
  requireIncludes(css, "var(--", `${sourcePath}`);
  requireIncludes(css, "color-mix(in srgb", `${sourcePath}`);
  requireIncludes(css, "var(--font-body", `${sourcePath}`);
  requireIncludes(css, "var(--font-display", `${sourcePath}`);
  requireIncludes(css, "var(--radius-", `${sourcePath}`);
  requireIncludes(css, "var(--shadow-", `${sourcePath}`);
  requireIncludes(css, "100svh", `${sourcePath}`);
  requireIncludes(css, ".primitive-modal", `${sourcePath}`);
  requireIncludes(css, ".primitive-drawer", `${sourcePath}`);
  requireIncludes(css, ".primitive-toast", `${sourcePath}`);
  requireIncludes(css, ':root[data-theme="dark"]', `${sourcePath}`);
  requireNoMatch(css, /#[0-9a-fA-F]{3,8}\b/, `${sourcePath} must not hard-code hex colors`);
  requireNoMatch(css, /\brgba?\(/, `${sourcePath} must use token color-mix instead of rgb/rgba colors`);
  requireNoMatch(css, /\b100vh\b/, `${sourcePath} must use svh for mobile-safe viewport sizing`);
  const hardCodedFontFamily = css
    .split(/\r?\n/)
    .find((line) => line.includes("font-family:") && !/font-family:\s*var\(/.test(line));
  if (hardCodedFontFamily) {
    fail(`${sourcePath} font-family declarations must use token variables: ${hardCodedFontFamily.trim()}`);
  }
  requireTokenizedCssValues(css, sourcePath);
  for (const fallback of ["black", "white", "gray"]) {
    requireIncludes(css, fallback, `${sourcePath} fallback palette`);
  }
  if (appName === "canvas-v2") requireIncludes(css, "--canvas-v2-", `${sourcePath}`);
  if (appName === "agent") requireIncludes(css, "--agent-", `${sourcePath}`);
}

function assertSubAppShell({
  appName,
  indexPath,
  index,
  mountAttr,
  assetBase,
  scriptPattern,
}) {
  requireIncludes(index, `<html lang="zh-CN" data-app="${appName}"`, indexPath);
  requireIncludes(index, 'data-density="compact"', indexPath);
  requireIncludes(index, `<body data-app="${appName}">`, indexPath);
  requireIncludes(index, 'const k="imageStudio.theme"', indexPath);
  requireIncludes(index, "r.dataset.theme=t", indexPath);
  requireOrdered(index, tokenLinks.map((link) => `<link rel="stylesheet" href="${link}">`), indexPath);
  requireIncludes(index, mountAttr, indexPath);
  if (!scriptPattern.test(index)) {
    fail(`${indexPath} must reference ${assetBase}/assets/main.<hash>.js via <script>`);
  }
  if (!new RegExp(`href="(${assetBase}/assets/styles\\.[a-f0-9]{12}\\.css)"`).test(index)) {
    fail(`${indexPath} must reference ${assetBase}/assets/styles.<hash>.css via <link rel="stylesheet">`);
  }
  requireNoMatch(index, /setItem\(["']imageStudio\.theme/, `${indexPath} must not persist sub-app theme state`);
  requireNoMatch(index, /\/canvas\.js(?:["'?\s>]|$)/, `${indexPath} must NOT reference legacy /canvas.js`);
  requireNoMatch(index, /app\.js\?v=/, `${indexPath} must NOT use legacy app.js?v= cache-bust`);
}

async function assertBuiltCssTokenized({ index, assetBase }) {
  const match = index.match(new RegExp(`href="(${assetBase}/assets/styles\\.[a-f0-9]{12}\\.css)"`));
  if (!match) return;
  const assetPath = join("public", match[1].replace(/^\/+/, ""));
  const css = await readText(assetPath);
  requireNoMatch(css, /#[0-9a-fA-F]{3,8}\b/, `${match[1]} must not hard-code hex colors`);
  requireNoMatch(css, /\brgba?\(/, `${match[1]} must use token color-mix instead of rgb/rgba colors`);
  requireNoMatch(css, /\b100vh\b/, `${match[1]} must use svh for mobile-safe viewport sizing`);
  requireTokenizedCssValues(css, match[1]);
}

const mainManifest = await readJson("public/frontend-build-manifest.json");
const canvasIndex = await readText("public/canvas-v2/index.html");
const agentIndex = await readText("public/agent/index.html");
const canvasCss = await readText("apps/canvas-v2/src/styles.css");
const agentCss = await readText("apps/agent-workspace/src/styles.css");
const canvasBuild = await readText("apps/canvas-v2/scripts/build.mjs");
const agentBuild = await readText("apps/agent-workspace/scripts/build.mjs");
const canvasMain = await readText("apps/canvas-v2/src/main.js");

const jsAssets = Array.isArray(mainManifest?.js?.assets) ? mainManifest.js.assets : [];
if (!jsAssets.length) fail("frontend-build-manifest.json js.assets must be a non-empty array");
const hashPattern = /^\/dist\/[A-Za-z0-9._-]+\.[a-f0-9]{12}\.js$/;
for (const asset of jsAssets) {
  if (!asset?.source || !asset?.entry || !asset?.hash) {
    fail(`asset entry missing source/entry/hash: ${JSON.stringify(asset)}`);
    continue;
  }
  if (!hashPattern.test(asset.entry)) {
    fail(`asset entry ${asset.entry} must match /dist/<name>.<hash>.js`);
  }
}

function lookup(source) {
  return jsAssets.find((asset) => asset?.source === source) || null;
}
if (!lookup("/app.js")) fail("/app.js missing from frontend-build-manifest.json");
if (!lookup("/canvas.js")) fail("/canvas.js missing from frontend-build-manifest.json");

assertSubAppShell({
  appName: "canvas-v2",
  indexPath: "public/canvas-v2/index.html",
  index: canvasIndex,
  mountAttr: "data-canvas-v2-root",
  assetBase: "/canvas-v2",
  scriptPattern: /src="(\/canvas-v2\/assets\/main\.[a-f0-9]{12}\.js)"/,
});
assertSubAppShell({
  appName: "agent",
  indexPath: "public/agent/index.html",
  index: agentIndex,
  mountAttr: "data-agent-workspace-root",
  assetBase: "/agent",
  scriptPattern: /src="(\/agent\/assets\/main\.[a-f0-9]{12}\.js)"/,
});

for (const [label, buildSource] of [
  ["apps/canvas-v2/scripts/build.mjs", canvasBuild],
  ["apps/agent-workspace/scripts/build.mjs", agentBuild],
]) {
  requireIncludes(buildSource, "hashContent", label);
  requireIncludes(buildSource, "main.js", label);
  requireOrdered(buildSource, tokenLinks, label);
  requireIncludes(buildSource, 'const k="imageStudio.theme"', label);
  requireIncludes(buildSource, "data-app=", label);
  requireIncludes(buildSource, 'data-density="compact"', label);
  requireNoMatch(buildSource, /setItem\(["']imageStudio\.theme/, `${label} must not persist sub-app theme state`);
}

assertTokenizedCss({
  appName: "canvas-v2",
  sourcePath: "apps/canvas-v2/src/styles.css",
  css: canvasCss,
});
assertTokenizedCss({
  appName: "agent",
  sourcePath: "apps/agent-workspace/src/styles.css",
  css: agentCss,
});

requireNoMatch(
  canvasMain,
  /\/canvas\.js\b|app\.js\?v=/,
  "apps/canvas-v2/src/main.js must NOT hard-code /canvas.js or app.js?v= paths"
);

await assertBuiltCssTokenized({
  index: canvasIndex,
  assetBase: "/canvas-v2",
});
await assertBuiltCssTokenized({
  index: agentIndex,
  assetBase: "/agent",
});

if (failures.length) {
  console.error("[canvas-v2-token-bridge] FAIL:");
  for (const message of failures) console.error(` - ${message}`);
  process.exit(1);
}

console.log(
  `[canvas-v2-token-bridge] OK: ${jsAssets.length} main bundles; canvas-v2 and agent consume shared token/theme/primitive bridge`
);

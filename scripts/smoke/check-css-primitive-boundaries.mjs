#!/usr/bin/env node
// Static guard for AIS-RLS-146 token/primitive/page/mobile CSS boundaries.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cssDir = path.join(rootDir, "public/css");
const stylesPath = path.join(rootDir, "public/styles.css");
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
const failures = [];

function fail(message) {
  failures.push(message);
}

function check(condition, message) {
  if (!condition) fail(message);
}

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(rootDir, relativePath));
}

function listCssFiles(dir, prefix = "") {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) return listCssFiles(absolute, name);
    return entry.isFile() && entry.name.endsWith(".css") ? [name.replace(/\\/g, "/")] : [];
  });
}

function lineCount(content) {
  return content.split(/\r?\n/).length;
}

function selectorLists(source) {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, "");
  return [...css.matchAll(/([^{}]+)\{/g)]
    .map((match) => match[1].trim())
    .filter((selector) => selector && !selector.startsWith("@"));
}

function selectorItems(source) {
  return selectorLists(source)
    .flatMap((selector) => selector.split(","))
    .map((selector) => selector.trim())
    .filter(Boolean);
}

function hardCodedHexCount(relativePaths) {
  return relativePaths.reduce((count, relativePath) => {
    const source = read(path.join("public/css", relativePath).replace(/\\/g, "/"));
    return count + ([...source.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].length);
  }, 0);
}

check(
  packageJson.scripts?.["smoke:css-primitive-boundaries"] ===
    "node scripts/smoke/check-css-primitive-boundaries.mjs",
  "package.json must expose smoke:css-primitive-boundaries"
);

for (const requiredPath of [
  "public/css/tokens.css",
  "public/css/primitives",
  "public/css/pages",
  "public/css/mobile"
]) {
  check(exists(requiredPath), `${requiredPath} must exist`);
}

for (const primitive of [
  "_button.css",
  "_modal.css",
  "_drawer.css",
  "_toast.css",
  "_table.css",
  "_form.css",
  "_card.css",
  "_pill.css"
]) {
  check(exists(`public/css/primitives/${primitive}`), `missing primitive CSS file ${primitive}`);
}

const cssFiles = listCssFiles(cssDir).sort();
check(
  cssFiles.filter((file) => file.startsWith("primitives/_") && file.endsWith(".css")).length >= 8,
  "public/css/primitives must contain at least 8 underscore CSS modules"
);
for (const file of cssFiles) {
  check(!/\/?04-components[^/]*\.css$/.test(file), `legacy 04-components module must not remain: ${file}`);
  check(!/\/?12-animations[^/]*\.css$/.test(file), `legacy 12-animations module must not remain: ${file}`);
}

const styles = fs.readFileSync(stylesPath, "utf8");
const imports = [...styles.matchAll(/@import url\("\/css\/([^"]+\.css)"\);/g)].map((match) => match[1]);
check(imports.length === cssFiles.length, "styles.css import count must match public/css/**/*.css");
try {
  assert.deepEqual([...imports].sort(), cssFiles);
} catch {
  fail("styles.css imports must match public/css/**/*.css exactly");
}

const firstPrimitive = imports.findIndex((file) => file.startsWith("primitives/"));
const firstPage = imports.findIndex((file) => file.startsWith("pages/"));
const firstMobile = imports.findIndex((file) => file.startsWith("mobile/"));
const lastToken = Math.max(
  imports.findIndex((file) => file === "00-tokens.css"),
  imports.findIndex((file) => file === "00-tokens-typography.css"),
  imports.findIndex((file) => file === "00-tokens-motion.css"),
  imports.findIndex((file) => file === "00-theme.css"),
  imports.findIndex((file) => file === "tokens.css")
);
check(lastToken >= 0, "styles.css must import token and theme modules");
check(firstPrimitive > lastToken, "styles.css must order tokens before primitives");
check(firstPage > firstPrimitive, "styles.css must order primitives before pages");
check(firstMobile > firstPage, "styles.css must order pages before mobile modules");
check(
  imports.slice(firstPage).every((file) => !file.startsWith("primitives/")),
  "primitive imports must not appear after the page layer starts"
);
check(
  imports.slice(firstMobile).every((file) => file.startsWith("mobile/")),
  "only mobile imports may appear after the mobile layer starts"
);

const pageFiles = cssFiles.filter((file) => file.startsWith("pages/"));
const primitiveFiles = cssFiles.filter((file) => file.startsWith("primitives/"));
const mobileFiles = cssFiles.filter((file) => file.startsWith("mobile/"));

for (const file of pageFiles) {
  const source = read(`public/css/${file}`);
  check(lineCount(source) <= 600, `${file} exceeds 600 line page CSS budget`);
  for (const selector of selectorItems(source)) {
    check(
      !/^\.(?:btn\b|btn--|primitive-)/.test(selector),
      `${file} must not define button or primitive selector: ${selector}`
    );
  }
}

const pageScopePattern =
  /(^|[\s>+~(])\.(?:admin|gallery|home|prompt|works|editor|canvas|chat|leaderboard|topbar|hero|composer|square|message|route|library|reference|premium)-/;
for (const file of primitiveFiles) {
  const source = read(`public/css/${file}`);
  for (const selector of selectorItems(source)) {
    check(!selector.includes("#"), `${file} must not contain ID selectors: ${selector}`);
    check(!pageScopePattern.test(selector), `${file} must not contain page-scope selector: ${selector}`);
  }
}

const consumerHexCount = hardCodedHexCount([...pageFiles, ...primitiveFiles, ...mobileFiles]);
check(
  consumerHexCount <= 20,
  `consumer CSS layers must keep hard-coded hex count <= 20, found ${consumerHexCount}`
);

if (failures.length) {
  console.error("[css-primitive-boundaries-smoke] failed:");
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log(
  `[css-primitive-boundaries-smoke] OK: ${primitiveFiles.length} primitives, ${pageFiles.length} page modules, ${mobileFiles.length} mobile modules`
);

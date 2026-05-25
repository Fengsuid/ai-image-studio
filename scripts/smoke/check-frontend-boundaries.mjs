#!/usr/bin/env node
// Static guardrail for frontend module boundaries. No network, browser, or DB required.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const failures = [];
const warnings = [];

const budgets = {
  "public/app.js": { maxLines: 7350, targetLines: 800, owner: "AppModules + feature modules" },
  "public/admin.js": { maxLines: 2100, targetLines: 400, owner: "AdminModules + admin-*.js" },
  "public/styles.css": { maxLines: 80, targetLines: 40, owner: "public/css/*.css imports only" },
  "public/css/*.css": { maxLines: 500, owner: "one visual domain per CSS module" }
};

const requiredAppScripts = [
  "app-modules.js",
  "frontend-build-manifest.js",
  "app-session.js",
  "app-generation.js",
  "app-gallery.js",
  "app-reward-policy.js",
  "app-credits-detail.js",
  "app.js"
];

const requiredAdminScripts = [
  "admin-generation-diagnostics.js",
  "admin-overview.js",
  "admin-users.js",
  "admin-providers.js",
  "admin-gallery.js",
  "admin-settings.js",
  "admin.js"
];

const requiredCssModules = [
  "00-tokens.css",
  "00-theme.css",
  "01-reset.css",
  "02-typography.css",
  "03-layout.css",
  "03-layout-shell.css",
  "04-components.css",
  "04-components-cards.css",
  "04-components-modals.css",
  "04-components-forms.css",
  "05-home.css",
  "05-home-composer.css",
  "06-gallery.css",
  "06-gallery-detail.css",
  "06-gallery-leaderboard.css",
  "06-gallery-leaderboard-responsive.css",
  "07-editor.css",
  "08-chat.css",
  "09-admin.css",
  "09-admin-panels.css",
  "09-admin-diagnostics.css",
  "10-canvas.css",
  "10-canvas-tools.css",
  "11-mobile.css",
  "12-animations.css",
  "12-visual-polish.css"
];

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

function fullPath(relativePath) {
  return path.join(root, relativePath);
}

function read(relativePath) {
  return fs.readFileSync(fullPath(relativePath), "utf8");
}

function exists(relativePath) {
  return fs.existsSync(fullPath(relativePath));
}

function lineCount(content) {
  return content.split(/\r?\n/).length;
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function scriptPosition(html, scriptName) {
  const plainIndex = html.indexOf(`/${scriptName}`);
  if (plainIndex >= 0) return plainIndex;
  const stem = scriptName.replace(/\.js$/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const hashed = html.match(new RegExp(`/dist/${stem}\\.[a-f0-9]{12}\\.js`));
  return hashed?.index ?? -1;
}

function checkFileBudget(relativePath, budget) {
  const lines = lineCount(read(relativePath));
  assert(
    lines <= budget.maxLines,
    `${relativePath} has ${lines} lines; move new code into ${budget.owner} before exceeding ${budget.maxLines}`
  );
  if (budget.targetLines && lines > budget.targetLines) {
    warn(`${relativePath} is ${lines} lines; long-term target is ${budget.targetLines} lines via ${budget.owner}`);
  }
}

function checkOrderedScripts(html, scripts, label) {
  let previous = -1;
  for (const scriptName of scripts) {
    const position = scriptPosition(html, scriptName);
    assert(position >= 0, `${label} must load ${scriptName}`);
    assert(position > previous, `${label} must load ${scriptName} after the previous frontend module`);
    previous = position;
  }
}

function checkModuleRegistration(relativePath, globalName, moduleNames) {
  const source = read(relativePath);
  for (const moduleName of moduleNames) {
    assert(
      source.includes(`${globalName}.${moduleName}`) || source.includes(`register("${moduleName}"`),
      `${relativePath} must register ${globalName}.${moduleName}`
    );
  }
}

function checkCssModules() {
  const cssDir = fullPath("public/css");
  assert(fs.existsSync(cssDir), "public/css directory must exist");
  const styles = read("public/styles.css");
  assert(styles.includes("AIS-RLS-071 compatibility entry"), "public/styles.css must remain a compatibility import entry");
  assert(!styles.includes("{\n  --") && !styles.includes(":root {"), "public/styles.css should not contain bulk CSS rules");

  const actual = fs.readdirSync(cssDir).filter((name) => name.endsWith(".css")).sort();
  assert(actual.length >= requiredCssModules.length, "public/css should contain the required split modules");

  for (const cssFile of requiredCssModules) {
    const relativePath = `public/css/${cssFile}`;
    assert(exists(relativePath), `missing CSS module ${relativePath}`);
    assert(styles.includes(`/css/${cssFile}`), `public/styles.css must import ${cssFile}`);
  }

  const imports = [...styles.matchAll(/@import url\("\/css\/([^"]+\.css)"\);/g)].map((match) => match[1]);
  assert(imports.length === actual.length, "public/styles.css import count must match public/css/*.css");
  assert(JSON.stringify([...imports].sort()) === JSON.stringify(actual), "public/styles.css imports must match public/css/*.css exactly");

  for (const cssFile of actual) {
    const relativePath = `public/css/${cssFile}`;
    const content = read(relativePath);
    const lines = lineCount(content);
    assert(lines <= budgets["public/css/*.css"].maxLines, `${relativePath} has ${lines} lines; split or move rules to the owning CSS module`);
    assert(content.trimStart().startsWith("/*"), `${relativePath} should start with a short module header comment`);
  }
}

function checkMaintenanceDocs() {
  const docPath = "docs/FRONTEND_MODULE_BOUNDARIES.md";
  assert(exists(docPath), `${docPath} must document where future frontend changes belong`);
  const doc = read(docPath);
  for (const snippet of [
    "AppModules",
    "AdminModules",
    "public/css",
    "smoke:frontend-boundaries",
    "Do not add new feature flows directly to public/app.js"
  ]) {
    assert(doc.includes(snippet), `${docPath} missing guidance: ${snippet}`);
  }
}

checkFileBudget("public/app.js", budgets["public/app.js"]);
checkFileBudget("public/admin.js", budgets["public/admin.js"]);
checkFileBudget("public/styles.css", budgets["public/styles.css"]);

const indexHtml = read("public/index.html");
const adminHtml = read("public/admin.html");
checkOrderedScripts(indexHtml, requiredAppScripts, "public/index.html");
checkOrderedScripts(adminHtml, requiredAdminScripts, "public/admin.html");

checkModuleRegistration("public/app-session.js", "AppModules", ["session"]);
checkModuleRegistration("public/app-generation.js", "AppModules", ["generation"]);
checkModuleRegistration("public/app-gallery.js", "AppModules", ["gallery"]);
checkModuleRegistration("public/admin-overview.js", "AdminModules", ["overview"]);
checkModuleRegistration("public/admin-users.js", "AdminModules", ["users"]);
checkModuleRegistration("public/admin-providers.js", "AdminModules", ["providers"]);
checkModuleRegistration("public/admin-gallery.js", "AdminModules", ["squareReview", "galleryFiles"]);
checkModuleRegistration("public/admin-settings.js", "AdminModules", ["settings"]);

const packageJson = JSON.parse(read("package.json"));
assert(
  packageJson.scripts?.["smoke:frontend-boundaries"] === "node scripts/smoke/check-frontend-boundaries.mjs",
  "package.json must expose smoke:frontend-boundaries"
);

checkCssModules();
checkMaintenanceDocs();

if (failures.length) {
  console.error("[frontend-boundaries-smoke] failed:");
  for (const failure of failures) console.error(` - ${failure}`);
  if (warnings.length) {
    console.error("[frontend-boundaries-smoke] warnings:");
    for (const message of warnings) console.error(` - ${message}`);
  }
  process.exit(1);
}

console.log("[frontend-boundaries-smoke] OK: module boundaries and file-size guardrails passed");
if (warnings.length) {
  console.log("[frontend-boundaries-smoke] warnings:");
  for (const message of warnings) console.log(` - ${message}`);
}

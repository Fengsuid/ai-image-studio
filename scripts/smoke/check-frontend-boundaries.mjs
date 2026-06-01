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
  "public/admin/*.js": { maxLines: 400, owner: "AdminCore + AdminDomains" },
  "public/styles.css": { maxLines: 80, targetLines: 40, owner: "public/css/*.css imports only" },
  "public/css/*.css": { maxLines: 500, owner: "one visual domain per CSS module" }
};

const requiredAppScripts = [
  "app-modules.js",
  "app-motion.js",
  "frontend-build-manifest.js",
  "app-router.js",
  "app-session.js",
  "app-generation.js",
  "app-gallery.js",
  "app-reward-policy.js",
  "app-credits-detail.js",
  "app.js"
];

const requiredAdminScripts = ["app-modules.js", "frontend-build-manifest.js", "app-router.js"];

const requiredLazyAdminScripts = [
  "/admin-generation-diagnostics.js",
  "/admin-overview.js",
  "/admin-users.js",
  "/admin-providers.js",
  "/admin-gallery.js",
  "/admin-settings.js",
  "/admin-shell-polish.js",
  "/admin/users.js",
  "/admin/prompts.js",
  "/admin/announcements.js",
  "/admin/settings.js",
  "/admin/canvas.js",
  "/admin/command-palette.js",
  "/admin/dashboard.js"
];

const requiredLazyCanvasScripts = [
  "/cache-db.js",
  "/canvas-store.js",
  "/canvas-nodes.js",
  "/canvas-geometry.js",
  "/canvas-layout.js",
  "/canvas-edges.js",
  "/canvas-workflows.js",
  "/canvas-minimap.js",
  "/canvas-selection.js",
  "/canvas-history.js",
  "/canvas-io.js",
  "/canvas-assistant.js",
  "/canvas-toolbar.js",
  "/canvas-inspector.js",
  "/canvas-market.js",
  "/canvas.js"
];

const requiredCssModules = [
  "00-tokens.css",
  "00-tokens-typography.css",
  "00-tokens-motion.css",
  "01-motion-library.css",
  "primitives/_button.css",
  "00-theme.css",
  "01-reset-base.css",
  "01-reset.css",
  "02-typography.css",
  "03-layout.css",
  "03-layout-app-shell.css",
  "03-layout-shell.css",
  "04-components.css",
  "04-components-cards.css",
  "04-components-modals.css",
  "04-components-forms.css",
  "05-home-shell.css",
  "05-home-publish.css",
  "05-home.css",
  "05-home-composer.css",
  "05-home-mobile.css",
  "06-gallery.css",
  "06-gallery-detail.css",
  "06-gallery-leaderboard.css",
  "06-gallery-leaderboard-responsive.css",
  "06-gallery-mobile.css",
  "07-editor.css",
  "07-editor-mobile.css",
  "07-editor-mobile-works.css",
  "07-editor-mobile-detail.css",
  "07-editor-mobile-narrow.css",
  "08-chat.css",
  "09-admin.css",
  "09-admin-panels.css",
  "09-admin-diagnostics.css",
  "10-canvas.css",
  "10-canvas-tools.css",
  "11-mobile.css",
  "11-mobile-shell.css",
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

function listHashedDistJavaScriptFiles() {
  const distDir = fullPath("public/dist");
  if (!fs.existsSync(distDir)) return [];
  return fs.readdirSync(distDir)
    .filter((fileName) => /\.[a-f0-9]{12}\.js$/.test(fileName))
    .map((fileName) => `public/dist/${fileName}`)
    .sort();
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
    warn(
      `${relativePath} is ${lines} lines; long-term target is ${budget.targetLines} lines via ${budget.owner}`
    );
  }
}

function checkOrderedScripts(html, scripts, label) {
  let previous = -1;
  for (const scriptName of scripts) {
    const position = scriptPosition(html, scriptName);
    assert(position >= 0, `${label} must load ${scriptName}`);
    assert(
      position > previous,
      `${label} must load ${scriptName} after the previous frontend module`
    );
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
  assert(
    styles.includes("AIS-RLS-071 compatibility entry"),
    "public/styles.css must remain a compatibility import entry"
  );
  assert(
    !styles.includes("{\n  --") && !styles.includes(":root {"),
    "public/styles.css should not contain bulk CSS rules"
  );

  function listCssModules(dir, prefix = "") {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const name = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) return listCssModules(absolute, name);
      return entry.isFile() && entry.name.endsWith(".css") ? [name] : [];
    });
  }

  const actual = listCssModules(cssDir)
    .sort();
  assert(
    actual.length >= requiredCssModules.length,
    "public/css should contain the required split modules"
  );

  for (const cssFile of requiredCssModules) {
    const relativePath = `public/css/${cssFile}`;
    assert(exists(relativePath), `missing CSS module ${relativePath}`);
    assert(styles.includes(`/css/${cssFile}`), `public/styles.css must import ${cssFile}`);
  }

  const imports = [...styles.matchAll(/@import url\("\/css\/([^"]+\.css)"\);/g)].map(
    (match) => match[1]
  );
  assert(
    imports.length === actual.length,
    "public/styles.css import count must match public/css/*.css"
  );
  assert(
    JSON.stringify([...imports].sort()) === JSON.stringify(actual),
    "public/styles.css imports must match public/css/*.css exactly"
  );

  for (const cssFile of actual) {
    const relativePath = `public/css/${cssFile}`;
    const content = read(relativePath);
    const lines = lineCount(content);
    assert(
      lines <= budgets["public/css/*.css"].maxLines,
      `${relativePath} has ${lines} lines; split or move rules to the owning CSS module`
    );
    assert(
      content.trimStart().startsWith("/*"),
      `${relativePath} should start with a short module header comment`
    );
  }

  const tokens = read("public/css/00-tokens.css");
  const typography = read("public/css/00-tokens-typography.css");
  const motion = read("public/css/00-tokens-motion.css");
  const motionLibrary = read("public/css/01-motion-library.css");
  const premiumInteractions = read("public/css/14-premium-interactions.css");
  const buttonPrimitive = read("public/css/primitives/_button.css");
  assert(
    /--brand-600:\s*#[0-9a-fA-F]{6};/.test(tokens),
    "00-tokens.css must expose Token v2 --brand-600"
  );
  assert(
    tokens.includes("--surface-canvas:") && tokens.includes("--neutral-900:"),
    "00-tokens.css must expose Token v2 surface and neutral scales"
  );
  assert(
    typography.includes("--font-display:") && typography.includes("--fs-display:"),
    "00-tokens-typography.css must expose typography tokens"
  );
  assert(
    motion.includes("--ease-spring:") && motion.includes("--dur-slower:"),
    "00-tokens-motion.css must expose motion tokens"
  );
  assert(lineCount(tokens) <= 90, "00-tokens.css must stay within AIS-RLS-133 token line budget");
  assert(
    lineCount(typography) <= 40,
    "00-tokens-typography.css must stay within AIS-RLS-133 typography line budget"
  );
  assert(
    lineCount(motion) <= 60,
    "00-tokens-motion.css must stay within AIS-RLS-133 motion line budget"
  );
  assert(tokens.includes("TODO(AIS-RLS-134)"), "00-tokens.css must keep a migration TODO anchor");
  assert(tokens.includes("@media (max-width: 768px)"), "00-tokens.css must cover mobile token overrides");
  assert(typography.includes("@media (max-width: 768px)"), "typography tokens must cover mobile overrides");
  assert(motion.includes("@media (prefers-reduced-motion: reduce)"), "motion tokens must honor reduced motion");
  for (const snippet of ["@keyframes shimmer", "@keyframes fade-up", "@keyframes spring-in", "@keyframes pulse-soft", "@keyframes floating-blob"]) {
    assert(motionLibrary.includes(snippet), `01-motion-library.css must define ${snippet}`);
  }
  assert(
    motionLibrary.includes(".anim-fade-up") &&
      motionLibrary.includes(".anim-spring-in") &&
      motionLibrary.includes(".anim-pulse-soft") &&
      motionLibrary.includes("var(--dur-") &&
      motionLibrary.includes("var(--ease-"),
    "01-motion-library.css must expose token-driven motion utility classes"
  );
  assert(
    motionLibrary.includes("radial-gradient") &&
      motionLibrary.includes("var(--mx)") &&
      motionLibrary.includes("var(--my)") &&
      motionLibrary.includes(".gallery-rank-card"),
    "01-motion-library.css must cover coordinate-driven card spotlight for gallery, recent, and leaderboard cards"
  );
  assert(
    premiumInteractions.includes("var(--mx") && premiumInteractions.includes("var(--my") && !premiumInteractions.includes("--spot-x"),
    "14-premium-interactions.css must not override AIS-RLS-137 spotlight with stale coordinate variables"
  );
  assert(
    motionLibrary.includes("@media (prefers-reduced-motion: reduce)") &&
      motionLibrary.includes("animation: none") &&
      motionLibrary.includes("background-color"),
    "01-motion-library.css must degrade motion for prefers-reduced-motion"
  );
  assert(styles.indexOf("/css/00-tokens.css") < styles.indexOf("/css/01-reset-base.css"), "token imports must precede token consumers");
  assert(styles.indexOf("/css/00-tokens-motion.css") < styles.indexOf("/css/01-motion-library.css"), "motion library must load after motion tokens");
  assert(styles.indexOf("/css/01-motion-library.css") < styles.indexOf("/css/01-reset-base.css"), "motion library must load before page modules");
  assert(styles.includes("/css/primitives/_button.css"), "public/styles.css must import button primitive");
  assert(styles.indexOf("/css/00-tokens-motion.css") < styles.indexOf("/css/primitives/_button.css"), "button primitive must load after token modules");
  assert(styles.indexOf("/css/01-reset-base.css") < styles.indexOf("/css/primitives/_button.css"), "button primitive must load after reset-base");
  assert(styles.indexOf("/css/primitives/_button.css") < styles.indexOf("/css/03-layout-app-shell.css"), "button primitive must load before legacy layout modules");
  assert(buttonPrimitive.includes(".btn--primary") && buttonPrimitive.includes(".btn--secondary") && buttonPrimitive.includes(".btn--ghost"), "button primitive must expose core variants");
  assert(buttonPrimitive.includes(".btn--danger") && buttonPrimitive.includes(".btn--link"), "button primitive must expose danger and link variants");
  assert(buttonPrimitive.includes("[data-loading]::after") && buttonPrimitive.includes("var(--dur-slower)"), "button primitive loading spinner must use motion token");
  assert(buttonPrimitive.includes(':root[data-theme="dark"] .btn'), "button primitive must include explicit dark-mode coverage");
  assert(!/#[0-9a-fA-F]{3,6}/.test(buttonPrimitive), "button primitive must not hard-code hex colors");
  const indexHtml = read("public/index.html");
  assert(indexHtml.includes('class="btn btn--primary send-button"'), "public index must consume .btn on the composer send button");
  assert(indexHtml.includes('class="btn btn--secondary composer-options-button options-toggle"'), "public index must consume .btn on composer option buttons");
  assert(
    indexHtml.includes('class="btn btn--ghost topbar-brand"') &&
      indexHtml.includes('class="btn btn--ghost btn--icon topbar-search"') &&
      indexHtml.includes('class="btn btn--ghost topbar-tab"') &&
      indexHtml.includes('class="btn btn--secondary topbar-chip') &&
      indexHtml.includes('class="btn btn--ghost btn--icon topbar-icon') &&
      indexHtml.includes('class="btn btn--primary topbar-login"') &&
      indexHtml.includes('class="btn btn--ghost btn--icon account-avatar"'),
    "public index compact topbar buttons must consume .btn variants"
  );
  const header = indexHtml.match(/<header class="topbar"[\s\S]*?<\/header>/)?.[0] || "";
  assert(header.includes('data-topbar-density="compact"'), "public topbar must opt into compact density");
  assert(!/\b(?:brand-btn|nav-pill|icon-pill|dark-pill)\b/.test(header), "compact public topbar must not retain legacy shell button classes");
  assert(indexHtml.includes('primitive-modal--menu topbar-overflow-menu'), "public topbar overflow must use the menu primitive hook");
  const legacyButtonGuardFiles = [
    "public/index.html",
    "public/app-auth.js",
    "public/app-prompt-library.js",
    "public/app.js",
    ...listHashedDistJavaScriptFiles()
  ];
  for (const file of legacyButtonGuardFiles) {
    assertLegacyButtonClassesUseBtn(file);
  }
  const theme = read("public/css/00-theme.css");
  assert(theme.includes("--brand-600: #60a5fa;") && theme.includes("--surface-canvas: #0f172a;"), "dark theme must override Token v2 colors and surfaces");
  const adminHtml = read("public/admin.html");
  assert(adminHtml.includes('<html lang="zh-CN" data-app="admin" data-density="compact">'), "admin root must opt into compact data-app token overrides");
}

function assertLegacyButtonClassesUseBtn(relativePath, { allowedWithoutBtn = [] } = {}) {
  const source = read(relativePath);
  const legacyButtonClasses = [
    "brand-btn",
    "nav-pill",
    "dark-pill",
    "icon-pill",
    "tool-button",
    "send-button",
    "composer-options-button",
    "ghost-button",
    "tiny-button",
    "use-button"
  ];
  const classAttrPattern = /\bclass=(["'`])([^"'`]+)\1/g;
  let match;
  while ((match = classAttrPattern.exec(source))) {
    const classes = match[2].split(/\s+/).filter(Boolean);
    const legacyClasses = legacyButtonClasses.filter((className) => classes.includes(className));
    if (!legacyClasses.length || classes.includes("btn")) continue;
    const allowed = legacyClasses.every((className) =>
      allowedWithoutBtn.some((allowedClass) => allowedClass === className)
    );
    assert(
      allowed,
      `${relativePath} must pair legacy button hook(s) ${legacyClasses.join(", ")} with .btn`
    );
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
for (const fileName of fs.readdirSync(path.join(root, "public/admin")).filter((name) => name.endsWith(".js"))) {
  checkFileBudget(path.join("public/admin", fileName).replace(/\\/g, "/"), budgets["public/admin/*.js"]);
}
checkFileBudget("public/styles.css", budgets["public/styles.css"]);

const indexHtml = read("public/index.html");
const adminHtml = read("public/admin.html");
const buildManifest = JSON.parse(read("public/frontend-build-manifest.json"));
checkOrderedScripts(indexHtml, requiredAppScripts, "public/index.html");
checkOrderedScripts(adminHtml, requiredAdminScripts, "public/admin.html");
assert(
  scriptPosition(indexHtml, "canvas.js") < 0,
  "public/index.html must lazy-load canvas.js through app-router"
);
assert(
  scriptPosition(adminHtml, "dashboard.js") < 0,
  "public/admin.html must lazy-load admin dashboard through app-router"
);
assert(
  JSON.stringify(buildManifest.js?.lazyRoutes?.admin?.scripts || []) ===
    JSON.stringify(requiredLazyAdminScripts),
  "frontend manifest must preserve admin lazy route script order"
);
assert(
  JSON.stringify(buildManifest.js?.lazyRoutes?.canvas?.scripts || []) ===
    JSON.stringify(requiredLazyCanvasScripts),
  "frontend manifest must preserve canvas lazy route script order"
);

checkModuleRegistration("public/app-session.js", "AppModules", ["session"]);
checkModuleRegistration("public/app-motion.js", "AppModules", ["motion"]);
checkModuleRegistration("public/app-generation.js", "AppModules", ["generation"]);
checkModuleRegistration("public/app-gallery.js", "AppModules", ["gallery"]);
checkModuleRegistration("public/admin-overview.js", "AdminModules", ["overview"]);
checkModuleRegistration("public/admin-users.js", "AdminModules", ["users"]);
checkModuleRegistration("public/admin-providers.js", "AdminModules", ["providers"]);
checkModuleRegistration("public/admin-gallery.js", "AdminModules", [
  "squareReview",
  "galleryFiles"
]);
checkModuleRegistration("public/admin-settings.js", "AdminModules", ["settings"]);

const packageJson = JSON.parse(read("package.json"));
assert(
  packageJson.scripts?.["smoke:frontend-boundaries"] ===
    "node scripts/smoke/check-frontend-boundaries.mjs",
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

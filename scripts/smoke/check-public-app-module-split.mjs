#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function scriptPosition(html, scriptName) {
  const plainIndex = html.indexOf(`/${scriptName}`);
  if (plainIndex >= 0) return plainIndex;
  const stem = scriptName.replace(/\.js$/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const hashed = html.match(new RegExp(`/dist/${stem}\\.[a-f0-9]{12}\\.js`));
  return hashed?.index ?? -1;
}

const indexHtml = read("public/index.html");
const appJs = read("public/app.js");
const appAuthJs = read("public/app-auth.js");
const appSettingsJs = read("public/app-settings.js");
const packageJson = JSON.parse(read("package.json"));

const moduleScripts = [
  "app-modules.js",
  "app-session.js",
  "app-generation.js",
  "app-gallery.js",
  "app-auth.js",
  "app-settings.js"
];

const appPosition = scriptPosition(indexHtml, "app.js");
assert(appPosition >= 0, "index.html must load app.js");

for (const scriptName of moduleScripts) {
  const position = scriptPosition(indexHtml, scriptName);
  assert(position >= 0, `index.html must load ${scriptName}`);
  assert(position < appPosition, `${scriptName} must load before app.js`);
}

const moduleSourceChecks = {
  "public/app-modules.js": ["global.AppModules", "register"],
  "public/app-session.js": ['register("session"', "renderImageSessions"],
  "public/app-generation.js": ['register("generation"', "renderResultActions"],
  "public/app-gallery.js": ['register("gallery"', "renderLeaderboard"],
  "public/app-auth.js": ['register("auth"', "createAuthController", "bindAccountEvents", "openMyWorksModal", "X-CSRF-Token"],
  "public/app-settings.js": ['register("settings"', "createSettingsController", "bindLanguageToggle", "readPreference", "writePreference"]
};

for (const [relativePath, snippets] of Object.entries(moduleSourceChecks)) {
  const source = read(relativePath);
  for (const snippet of snippets) {
    assert(source.includes(snippet), `${relativePath} missing ${snippet}`);
  }
}

assert(appJs.includes("window.AppModules?.session?.renderImageSessions"), "app.js should delegate session rendering through AppModules.session");
assert(appJs.includes("window.AppModules?.generation?.renderResultActions"), "app.js should delegate result actions through AppModules.generation");
assert(appJs.includes("window.AppModules?.gallery?.renderLeaderboard"), "app.js should delegate leaderboard rendering through AppModules.gallery");
assert(appJs.includes("window.AppModules?.gallery?.createTagViewModel"), "app.js should delegate tag view models through AppModules.gallery");
assert(appJs.includes("window.AppModules?.gallery?.createDetailMedia"), "app.js should delegate detail media through AppModules.gallery");
assert(appJs.includes("window.AppModules?.auth?.create"), "app.js should initialize auth through AppModules.auth.create");
assert(appJs.includes("requireAuthController().bindAccountEvents"), "app.js should delegate account event binding through AppModules.auth");
assert(appJs.includes('window.AppModules?.register?.("auth", controller)'), "app.js should publish the initialized auth controller");
assert(appJs.includes("window.AppModules?.settings?.create"), "app.js should initialize settings through AppModules.settings.create");
assert(appJs.includes('window.AppModules?.register?.("settings"'), "app.js should publish the initialized settings controller");
assert(appJs.includes("requireSettingsController().bindLanguageToggle"), "app.js should delegate language toggle binding through AppModules.settings");
assert(!appJs.includes("id=\"authForm\""), "app.js should not render auth form markup directly");
assert(!appJs.includes("works-bulk-actions"), "app.js should not render My Works bulk action markup directly");
assert(!appJs.includes("const i18n ="), "app.js should not own the i18n dictionary directly");
assert(appAuthJs.includes("id=\"authForm\""), "app-auth.js should own auth form markup");
assert(appAuthJs.includes("works-bulk-actions"), "app-auth.js should own My Works markup");
assert(appSettingsJs.includes("const i18n ="), "app-settings.js should own the i18n dictionary");
assert(appSettingsJs.includes("safeStorageWrite(\"lang\""), "app-settings.js should persist language preferences");
assert(appJs.split(/\r?\n/).length <= 6200, "app.js should stay below the AIS-RLS-108 line-count budget");
assert(appSettingsJs.split(/\r?\n/).length >= 300, "app-settings.js should be a real module, not a bridge stub");

assert(
  packageJson.scripts?.["smoke:public-app-module-split"] === "node scripts/smoke/check-public-app-module-split.mjs",
  "package.json must expose smoke:public-app-module-split"
);

if (failures.length) {
  console.error("[smoke] public app module split failed:");
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log("[smoke] public app module split checks passed");

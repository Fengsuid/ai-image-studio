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
  const index = html.indexOf(`/${scriptName}`);
  return index >= 0 ? index : -1;
}

const indexHtml = read("public/index.html");
const appJs = read("public/app.js");
const packageJson = JSON.parse(read("package.json"));

const moduleScripts = [
  "app-modules.js",
  "app-session.js",
  "app-generation.js",
  "app-gallery.js"
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
  "public/app-gallery.js": ['register("gallery"', "renderLeaderboard"]
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

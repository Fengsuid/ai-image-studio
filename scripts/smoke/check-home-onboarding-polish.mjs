#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), "utf8");

const index = read("public/index.html");
const app = read("public/app.js");
const homeModule = read("public/home-onboarding.js");
const styles = read("public/styles.css");
const css = read("public/css/05-home-onboarding.css");
const packageJson = JSON.parse(read("package.json"));

function scriptPosition(html, scriptName) {
  const plainIndex = html.indexOf(`/${scriptName}`);
  if (plainIndex >= 0) return plainIndex;
  const stem = scriptName.replace(/\.js$/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.match(new RegExp(`/dist/${stem}\\.[a-f0-9]{12}\\.js`))?.index ?? -1;
}

assert.equal(
  packageJson.scripts["smoke:home-onboarding-polish"],
  "node scripts/smoke/check-home-onboarding-polish.mjs",
  "package.json must expose smoke:home-onboarding-polish"
);

assert(scriptPosition(index, "home-onboarding.js") >= 0, "index.html must load home-onboarding.js");
assert(scriptPosition(index, "home-onboarding.js") < scriptPosition(index, "app.js"), "home-onboarding.js must load before app.js");
assert(index.includes("hero-pathway"), "home hero must expose generation path hints");
assert(index.includes("homeDiscovery"), "home hero must expose prompt discovery");
assert(styles.includes('/css/05-home-onboarding.css'), "styles.css must import home onboarding CSS");

for (const token of [
  "imageStudio.homeOnboarding.v1",
  "prefers-reduced-motion: reduce",
  "home-reduced-motion",
  "window.ImageStudioHomeOnboarding",
  "fillComposerPrompt",
  "data-home-prompt"
]) {
  assert(homeModule.includes(token), `home-onboarding.js missing ${token}`);
}

for (const token of [
  "window.ImageStudioHomeOnboarding?.init?.()",
  "setDraftPrompt(prompt = \"\"",
  "syncComposers();",
  "state.forceHero = true"
]) {
  assert(app.includes(token), `app.js missing lightweight onboarding integration ${token}`);
}

for (const selector of [
  ".hero-pathway",
  ".home-discovery",
  ".home-onboarding-card",
  ".home-reduced-motion .hero-video-layer video",
  "@media (max-width: 640px)",
  "@media (prefers-reduced-motion: reduce)"
]) {
  assert(css.includes(selector), `home onboarding CSS missing ${selector}`);
}

assert(!homeModule.includes("fetch("), "home-onboarding.js should not add network work to first paint");
assert(!homeModule.includes("innerHTML = localStorage"), "home-onboarding.js must not inject storage data as HTML");

console.log("[home-onboarding-polish] ok");

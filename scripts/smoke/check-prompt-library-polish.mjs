#!/usr/bin/env node
// Static guard for AIS-RLS-090 prompt library marketplace polish.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), "utf8");

const index = read("public/index.html");
const app = read("public/app.js");
const module = read("public/app-prompt-library.js");
const styles = read("public/styles.css");
const css = read("public/css/pages/prompt-library-polish.css");
const packageJson = JSON.parse(read("package.json"));

function scriptPosition(html, scriptName) {
  const plainIndex = html.indexOf(`/${scriptName}`);
  if (plainIndex >= 0) return plainIndex;
  const stem = scriptName.replace(/\.js$/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.match(new RegExp(`/dist/${stem}\\.[a-f0-9]{12}\\.js`))?.index ?? -1;
}

assert.equal(
  packageJson.scripts["smoke:prompt-library-polish"],
  "node scripts/smoke/check-prompt-library-polish.mjs",
  "package.json must expose smoke:prompt-library-polish"
);

assert(scriptPosition(index, "app-prompt-library.js") > -1, "index.html must load app-prompt-library.js");
assert(scriptPosition(index, "app-modules.js") < scriptPosition(index, "app-prompt-library.js"), "app-modules.js must load before prompt library module");
assert(scriptPosition(index, "app-prompt-library.js") < scriptPosition(index, "app.js"), "app-prompt-library.js must load before app.js");
assert(styles.includes('/css/pages/prompt-library-polish.css'), "styles.css must import prompt library polish CSS");

for (const token of [
  "AppModules?.register?.(\"promptLibrary\"",
  "ImageStudioPromptLibrary",
  "renderPromptCard",
  "renderTagFilters",
  "renderSortControl",
  "renderStats",
  "renderLibraryState",
  "renderEmptyTagState",
  "renderSourceNotice",
  "renderPromptDetailModal"
]) {
  assert(module.includes(token), `app-prompt-library.js missing ${token}`);
}

for (const token of [
  "noCover",
  "remote",
  "local",
  "AI audit",
  "Duplicate candidate",
  "permissionTitle",
  "offlineTitle",
  "fallbackTitle"
]) {
  assert(module.includes(token), `app-prompt-library.js missing state label ${token}`);
}

for (const token of [
  "promptLibraryModule()",
  "promptLibraryRenderContext()",
  "module?.renderPromptCard",
  "module?.renderLibraryState",
  "module?.renderPromptDetailModal",
  "promptLibraryMeta",
  "fallbackUsed",
  "permissionDenied",
  "navigator.onLine === false",
  "setLikeFeedback",
  "prompt-like-error"
]) {
  assert(app.includes(token), `app.js missing prompt library integration ${token}`);
}

assert(!app.includes("limit=2000"), "prompt library should avoid full-database API loads");
assert(app.includes("promptPageSize: 120"), "prompt library should load prompts in bounded pages");
assert(app.includes("promptHasMore"), "prompt library should track server pagination");
assert(app.includes("promptLibraryRequestUrl"), "prompt library should build paged API requests");
assert(!app.includes("function renderPromptLibraryMarketplacePolish"), "prompt library polish should not expand app.js with a large new renderer");

for (const selector of [
  ".prompt-library-card",
  ".prompt-card-no-cover",
  ".prompt-card-source",
  ".prompt-status-badge",
  ".prompt-library-no-cover",
  ".prompt-library-state",
  ".prompt-library-state-warning",
  ".prompt-library-state-error",
  ".prompt-library-state-offline",
  ".prompt-library-state-permission",
  ".prompt-library-detail-modal",
  ".prompt-like-error",
  ":root[data-theme=\"dark\"]",
  "@media (prefers-reduced-motion: reduce)",
  "@media (max-width: 640px)"
]) {
  assert(css.includes(selector), `prompt library CSS missing ${selector}`);
}

assert(css.split(/\r?\n/).length < 500, "prompt library CSS module should stay below 500 lines");
assert(!module.includes("fetch("), "app-prompt-library.js should stay presentation-only and avoid network work");

console.log("[prompt-library-polish] ok");

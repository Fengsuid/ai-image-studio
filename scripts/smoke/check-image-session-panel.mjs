#!/usr/bin/env node
// Static smoke for the image session sidebar interaction wiring.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const appJs = fs.readFileSync(path.join(rootDir, "public", "app.js"), "utf8");
const html = fs.readFileSync(path.join(rootDir, "public", "index.html"), "utf8");

assert(html.includes('id="newImageSessionBtn"'), "index.html must render the new session button");
assert(appJs.includes("function focusGenerationComposer()"), "public/app.js must expose a local focusGenerationComposer helper");
assert(appJs.includes("newImageSessionBtn?.addEventListener(\"click\""), "new session button must have a click handler");
assert(appJs.includes("createRecoveredImageSessions"), "history recovery must split sessions instead of collapsing them into one bucket");
assert(appJs.includes("try {"), "image session recovery should be guarded so it cannot break login/bootstrap");

console.log("[image-session-panel] OK: new-session binding and recovery helpers are present");

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
assert(appJs.includes("function openSessionDrawer({ force = false } = {})"), "session drawer toggle must route through an explicit opener");
assert(appJs.includes('openSessionDrawer({ force: true })'), "manual drawer toggle must bypass stale mobile composer locks");
assert(appJs.includes("newImageSessionBtn?.addEventListener(\"click\""), "new session button must have a click handler");
assert(appJs.includes("if (event.target.closest(\"[data-session-action]\")) return;"), "session row click must ignore action buttons");
assert(appJs.includes("renderImageSessions({ force: true })"), "session drawer opener must force-bind freshly rendered actions");
assert(appJs.includes("HIDDEN_IMAGE_SESSION_IDS_KEY"), "deleted sessions must persist hidden generation ids");
assert(appJs.includes("state.hiddenImageSessionIds = [...new Set(["), "deleteImageSession must hide deleted session generation ids");
assert(appJs.includes("filter((id) => !hiddenIds.has(id))"), "session recovery must skip hidden generation ids");
assert(appJs.includes("state.hiddenImageSessionIds = (state.hiddenImageSessionIds || []).filter"), "new active generations must unhide their ids");
assert(appJs.includes("createRecoveredImageSessions"), "history recovery must split sessions instead of collapsing them into one bucket");
assert(appJs.includes("try {"), "image session recovery should be guarded so it cannot break login/bootstrap");
assert(html.includes('id="sessionDrawerToggle"'), "index.html must render the session drawer toggle");
const sessionListJs = fs.readFileSync(path.join(rootDir, "public", "image-session-list.js"), "utf8");
assert(sessionListJs.includes("data-session-action"), "session action controls must be marked so row activation can ignore them");
assert(sessionListJs.includes('role="button"') && sessionListJs.includes('tabindex="0"'), "session rows must remain keyboard reachable without nesting action buttons");
assert(!sessionListJs.includes('<button class="chat-session-card'), "session rows must not be outer buttons around nested action buttons");

console.log("[image-session-panel] OK: new-session binding and recovery helpers are present");

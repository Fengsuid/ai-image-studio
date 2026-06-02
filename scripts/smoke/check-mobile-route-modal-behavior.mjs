#!/usr/bin/env node
// Static guard for the mobile modal, generation, and public route behavior fixed in the current task.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file) => fs.readFileSync(path.join(rootDir, file), "utf8");

const app = read("public/app.js");
const galleryNormalize = read("public/gallery-normalize.js");
const themeNav = read("public/theme-mobile-nav.js");
const mobileEditorCss = read("public/css/mobile/_mobile-editor.css");
const galleryCss = read("public/css/pages/gallery-leaderboard-responsive.css");
const mobileGalleryCss = read("public/css/mobile/_mobile-overrides.css");
const mobileBottomSheetCss = read("public/css/mobile/_bottom-nav.css");
const modalPrimitiveCss = read("public/css/primitives/_modal.css");
const server = read("server.js");
const pkg = JSON.parse(read("package.json"));

assert(app.includes("sessionDrawerLocked"), "app.js must lock session drawer after generate entry");
assert(app.includes("releaseSessionDrawerLock"), "app.js must expose a session drawer release hook");
assert(app.includes("focusGenerationComposer()"), "app.js must keep generate entry on the new-session path");
assert(app.includes("square-preview-layer"), "app.js must mark square preview modals with an explicit layer class");
assert(app.includes("openImageEditor(imageUrl = \"\", prompt = \"\")"), "openImageEditor must close active modals before switching views");
assert(app.includes("openCanvasWorkspace()"), "openCanvasWorkspace must close active modals before switching views");
assert(app.includes("publishConversationRouteWithCurrentSession"), "publish flow must use the current-session route helper");
assert(app.includes("state.sessionDrawerLocked = false;"), "state lock must be released when leaving home");
assert(themeNav.includes("releaseSessionDrawerLock"), "theme mobile nav must release session lock on non-generate actions");
assert(galleryNormalize.includes("continuousSessionEntriesForItem"), "gallery normalize must crop publish routes to the current session chain");
assert(galleryNormalize.includes("publishConversationRouteForItem"), "gallery normalize must still export publishConversationRouteForItem");
assert(galleryCss.includes(".square-preview-side"), "gallery responsive CSS must keep the preview route pane scrollable");
assert(galleryCss.includes(".app:not(.session-panel-open) .chat-session-panel"), "mobile gallery CSS must prevent accidental drawer interaction");
assert(mobileGalleryCss.includes(".modal-layer.square-preview-layer"), "final mobile gallery CSS must center the square preview modal layer without :has()");
assert(mobileGalleryCss.includes("z-index: 180;"), "square preview modal layer must sit above the mobile bottom nav");
assert(mobileGalleryCss.includes("position: static !important;"), "square preview actions must stay in the scrollable content flow on mobile");
assert(mobileGalleryCss.includes("overflow-y: auto;"), "square preview side pane must remain independently scrollable on mobile");
assert(mobileBottomSheetCss.includes(".square-preview-modal::before"), "mobile bottom-sheet handle must not become a square preview grid item");
assert(modalPrimitiveCss.includes("@keyframes modalIn"), "modal primitive must own modalIn animation");
assert(!galleryCss.includes("@keyframes modalIn"), "gallery CSS must not duplicate modalIn");
assert(mobileEditorCss.includes(".works-bulk-actions"), "mobile editor CSS must keep bulk actions compressed");
assert(mobileEditorCss.includes(".works-detail-actions"), "mobile editor CSS must keep detail actions compressed");
assert(server.includes("sanitizeConversationRoute(body.conversationRoute)"), "server must persist sanitized conversationRoute");
assert(pkg.scripts?.["smoke:mobile-route-modal-behavior"] === "node scripts/smoke/check-mobile-route-modal-behavior.mjs", "package.json must expose the new smoke");

console.log("[mobile-route-modal-behavior] OK");

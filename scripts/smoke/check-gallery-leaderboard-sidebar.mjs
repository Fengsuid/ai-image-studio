#!/usr/bin/env node
// Static guard for the standalone gallery leaderboard page and compact like controls.

import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const indexHtml = fs.readFileSync(path.join(rootDir, "public/index.html"), "utf8");
const app = fs.readFileSync(path.join(rootDir, "public/app.js"), "utf8");
const leaderboard = fs.readFileSync(path.join(rootDir, "public/gallery-leaderboard.js"), "utf8");
const css = fs.readFileSync(path.join(rootDir, "public/styles.css"), "utf8");
const server = fs.readFileSync(path.join(rootDir, "server.js"), "utf8");

assert(app.includes("gallery-main-grid"), "library cards must be wrapped separately from the leaderboard");
assert(app.includes("ImageStudioGalleryLeaderboard"), "app.js must delegate leaderboard rendering to a focused module");
assert(app.includes("renderLeaderboardPage"), "app.js must render the standalone leaderboard page");
assert(!app.includes("<div class=\"gallery-main-grid\">${cardsHtml}</div>${renderGalleryLeaderboard()}"), "library view must not inline the leaderboard beside cards");
assert(!app.includes("bindGalleryLeaderboardControls(elements.promptGrid);"), "library view must not bind leaderboard controls inside the gallery grid");
assert(indexHtml.includes("/gallery-leaderboard.js"), "index.html must load gallery-leaderboard.js before app.js");
assert(indexHtml.indexOf("/gallery-leaderboard.js") < indexHtml.indexOf("/app.js"), "gallery-leaderboard.js must load before app.js");
assert(indexHtml.includes("/gallery-leaderboard.js?v=20260521-leaderboard-top-v5"), "leaderboard module must have a fresh cache-busting version");
assert(indexHtml.includes("/styles.css?v=20260521-leaderboard-top-v5"), "styles bundle must have a fresh cache-busting version");
assert(indexHtml.includes("/app.js?v=20260521-canvas-v2-entry-v1"), "app bundle must have a fresh cache-busting version");
assert(leaderboard.includes("ImageStudioGalleryLeaderboard"), "leaderboard module must register a global helper");
assert(leaderboard.includes("<aside class=\"gallery-leaderboard"), "leaderboard must render as a navigation/sidebar aside");
assert(leaderboard.includes("const MAX_LEADERBOARD_ITEMS = 99;"), "leaderboard page must expose up to 99 ranked items");
assert(leaderboard.includes("rawItems.slice(0, MAX_LEADERBOARD_ITEMS)"), "leaderboard must use the shared 99-item cap");
assert(leaderboard.includes("rankImageUrl"), "leaderboard must normalize imageUrl/coverUrl/preview/image fields itself");
assert(leaderboard.includes("gallery-rank-missing"), "leaderboard must render a visible fallback for image-less items");
assert(leaderboard.includes("gallery-rank-index"), "rank items must expose compact rank numbers");
assert(leaderboard.includes("gallery-rank-copy"), "rank items must expose compact title/author copy");
assert(leaderboard.includes("gallery-rank-actions"), "rank items must expose compact heart actions");
assert(leaderboard.includes("class=\"rank-like"), "leaderboard like buttons must use compact rank-like styling");
assert(leaderboard.includes("data-like-gallery") && leaderboard.includes("data-like-prompt"), "leaderboard likes must reuse existing gallery/prompt like handlers");
assert(app.includes("state.promptItems = state.promptItems.map(apply);"), "gallery likes must stay synced after library rerender");
assert(app.includes('galleryLeaderboardRange: "all"'), "leaderboard must default to all-time so the first page is populated");
assert(app.includes("const GALLERY_LEADERBOARD_LIMIT = 99;"), "leaderboard API requests must ask for up to 99 items");
assert(app.includes("limit: String(GALLERY_LEADERBOARD_LIMIT)"), "leaderboard API limit must use the shared 99-item cap");
assert(server.includes("const GALLERY_LEADERBOARD_LIMIT_MAX = 99;"), "leaderboard API must cap responses at 99 items");
assert(server.includes("sanitizePositiveInt(url.searchParams.get(\"limit\"), 30, GALLERY_LEADERBOARD_LIMIT_MAX)"), "leaderboard API must use the 99-item cap");
assert(app.includes("openSquarePreviewById(id);"), "leaderboard gallery cards must fall back to API detail loading");
assert(app.includes("getPromptById(id) || findPromptLikeItem(id)"), "leaderboard prompt cards must open from leaderboard cache before prompt library finishes loading");
assert(app.includes('elements.leaderboardView?.classList.toggle("hidden", view !== "leaderboard");'), "setView must always sync leaderboard visibility");
assert(app.indexOf('elements.leaderboardView?.classList.toggle("hidden", view !== "leaderboard");') > app.indexOf("if (viewChanged) {"), "visibility sync must not be skipped when the route signature is unchanged");

const leaderboardBlock = css.match(/\.gallery-leaderboard\s*\{[^}]*\}/)?.[0] || "";
const rankCardBlock = css.match(/(^|\n)\.gallery-rank-card\s*\{[^}]*\}/)?.[0] || "";
assert(css.includes(".leaderboard-page .gallery-leaderboard"), "standalone leaderboard page styles must be present");
assert(css.includes("grid-template-columns: minmax(0, 1fr);"), "desktop library must stay single-column without an inline leaderboard sidebar");
assert(css.includes(".leaderboard-view,\n.canvas-view") || css.includes(".leaderboard-view,\r\n.canvas-view"), "leaderboard view must share the normal foreground view layer");
assert(css.includes("isolation: isolate;"), "leaderboard page must isolate itself from ambient/background layers");
assert(css.includes("padding: 12px clamp(16px, 4vw, 42px) 72px;"), "leaderboard page must sit directly below the top navigation without a large top gap");
assert(css.includes("width: min(1320px, 100%);"), "standalone leaderboard page must have an explicit page width");
assert(css.includes("gap: 0;"), "standalone leaderboard cards must connect to the heading card");
assert(css.includes("text-align: center;"), "standalone leaderboard title area must be centered");
assert(css.includes("border-radius: 24px 24px 0 0;"), "leaderboard heading must visually connect with the list card");
assert(css.includes("border-radius: 0 0 24px 24px;"), "leaderboard list card must visually connect with the heading card");
assert(css.includes(".leaderboard-page .gallery-rank-card .rank-like"), "standalone leaderboard cards must keep like controls visible");
assert(leaderboardBlock.includes("position: sticky"), "leaderboard module must preserve its card shell layout");
assert(css.includes("@media (max-width: 960px)"), "tablet/mobile must keep responsive leaderboard layout coverage");
assert(rankCardBlock.includes("display: grid"), "rank cards must use compact row layout");
assert(css.includes(".gallery-rank-card .rank-like"), "rank likes must avoid default button styling");
assert(css.includes(".gallery-rank-missing"), "leaderboard image fallback must be styled");

console.log("[gallery-leaderboard-sidebar-smoke] OK: standalone leaderboard page and compact like controls verified");

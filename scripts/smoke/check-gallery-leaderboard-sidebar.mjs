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

assert(app.includes("gallery-main-grid"), "library cards must be wrapped separately from the leaderboard");
assert(app.includes("ImageStudioGalleryLeaderboard"), "app.js must delegate leaderboard rendering to a focused module");
assert(app.includes("renderLeaderboardPage"), "app.js must render the standalone leaderboard page");
assert(!app.includes("<div class=\"gallery-main-grid\">${cardsHtml}</div>${renderGalleryLeaderboard()}"), "library view must not inline the leaderboard beside cards");
assert(!app.includes("bindGalleryLeaderboardControls(elements.promptGrid);"), "library view must not bind leaderboard controls inside the gallery grid");
assert(indexHtml.includes("/gallery-leaderboard.js"), "index.html must load gallery-leaderboard.js before app.js");
assert(indexHtml.indexOf("/gallery-leaderboard.js") < indexHtml.indexOf("/app.js"), "gallery-leaderboard.js must load before app.js");
assert(indexHtml.includes("/gallery-leaderboard.js?v=20260521-leaderboard-visible-v2"), "leaderboard module must have a fresh cache-busting version");
assert(indexHtml.includes("/styles.css?v=20260521-leaderboard-visible-v2"), "styles bundle must have a fresh cache-busting version");
assert(indexHtml.includes("/app.js?v=20260521-leaderboard-visible-v2"), "app bundle must have a fresh cache-busting version");
assert(leaderboard.includes("ImageStudioGalleryLeaderboard"), "leaderboard module must register a global helper");
assert(leaderboard.includes("<aside class=\"gallery-leaderboard"), "leaderboard must render as a navigation/sidebar aside");
assert(leaderboard.includes("const items = rawItems.slice(0, 24);"), "leaderboard must not silently filter API items without images");
assert(leaderboard.includes("rankImageUrl"), "leaderboard must normalize imageUrl/coverUrl/preview/image fields itself");
assert(leaderboard.includes("gallery-rank-missing"), "leaderboard must render a visible fallback for image-less items");
assert(leaderboard.includes("gallery-rank-index"), "rank items must expose compact rank numbers");
assert(leaderboard.includes("gallery-rank-copy"), "rank items must expose compact title/author copy");
assert(leaderboard.includes("gallery-rank-actions"), "rank items must expose compact heart actions");
assert(leaderboard.includes("class=\"rank-like"), "leaderboard like buttons must use compact rank-like styling");
assert(leaderboard.includes("data-like-gallery") && leaderboard.includes("data-like-prompt"), "leaderboard likes must reuse existing gallery/prompt like handlers");
assert(app.includes("state.promptItems = state.promptItems.map(apply);"), "gallery likes must stay synced after library rerender");
assert(app.includes('galleryLeaderboardRange: "all"'), "leaderboard must default to all-time so the first page is populated");
assert(app.includes("openSquarePreviewById(id);"), "leaderboard gallery cards must fall back to API detail loading");
assert(app.includes("getPromptById(id) || findPromptLikeItem(id)"), "leaderboard prompt cards must open from leaderboard cache before prompt library finishes loading");

const leaderboardBlock = css.match(/\.gallery-leaderboard\s*\{[^}]*\}/)?.[0] || "";
const rankCardBlock = css.match(/(^|\n)\.gallery-rank-card\s*\{[^}]*\}/)?.[0] || "";
assert(css.includes(".leaderboard-page .gallery-leaderboard"), "standalone leaderboard page styles must be present");
assert(css.includes("grid-template-columns: minmax(0, 1fr);"), "desktop library must stay single-column without an inline leaderboard sidebar");
assert(leaderboardBlock.includes("position: sticky"), "leaderboard module must preserve its card shell layout");
assert(css.includes("@media (max-width: 960px)"), "tablet/mobile must keep responsive leaderboard layout coverage");
assert(rankCardBlock.includes("display: grid"), "rank cards must use compact row layout");
assert(css.includes(".gallery-rank-card .rank-like"), "rank likes must avoid default button styling");
assert(css.includes(".gallery-rank-missing"), "leaderboard image fallback must be styled");

console.log("[gallery-leaderboard-sidebar-smoke] OK: standalone leaderboard page and compact like controls verified");

#!/usr/bin/env node
// Static guard for the gallery leaderboard sidebar layout and compact like controls.

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
assert(indexHtml.includes("/gallery-leaderboard.js"), "index.html must load gallery-leaderboard.js before app.js");
assert(indexHtml.indexOf("/gallery-leaderboard.js") < indexHtml.indexOf("/app.js"), "gallery-leaderboard.js must load before app.js");
assert(leaderboard.includes("ImageStudioGalleryLeaderboard"), "leaderboard module must register a global helper");
assert(leaderboard.includes("<aside class=\"gallery-leaderboard"), "leaderboard must render as a navigation/sidebar aside");
assert(leaderboard.includes("gallery-rank-index"), "rank items must expose compact rank numbers");
assert(leaderboard.includes("gallery-rank-copy"), "rank items must expose compact title/author copy");
assert(leaderboard.includes("gallery-rank-actions"), "rank items must expose compact heart actions");
assert(leaderboard.includes("class=\"rank-like"), "leaderboard like buttons must use compact rank-like styling");
assert(leaderboard.includes("data-like-gallery") && leaderboard.includes("data-like-prompt"), "leaderboard likes must reuse existing gallery/prompt like handlers");
assert(app.includes("state.promptItems = state.promptItems.map(apply);"), "gallery likes must stay synced after library rerender");

const leaderboardBlock = css.match(/\.gallery-leaderboard\s*\{[^}]*\}/)?.[0] || "";
const rankCardBlock = css.match(/\.gallery-rank-card\s*\{[^}]*\}/)?.[0] || "";
assert(css.includes("grid-template-columns: minmax(0, 1fr) minmax(280px, 336px)"), "desktop library must reserve a sidebar column");
assert(leaderboardBlock.includes("position: sticky"), "desktop leaderboard must be sticky sidebar content");
assert(css.includes("@media (max-width: 960px)"), "tablet/mobile must collapse the sidebar layout");
assert(rankCardBlock.includes("display: grid"), "rank cards must use compact row layout");
assert(css.includes(".gallery-rank-card .rank-like"), "rank likes must avoid default button styling");

console.log("[gallery-leaderboard-sidebar-smoke] OK: sidebar layout and compact like controls verified");

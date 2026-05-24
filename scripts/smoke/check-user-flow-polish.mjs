#!/usr/bin/env node
// Static smoke for chat image zoom, chat scroll-top, works layout, and user credit details.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file) => fs.readFileSync(path.join(rootDir, file), "utf8");

const app = read("public/app.js");
const html = read("public/index.html");
const server = read("server.js");
const chatCss = read("public/css/08-chat-polish.css");
const homeCss = read("public/css/05-home.css");
const creditsCss = read("public/css/06-credits-detail.css");
const pkg = JSON.parse(read("package.json"));

assert(html.includes('id="chatScrollTopBtn"'), "chat view must render a scroll-top button");
assert(app.includes("chatScrollTopBtn: $(\"#chatScrollTopBtn\")"), "app.js must bind chatScrollTopBtn");
assert(app.includes("openImageZoomModal"), "app.js must include generated image zoom modal");
assert(app.includes("data-zoom-history"), "history images must be clickable for zoom");
assert(app.includes("/api/credits/detail?limit=80"), "credits modal must load current-user credit details");
assert(server.includes('url.pathname === "/api/credits/detail"'), "server must expose current-user credit detail API");
assert(server.includes("store.listCreditLedger({ userId: current.user.id"), "credit detail API must scope ledger to current user");
assert(chatCss.includes(".chat-scroll-top"), "chat CSS must style scroll-top button");
assert(chatCss.includes(".image-zoom-modal"), "chat CSS must style image zoom modal");
assert(homeCss.includes("grid-auto-flow: dense"), "works grid must use dense layout");
assert(creditsCss.includes(".credits-detail-modal"), "credits detail modal styles missing");
assert(creditsCss.includes("@media (max-width: 640px)"), "mobile credits detail styles missing");
assert(pkg.scripts?.["smoke:user-flow-polish"] === "node scripts/smoke/check-user-flow-polish.mjs", "package.json must expose smoke:user-flow-polish");

console.log("[user-flow-polish] OK");

#!/usr/bin/env node
// Static smoke for chat image zoom, chat scroll-top, works layout, and user credit details.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file) => fs.readFileSync(path.join(rootDir, file), "utf8");

const app = read("public/app.js");
const appAuth = read("public/app-auth.js");
const html = read("public/index.html");
const creditsRoute = read("src/routes/credits.js");
const chatCss = read("public/css/pages/chat-polish.css");
const homeCss = read("public/css/pages/home.css");
const worksCarouselCss = read("public/css/pages/works-carousel.css");
const creditsCss = read("public/css/pages/credits-detail.css");
const pkg = JSON.parse(read("package.json"));

assert(html.includes('id="chatScrollTopBtn"'), "chat view must render a scroll-top button");
assert(app.includes("chatScrollTopBtn: $(\"#chatScrollTopBtn\")"), "app.js must bind chatScrollTopBtn");
assert(app.includes("openImageZoomModal"), "app.js must include generated image zoom modal");
assert(app.includes("data-zoom-history"), "history images must be clickable for zoom");
assert(appAuth.includes("/api/credits/detail?limit=80"), "credits modal must load current-user credit details");
assert(appAuth.includes("global.ImageStudioCreditsDetail.renderModal"), "auth module must render the credits detail modal");
assert(appAuth.includes('api("/api/checkin", { method: "POST" })'), "auth module must keep check-in submission in account flow");
assert(creditsRoute.includes('url.pathname === "/api/credits/detail"'), "server must expose current-user credit detail API");
assert(creditsRoute.includes("store.listCreditLedger({ userId: current.user.id"), "credit detail API must scope ledger to current user");
assert(chatCss.includes(".chat-scroll-top"), "chat CSS must style scroll-top button");
assert(chatCss.includes(".image-zoom-modal"), "chat CSS must style image zoom modal");
assert(homeCss.includes("minmax(280px, 1fr)"), "works base cards must remain readable before desktop carousel override");
assert(worksCarouselCss.includes("scroll-snap-type: x proximity"), "desktop works layout must support horizontal scrolling");
assert(worksCarouselCss.includes("flex: 0 0 clamp(280px, 24vw, 360px)"), "desktop works cards must stay in one horizontal row");
assert(creditsCss.includes(".credits-detail-modal"), "credits detail modal styles missing");
assert(creditsCss.includes("@media (max-width: 640px)"), "mobile credits detail styles missing");
assert(pkg.scripts?.["smoke:user-flow-polish"] === "node scripts/smoke/check-user-flow-polish.mjs", "package.json must expose smoke:user-flow-polish");

console.log("[user-flow-polish] OK");

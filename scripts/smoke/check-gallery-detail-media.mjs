#!/usr/bin/env node
// Static guard for gallery detail selected media behavior.

import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const indexHtml = fs.readFileSync(path.join(rootDir, "public/index.html"), "utf8");
const server = fs.readFileSync(path.join(rootDir, "server.js"), "utf8");
const app = fs.readFileSync(path.join(rootDir, "public/app.js"), "utf8");
const media = fs.readFileSync(path.join(rootDir, "public/gallery-detail-media.js"), "utf8");
const creativeRoute = fs.readFileSync(path.join(rootDir, "src/creative-route.js"), "utf8");
const css = fs.readFileSync(path.join(rootDir, "public/styles.css"), "utf8");

assert(indexHtml.includes("/gallery-detail-media.js"), "index.html must load gallery-detail-media.js");
assert(indexHtml.indexOf("/gallery-detail-media.js") < indexHtml.indexOf("/app.js"), "gallery-detail-media.js must load before app.js");
assert(app.includes("ImageStudioGalleryDetailMedia"), "app.js must delegate selected media state to the gallery detail module");
assert(app.includes("data-square-main-image"), "gallery detail must expose a replaceable main image");
assert(app.includes("data-square-main-prompt"), "gallery detail must expose a replaceable main prompt");
assert(app.includes("data-square-media=\"source\""), "source image card must be selectable");
assert(app.includes("data-square-media=\"result\""), "result image card must be selectable");
assert(app.includes("selectedMediaPayload"), "gallery detail actions must read selected media payload");
assert(app.includes("mediaController?.select?.(\"route-step\", idx)"), "route steps must update selected media");
assert(app.includes("data-square-download"), "download action must track the selected media");
assert(app.includes("item.creativeRoute?.length ? item.creativeRoute : item.conversation"), "gallery detail must prefer unified creativeRoute over legacy conversation");

assert(media.includes("selectedMediaType"), "canvas payload must record the selected media type");
assert(media.includes("type: \"source\""), "module must support source media");
assert(media.includes("type: \"route-step\""), "module must support route-step media");
assert(media.includes("images: [selected.imageUrl]"), "selected media payload must target the current image");
assert(media.includes("step.generationId || item.id"), "route-step payload must preserve the selected route generation id");

assert(server.includes("buildCreativeRouteForGeneration"), "server responses must build unified creativeRoute");
assert(server.includes("creativeRoute"), "generation responses must expose creativeRoute");
assert(server.includes("publicRouteImageRef"), "server route ingestion must scrub private route image refs");
assert(creativeRoute.includes("PRIVATE_ROUTE_KEYS"), "creative route module must define private metadata keys");
assert(creativeRoute.includes("source-file"), "creative route module must strip private source-file references");
assert(creativeRoute.includes("buildCreativeRouteFromCanvasData"), "creative route module must normalize Canvas routes");

assert(css.includes(".square-media-card.active"), "selected source/result cards must have an active style");
assert(css.includes(".square-route-step.active"), "selected route steps must have an active style");

console.log("[gallery-detail-media-smoke] OK: gallery detail selected media stays in sync");

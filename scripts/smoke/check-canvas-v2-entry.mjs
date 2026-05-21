#!/usr/bin/env node
// Static guard for public Canvas v2 entry routing and rollback switches.

import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
const indexHtml = fs.readFileSync(path.join(rootDir, "public/index.html"), "utf8");
const app = fs.readFileSync(path.join(rootDir, "public/app.js"), "utf8");
const resultActions = fs.readFileSync(path.join(rootDir, "public/generation-result-actions.js"), "utf8");
const server = fs.readFileSync(path.join(rootDir, "server.js"), "utf8");

assert.equal(
  packageJson.scripts["smoke:canvas-v2:entry"],
  "node scripts/smoke/check-canvas-v2-entry.mjs",
  "root smoke:canvas-v2:entry script missing",
);

assert(indexHtml.includes("/app.js?v=20260521-canvas-v2-entry-v1"), "app.js cache bust must include Canvas v2 entry release marker");
assert(indexHtml.includes("/generation-result-actions.js?v=20260521-canvas-v2-entry-v1"), "result actions cache bust must include Canvas v2 entry release marker");

assert(server.includes("function canvasEntryMode()"), "server must expose a Canvas entry mode helper");
assert(server.includes("process.env.CANVAS_ENTRY_MODE || process.env.CANVAS_V2_ENTRY_MODE || \"v2\""), "server flag must default main entries to Canvas v2");
assert(server.includes("[\"v2\", \"legacy\", \"hidden\"]"), "server flag must support v2, legacy, and hidden modes");
assert(server.includes("canvasEntryMode: canvasEntryMode()"), "public settings must include canvasEntryMode");

assert(app.includes("function canvasEntryMode()"), "app must normalize the Canvas entry mode");
assert(app.includes("return [\"v2\", \"legacy\", \"hidden\"].includes(mode) ? mode : \"v2\";"), "app must fall back to v2 for invalid modes");
assert(app.includes("function isCanvasEntryHidden()"), "app must expose hidden-mode checks");
assert(app.includes("function canvasV2ProjectUrl(projectId = \"\")"), "app must build Canvas v2 project URLs");
assert(app.includes("`/canvas-v2/projects/${encodeURIComponent(projectId)}`"), "Canvas v2 project URLs must use /canvas-v2/projects/:id");
assert(app.includes("window.location.assign(canvasV2ProjectUrl())"), "main Canvas workspace entry must navigate to Canvas v2");
assert(app.includes("state.pendingAuthView = mode === \"v2\" ? \"canvas-v2\" : \"canvas\";"), "auth continuation must preserve Canvas v2 entry mode");
assert(app.includes("pendingView === \"canvas-v2\""), "login continuation must understand the Canvas v2 route");
assert(app.includes("openCanvasProject(newCanvasId)"), "public canvas route duplicate must open through the entry switch");
assert(app.includes("openNewCanvasWithPayload(canvasPayloadFromGeneration"), "gallery new-canvas action must use the Canvas v2 entry helper");
assert(app.includes("elements.canvasWorkspaceBtn?.addEventListener(\"click\", openCanvasWorkspace)"), "top-nav Canvas button must use the entry switch");
assert(app.includes("elements.openCanvasInlineBtn?.addEventListener(\"click\", openCanvasWorkspace)"), "inline Canvas button must use the entry switch");
assert(app.includes("elements.canvasWorkspaceBtn?.classList.toggle(\"hidden\", hideCanvasEntry)"), "hidden mode must hide the top-nav Canvas entry");
assert(app.includes("elements.openCanvasInlineBtn?.classList.toggle(\"hidden\", hideCanvasEntry)"), "hidden mode must hide the inline Canvas entry");
assert(app.includes("elements.canvasCreateBtn?.classList.toggle(\"hidden\", hideCanvasEntry)"), "hidden mode must hide old Canvas create button");
assert(app.includes("canShowCanvasEntry ? `<button type=\"button\" data-square-add-canvas"), "gallery detail add-to-canvas must respect hidden mode");
assert(app.includes("isCanvasEntryHidden() ? \"\" : `<button type=\"button\" data-prompt-add-canvas"), "prompt detail add-to-canvas must respect hidden mode");
assert(app.includes("isCanvasEntryHidden() ? \"\" : `<button type=\"button\" data-work-detail-canvas"), "work detail add-to-canvas must respect hidden mode");
assert(resultActions.includes("state.settings?.canvasEntryMode"), "result action menu must respect hidden mode");
assert(resultActions.includes("canShowCanvasEntry ? `<button type=\"button\" data-add-generation-canvas"), "result action add-to-canvas must be suppressible");

assert(app.includes("async function createCanvasV2ProjectFromPayload(payload = {})"), "app must create Canvas v2 projects for entry payloads");
assert(app.includes("api(\"/api/canvases\""), "Canvas v2 entry helper must save through backend canvas API");
assert(app.includes("visibility: \"private\""), "Canvas v2 entry canvases must be private");
assert(app.includes("dataJson: document"), "Canvas v2 entry helper must save a document, not frontend-only state");
assert(app.includes("nodeCount: document.nodes.length"), "Canvas v2 entry helper must send node count");
assert(app.includes("edgeCount: document.edges.length"), "Canvas v2 entry helper must send edge count");
assert(app.includes("schema: \"ai-image-studio.canvas.v1\""), "Canvas v2 entry documents must use the shared schema");
assert(app.includes("source: \"canvas-v2-entry\""), "Canvas v2 entry documents must identify their source");
assert(app.includes("const imageUrl = persistableCanvasImageUrl(payload.imageUrl || payload.image || payload.images?.[0] || \"\")"), "Canvas v2 entry must sanitize image payload URLs");
assert(app.includes("if (!url || url.startsWith(\"data:\") || url.startsWith(\"blob:\")) return \"\";"), "Canvas v2 entry must strip data/blob image URLs");
assert(app.includes("if (url.startsWith(\"/\") || /^https?:\\/\\//i.test(url)) return url;"), "Canvas v2 entry must allow only same-origin or http(s) image URLs");
assert(!app.includes("providerApiKey"), "Canvas v2 public entry path must not handle provider API keys");
assert(!app.includes("openai.com"), "Canvas v2 public entry path must not call providers directly");

console.log("[canvas-v2-entry-smoke] OK: entry switch, rollback modes, and safe Canvas v2 insertion contract verified");

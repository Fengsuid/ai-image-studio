#!/usr/bin/env node
// Static guard for the basketikun/infinite-canvas prompt source integration.

import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const server = fs.readFileSync(path.join(rootDir, "server.js"), "utf8");
const store = fs.readFileSync(path.join(rootDir, "src/mysql-store.js"), "utf8");
const syncModule = fs.readFileSync(path.join(rootDir, "src/prompt-source-sync.js"), "utf8");

assert(server.includes('require("./src/prompt-source-sync")'), "server.js must delegate prompt sync to src/prompt-source-sync.js");
assert(!server.includes("function syncGithubGenericPromptSource"), "prompt sync parser logic must stay out of server.js");
assert(server.includes("reviewPendingPromptDuplicates({ limit: Math.min(24, result.upserted) })"), "remote sync must trigger AI duplicate review after candidate scanning");
assert(store.includes("ps_basketikun_infinite_canvas"), "prompt source seed must include basketikun/infinite-canvas");
assert(store.includes("https://github.com/basketikun/infinite-canvas"), "prompt source seed must point at basketikun/infinite-canvas");
assert(store.includes('parser: "infinite-canvas"'), "basketikun/infinite-canvas must use the dedicated parser");

assert(syncModule.includes('INFINITE_CANVAS_SOURCE_REPO = "basketikun/infinite-canvas"'), "sync module must preserve sourceRepo");
assert(syncModule.includes("syncInfiniteCanvasPromptSource"), "sync module must expose the infinite-canvas parser path");
assert(syncModule.includes("EvoLinkAI/awesome-gpt-image-2-API-and-Prompts"), "parser must include the EvoLinkAI source used by infinite-canvas");
assert(syncModule.includes("ZeroLu/awesome-gpt-image"), "parser must include the ZeroLu source used by infinite-canvas");
assert(syncModule.includes("ImgEdify/Awesome-GPT4o-Image-Prompts"), "parser must include the ImgEdify source used by infinite-canvas");
assert(syncModule.includes("YouMind-OpenLab/awesome-gpt-image-2"), "parser must include the YouMind GPT Image 2 source");
assert(syncModule.includes("YouMind-OpenLab/awesome-nano-banana-pro-prompts"), "parser must include the YouMind Nano Banana Pro source");
assert(syncModule.includes("scanPromptDuplicateCandidatesForPrompt"), "synced prompts must be scanned for duplicate candidates");

console.log("[infinite-canvas-prompt-source-smoke] OK: source seed and parser boundaries are in place");

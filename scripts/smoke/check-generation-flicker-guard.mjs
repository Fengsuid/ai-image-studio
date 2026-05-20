#!/usr/bin/env node
// Static guard for the text-to-image generation flicker fix.

import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const app = fs.readFileSync(path.join(rootDir, "public/app.js"), "utf8");
const resultActions = fs.readFileSync(path.join(rootDir, "public/generation-result-actions.js"), "utf8");

function functionBody(name) {
  const start = app.indexOf(`function ${name}`);
  assert(start >= 0, `${name} must exist`);
  const braceStart = app.indexOf("{", start);
  let depth = 0;
  for (let index = braceStart; index < app.length; index += 1) {
    const char = app[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return app.slice(braceStart + 1, index);
    }
  }
  throw new Error(`${name} body was not closed`);
}

const waitBody = functionBody("waitForGenerationRequest");
assert(!waitBody.includes("renderAll();"), "waitForGenerationRequest must not full-render during polling");
assert(waitBody.includes("updateGeneratingHistoryCard(itemId)"), "polling must patch the active generation card in place");

const submitBody = functionBody("submitGeneration");
const startSegment = submitBody.slice(0, submitBody.indexOf("let focusId = tempId"));
assert(!startSegment.includes('setView("home")'), "generation start must not call setView again after renderAll");

const setViewBody = functionBody("setView");
assert(setViewBody.includes("activeViewSignature"), "setView must track the active view signature");
assert(setViewBody.includes("if (viewChanged)"), "setView must only toggle view classes when the signature changes");

const renderComposersBody = functionBody("renderComposers");
assert(renderComposersBody.includes("!elements.heroComposerMount.children.length"), "hero composer mount must be reused");
assert(renderComposersBody.includes("!elements.stickyComposerMount.children.length"), "sticky composer mount must be reused");
assert(!renderComposersBody.includes("innerHTML"), "renderComposers must not rebuild composer mounts");

const cardUpdater = functionBody("updateGeneratingHistoryCard");
assert(cardUpdater.includes("[data-generation-progress]"), "card updater must target the progress span");
assert((app + resultActions).includes("data-generation-progress"), "renderHistory must expose a stable progress span");

console.log("[generation-flicker-guard] OK: generation polling patches cards, preserves view classes, and reuses composer mounts");

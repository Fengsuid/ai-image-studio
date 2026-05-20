#!/usr/bin/env node
// Static guard for collapsed generation result actions.

import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const indexHtml = fs.readFileSync(path.join(rootDir, "public/index.html"), "utf8");
const app = fs.readFileSync(path.join(rootDir, "public/app.js"), "utf8");
const actions = fs.readFileSync(path.join(rootDir, "public/generation-result-actions.js"), "utf8");
const css = fs.readFileSync(path.join(rootDir, "public/styles.css"), "utf8");

assert(indexHtml.includes("/generation-result-actions.js"), "index.html must load generation-result-actions.js");
assert(indexHtml.indexOf("/generation-result-actions.js") < indexHtml.indexOf("/app.js"), "generation-result-actions.js must load before app.js");
assert(app.includes("ImageStudioGenerationResultActions"), "app.js must delegate result action rendering");

const doneBody = actions.match(/function renderDone[\s\S]*?function renderError/)?.[0] || "";
assert(doneBody.includes("result-action-bar"), "done result actions must render a result action bar");
assert(doneBody.includes("data-retry"), "retry must stay a primary action");
assert(doneBody.includes("download="), "download must stay a primary action");
assert(doneBody.includes("<details class=\"message-more\""), "secondary actions must collapse into a menu");
assert(!doneBody.includes("data-add-generation-canvas") || doneBody.indexOf("data-add-generation-canvas") > doneBody.indexOf("message-more-menu"), "add-to-canvas must live inside the more menu");
assert(!doneBody.includes("data-edit=\"") || doneBody.indexOf("data-edit=\"") > doneBody.indexOf("message-more-menu"), "edit prompt must live inside the more menu");
assert(doneBody.includes("data-edit-image"), "image-to-image must remain reachable in the more menu");
assert(doneBody.includes("data-copy-history-prompt"), "copy prompt must be available in the more menu");

const sandbox = { window: {} };
vm.runInNewContext(actions, sandbox, { filename: "generation-result-actions.js" });
const html = sandbox.window.ImageStudioGenerationResultActions.render({
  item: {
    id: "item-1",
    status: "done",
    prompt: "prompt",
    images: ["/image.png"],
    isPublic: false
  },
  text: (key) => key,
  escapeHtml: (value) => String(value)
});
const topLevel = (html.match(/<(button|a|details)\b/g) || []).filter((_, index) => index < 3);
assert.equal(topLevel.length, 3, "done result action bar must expose exactly three top-level actions");

assert(css.includes(".message-more summary::-webkit-details-marker"), "native details marker must be hidden");
assert(css.includes(".message-more-menu"), "more menu must have project styling");
assert(css.includes("@media (max-width: 560px)"), "mobile action sizing must be constrained");
assert(css.includes("grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto"), "mobile layout must constrain the three primary action slots");

console.log("[generation-result-actions-smoke] OK: result actions collapse into a styled menu");
